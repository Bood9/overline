/**
 * Hockey, basketball and esports come entirely from the Smarkets exchange:
 * schedule, prices and the real order book in one source with no key.
 *
 * There is no box-score feed for these sports here, so they get market-based
 * analytics only — no Poisson model, no referee profile. The UI says so.
 */
import {
  listEvents, listMarkets, listContracts, listQuotes, listVolumes,
  mapMarket, mapContract, readBook, competitionOf, SPORT_TYPES, type SportKey,
} from '@/lib/providers/smarkets';
import { splitEventName } from '@/lib/util/match-names';
import { upsertFixture, upsertLeague, upsertTeam, recordOdds } from './upsert';
import { run, logIngest, all } from '@/lib/db';
import { sleep } from '@/lib/util/http';
import { teamRu } from '@/lib/util/ru';

const CHUNK = 20;
const ID_BASE = 2_000_000_000;

/** Stable positive id from a string, kept clear of ESPN's own id range. */
function stableId(kind: string, key: string): number {
  let h = 2166136261;
  for (const ch of `${kind}:${key}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ID_BASE + (Math.abs(h) % 900_000_000);
}

export const SPORT_LABELS: Record<string, string> = {
  football: 'Футбол',
  hockey: 'Хоккей',
  basketball: 'Баскетбол',
  esports: 'Киберспорт',
};

const ESPORT_TYPES: SportKey[] = ['csgo', 'lol', 'cod'];
const COMPETITION_RU: Record<string, string> = {
  nba: 'НБА', wnba: 'ВНБА', nhl: 'НХЛ', khl: 'КХЛ', euroleague: 'Евролига',
  del: 'DEL', shl: 'SHL', liiga: 'Liiga', 'nhl-preseason': 'НХЛ · предсезон',
};

const prettyCompetition = (slug: string) =>
  COMPETITION_RU[slug] ??
  slug.split('-').map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase())).join(' ');

interface SportPlan { sport: string; types: SportKey[]; tier: number; maxEvents: number }

const PLANS: SportPlan[] = [
  { sport: 'hockey', types: ['hockey'], tier: 3, maxEvents: 30 },
  { sport: 'basketball', types: ['basketball'], tier: 3, maxEvents: 30 },
  // esports has hundreds of tier-3 matches a day — take the soonest ones only
  { sport: 'esports', types: ESPORT_TYPES, tier: 4, maxEvents: 20 },
];

export async function ingestSports(hours = 72, only?: string[]): Promise<Record<string, { events: number; fixtures: number; odds: number; errors: string[] }>> {
  const result: Record<string, { events: number; fixtures: number; odds: number; errors: string[] }> = {};
  const until = new Date(Date.now() + hours * 3.6e6).toISOString();

  for (const plan of PLANS) {
    if (only?.length && !only.includes(plan.sport)) continue;
    const t0 = Date.now();
    const acc = { events: 0, fixtures: 0, odds: 0, errors: [] as string[] };
    let blocked = false;

    for (const type of plan.types) {
      if (blocked) break;
      let events: Awaited<ReturnType<typeof listEvents>> = [];
      try {
        events = await listEvents(until, 3, SPORT_TYPES[type]);
      } catch (e: any) {
        acc.errors.push(`${type}: ${e?.message ?? e}`);
        continue;
      }
      events = events
        .slice()
        .sort((a, b) => +new Date(a.start_datetime) - +new Date(b.start_datetime))
        .slice(0, plan.maxEvents);
      acc.events += events.length;

      for (const ev of events) {
        if (blocked) break;
        const parts = splitEventName(ev.name) ?? ev.name.split(/\s+(?:at|@)\s+/i).map((x) => x.trim());
        if (parts.length !== 2 || !parts[0] || !parts[1]) continue;
        // "A at B" in US sports means B is the host
        const atForm = /\s+(?:at|@)\s+/i.test(ev.name) && !/\svs\.?\s/i.test(ev.name);
        const [homeName, awayName] = atForm ? [parts[1], parts[0]] : [parts[0], parts[1]];

        const compSlug = competitionOf(ev.full_slug);
        const leagueId = stableId('league', `${plan.sport}:${compSlug}`);
        const homeId = stableId('team', `${plan.sport}:${homeName}`);
        const awayId = stableId('team', `${plan.sport}:${awayName}`);
        const fixtureId = stableId('fixture', `sm:${ev.id}`);

        upsertLeague({
          id: leagueId, name: prettyCompetition(compSlug), country: '', tier: plan.tier, provider: 'smarkets',
        });
        run(`UPDATE leagues SET sport=@s, name_ru=@n WHERE id=@id`,
          { s: plan.sport, n: prettyCompetition(compSlug), id: leagueId });

        for (const [id, name] of [[homeId, homeName], [awayId, awayName]] as [number, string][]) {
          upsertTeam({ id, name, provider: 'smarkets' });
          run(`UPDATE teams SET sport=@s, name_ru=@n WHERE id=@id`,
            { s: plan.sport, n: plan.sport === 'esports' ? name : teamRu(name), id });
        }

        upsertFixture({
          id: fixtureId, league_id: leagueId, kickoff: new Date(ev.start_datetime).toISOString(),
          status: 'NS', home_id: homeId, away_id: awayId, provider: 'smarkets',
        });
        run(`UPDATE fixtures SET sport=@s WHERE id=@id`, { s: plan.sport, id: fixtureId });
        run(
          `INSERT INTO event_map(provider,ext_id,fixture_id,confidence) VALUES('smarkets',@e,@f,1)
           ON CONFLICT(provider,ext_id) DO UPDATE SET fixture_id=@f`,
          { e: ev.id, f: fixtureId },
        );
        acc.fixtures++;

        try {
          const markets = (await listMarkets(ev.id)).filter((m) => m.state === 'open' && mapMarket(m));
          for (let i = 0; i < markets.length; i += CHUNK) {
            const slice = markets.slice(i, i + CHUNK);
            const ids = slice.map((m) => m.id);
            const [contracts, quotes, volumes] = await Promise.all([
              listContracts(ids), listQuotes(ids), listVolumes(ids),
            ]);
            const volByMarket = new Map(volumes.map((v) => [v.market_id, v.volume]));

            for (const m of slice) {
              const mapped = mapMarket(m)!;
              for (const c of contracts.filter((x) => x.market_id === m.id)) {
                const sel = mapContract(c);
                if (!sel) continue;
                const book = readBook(quotes[c.id]);
                if (!book?.midPrice) continue;
                run(
                  `INSERT INTO exchange(fixture_id,market,line,selection,back_price,lay_price,mid_price,fair_prob,
                      back_money,lay_money,matched_volume,source,updated_at)
                   VALUES(@fx,@market,@line,@sel,@back,@lay,@mid,@prob,@bm,@lm,@vol,'smarkets',datetime('now'))
                   ON CONFLICT(fixture_id,market,line,selection) DO UPDATE SET
                     back_price=@back, lay_price=@lay, mid_price=@mid, fair_prob=@prob,
                     back_money=@bm, lay_money=@lm, matched_volume=@vol, updated_at=datetime('now')`,
                  {
                    fx: fixtureId, market: mapped.market, line: mapped.line, sel,
                    back: book.backPrice, lay: book.layPrice, mid: book.midPrice, prob: book.midProb,
                    bm: book.backMoney, lm: book.layMoney, vol: volByMarket.get(m.id) ?? 0,
                  },
                );
                // the exchange is also the price board for these sports
                recordOdds({
                  fixture_id: fixtureId, bookmaker: 'Smarkets', market: mapped.market,
                  line: mapped.line, selection: sel, price: book.midPrice,
                });
                acc.odds++;
              }
            }
            await sleep(120);
          }
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          acc.errors.push(`${ev.name}: ${msg}`);
          if (/ограничил доступ|пауза после блокировки/.test(msg)) {
            acc.errors.push('пасс прерван: биржа притормозила');
            blocked = true;
            break;
          }
        }
      }
    }

    run(
      `UPDATE fixtures SET status='FT' WHERE sport=@s AND status='NS'
        AND datetime(kickoff) < datetime('now','-4 hours')`, { s: plan.sport },
    );
    logIngest(`sport:${plan.sport}`, acc.errors.length ? 'partial' : 'ok',
      acc.errors.slice(0, 3).join('; '), acc.fixtures, Date.now() - t0);
    result[plan.sport] = acc;
  }
  return result;
}

export function sportCounts() {
  return all<{ sport: string; n: number }>(
    `SELECT sport, COUNT(*) n FROM fixtures
      WHERE datetime(kickoff) > datetime('now','-3 hours') GROUP BY sport`,
  );
}
