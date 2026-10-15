import {
  listEvents, listMarkets, listContracts, listQuotes, listVolumes,
  mapMarket, mapContract, readBook, type SmMarket,
} from '@/lib/providers/smarkets';
import { matchFixture, splitEventName, type Candidate } from '@/lib/util/match-names';
import { all, one, run, logIngest } from '@/lib/db';
import { sleep } from '@/lib/util/http';

const CHUNK = 20;

function upcomingFixtures(hours: number): Candidate[] {
  return all<Candidate>(
    `SELECT f.id, th.name AS home, ta.name AS away, f.kickoff
       FROM fixtures f JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
      WHERE f.status='NS'
        AND datetime(f.kickoff) BETWEEN datetime('now','-2 hours') AND datetime('now', @h)`,
    { h: `+${hours} hours` },
  );
}

export async function ingestExchange(hours = 60): Promise<{ events: number; matched: number; rows: number; errors: string[] }> {
  const t0 = Date.now();
  const errors: string[] = [];
  const fixtures = upcomingFixtures(hours);
  if (!fixtures.length) {
    logIngest('exchange', 'ok', 'нет ближайших матчей', 0, Date.now() - t0);
    return { events: 0, matched: 0, rows: 0, errors };
  }

  const until = new Date(Date.now() + hours * 3.6e6).toISOString();
  let events: Awaited<ReturnType<typeof listEvents>> = [];
  try {
    events = await listEvents(until);
  } catch (e: any) {
    logIngest('exchange', 'fail', String(e?.message ?? e), 0, Date.now() - t0);
    return { events: 0, matched: 0, rows: 0, errors: [String(e?.message ?? e)] };
  }

  let matched = 0, rows = 0;
  for (const ev of events) {
    const parts = splitEventName(ev.name);
    if (!parts) continue;

    const cached = one<{ fixture_id: number }>(
      `SELECT fixture_id FROM event_map WHERE provider='smarkets' AND ext_id=@id`, { id: ev.id },
    );
    let fixtureId = cached?.fixture_id ?? null;
    if (!fixtureId) {
      const hit = matchFixture(parts[0], parts[1], ev.start_datetime, fixtures);
      if (!hit) continue;
      fixtureId = hit.id;
      run(
        `INSERT INTO event_map(provider,ext_id,fixture_id,confidence) VALUES('smarkets',@id,@fx,@c)
         ON CONFLICT(provider,ext_id) DO UPDATE SET fixture_id=@fx, confidence=@c`,
        { id: ev.id, fx: hit.id, c: hit.confidence },
      );
    }
    matched++;

    try {
      const markets = (await listMarkets(ev.id)).filter((m: SmMarket) => m.state === 'open' && mapMarket(m));
      if (!markets.length) continue;

      for (let i = 0; i < markets.length; i += CHUNK) {
        const slice = markets.slice(i, i + CHUNK);
        const ids = slice.map((m) => m.id);
        const [contracts, quotes, volumes] = await Promise.all([
          listContracts(ids), listQuotes(ids), listVolumes(ids),
        ]);
        // raw exchange figure — scale unverified, stored for ranking only
        const volByMarket = new Map(volumes.map((v) => [v.market_id, v.volume]));

        for (const m of slice) {
          const mapped = mapMarket(m)!;
          const mine = contracts.filter((c) => c.market_id === m.id);
          for (const c of mine) {
            const sel = mapContract(c);
            if (!sel) continue;
            const book = readBook(quotes[c.id]);
            if (!book || (!book.backPrice && !book.layPrice)) continue;
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
            rows++;
          }
        }
        await sleep(120);
      }
    } catch (e: any) {
      errors.push(`${ev.name}: ${e?.message ?? e}`);
    }
  }

  run(`DELETE FROM exchange WHERE fixture_id IN (
         SELECT id FROM fixtures WHERE datetime(kickoff) < datetime('now','-6 hours'))`);
  logIngest('exchange', errors.length ? 'partial' : 'ok', errors.slice(0, 3).join('; '), rows, Date.now() - t0);
  return { events: events.length, matched, rows, errors };
}
