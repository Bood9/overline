import { ESPN_LEAGUES, scoreboard, summary, leagueId, mapStatus, liveMinute, mapBoxStats, mlToDecimal, type EspnEvent } from '@/lib/providers/espn';
import { upsertFixture, upsertLeague, upsertTeam, upsertStats, recordOdds, tx } from './upsert';
import { all, logIngest, run } from '@/lib/db';
import { sleep } from '@/lib/util/http';

const toDec = (s?: string | null) => {
  if (!s) return null;
  const n = Number(String(s).replace('+', ''));
  return Number.isFinite(n) ? mlToDecimal(n) : null;
};
const lineNum = (s?: string | null) => {
  if (!s) return null;
  const n = Number(String(s).replace(/[ou+]/gi, ''));
  return Number.isFinite(n) ? n : null;
};

function ingestOdds(fixtureId: number, comp: EspnEvent['competitions'][0]) {
  for (const o of (comp.odds ?? []).filter(Boolean)) {
    const book = o.provider?.name || 'Consensus';
    const raw = o as any;
    // 1X2
    const ml = raw.moneyline;
    if (ml) {
      for (const [sel, node] of [['HOME', ml.home], ['DRAW', ml.draw], ['AWAY', ml.away]] as const) {
        const price = toDec(node?.close?.odds) ?? toDec(node?.current?.odds);
        const open = toDec(node?.open?.odds);
        if (price) recordOdds({ fixture_id: fixtureId, bookmaker: book, market: '1X2', line: 0, selection: sel, price, open_price: open });
      }
    } else if (raw.homeTeamOdds?.moneyLine || raw.awayTeamOdds?.moneyLine) {
      const pairs: [string, number | undefined][] = [
        ['HOME', raw.homeTeamOdds?.moneyLine], ['DRAW', raw.drawOdds?.moneyLine], ['AWAY', raw.awayTeamOdds?.moneyLine],
      ];
      for (const [sel, v] of pairs) {
        const price = mlToDecimal(v ?? null);
        if (price) recordOdds({ fixture_id: fixtureId, bookmaker: book, market: '1X2', line: 0, selection: sel, price });
      }
    }
    // Totals
    const tot = raw.total;
    if (tot) {
      for (const [sel, node] of [['OVER', tot.over], ['UNDER', tot.under]] as const) {
        const price = toDec(node?.close?.odds);
        const open = toDec(node?.open?.odds);
        const line = lineNum(node?.close?.line) ?? raw.overUnder ?? 2.5;
        if (price) recordOdds({ fixture_id: fixtureId, bookmaker: book, market: 'OU', line, selection: sel, price, open_price: open });
      }
    } else if (raw.overOdds && raw.overUnder) {
      const ov = mlToDecimal(raw.overOdds), un = mlToDecimal(raw.underOdds);
      if (ov) recordOdds({ fixture_id: fixtureId, bookmaker: book, market: 'OU', line: raw.overUnder, selection: 'OVER', price: ov });
      if (un) recordOdds({ fixture_id: fixtureId, bookmaker: book, market: 'OU', line: raw.overUnder, selection: 'UNDER', price: un });
    }
    // Asian-ish spread
    const sp = raw.pointSpread;
    if (sp) {
      for (const [sel, node] of [['HOME', sp.home], ['AWAY', sp.away]] as const) {
        const price = toDec(node?.close?.odds);
        const open = toDec(node?.open?.odds);
        const line = lineNum(node?.close?.line);
        if (price && line !== null) recordOdds({ fixture_id: fixtureId, bookmaker: book, market: 'AH', line, selection: sel, price, open_price: open });
      }
    }
  }
}

export interface IngestResult { fixtures: number; leagues: number; errors: string[] }

/** Pull scoreboards for a set of dates across all tracked competitions. */
export async function ingestFixtures(dates: string[], slugs?: string[]): Promise<IngestResult> {
  const t0 = Date.now();
  const defs = ESPN_LEAGUES.filter((l) => !slugs || slugs.includes(l.slug));
  const res: IngestResult = { fixtures: 0, leagues: 0, errors: [] };

  for (const def of defs) {
    const lid = leagueId(def.slug);
    upsertLeague({ id: lid, name: def.name, country: def.country, tier: def.tier });
    res.leagues++;
    for (const date of dates) {
      try {
        const events = await scoreboard(def.slug, date);
        tx(() => {
          for (const ev of events) {
            try {
            const comp = ev.competitions?.[0];
            if (!comp) continue;
            const home = comp.competitors.find((c) => c.homeAway === 'home');
            const away = comp.competitors.find((c) => c.homeAway === 'away');
            if (!home || !away) continue;
            upsertTeam({ id: +home.team.id, name: home.team.displayName, short_name: home.team.shortDisplayName, logo: home.team.logo, country: def.country });
            upsertTeam({ id: +away.team.id, name: away.team.displayName, short_name: away.team.shortDisplayName, logo: away.team.logo, country: def.country });
            const st = comp.status;
            upsertFixture({
              id: +ev.id, league_id: lid, season: ev.season?.year ?? null,
              kickoff: new Date(ev.date).toISOString(),
              status: mapStatus(st.type.state, st.type.shortDetail, st.type.completed, st.period),
              minute: st.type.state === 'in' ? liveMinute(st.displayClock, st.clock, st.period) : null,
              home_id: +home.team.id, away_id: +away.team.id,
              // ESPN reports 0 for matches that have not kicked off — storing that
              // would put a fake 0:0 on every scheduled fixture
              goals_home: st.type.state === 'pre' || home.score == null || home.score === '' ? null : +home.score,
              goals_away: st.type.state === 'pre' || away.score == null || away.score === '' ? null : +away.score,
              venue: comp.venue?.fullName ?? null, city: comp.venue?.address?.city ?? null,
            });
            ingestOdds(+ev.id, comp);
            res.fixtures++;
            } catch (err: any) {
              res.errors.push(`event ${ev.id}: ${err?.message ?? err}`);
            }
          }
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        res.errors.push(`${def.slug}/${date}: ${msg}`);
        if (/ограничил доступ|пауза после блокировки/.test(msg)) {
          res.errors.push('пасс прерван: ESPN нас притормозил');
          logIngest('fixtures', 'blocked', msg, res.fixtures, Date.now() - t0);
          return res;
        }
      }
    }
  }
  logIngest('fixtures', res.errors.length ? 'partial' : 'ok', res.errors.slice(0, 5).join('; '), res.fixtures, Date.now() - t0);
  return res;
}

/** Live pass: cheap, only leagues that actually have a match in progress window. */
export async function ingestLive(): Promise<IngestResult> {
  const t0 = Date.now();
  const rows = all<{ slug: string }>(
    `SELECT DISTINCT l.name AS slug FROM fixtures f JOIN leagues l ON l.id=f.league_id
     WHERE datetime(f.kickoff) BETWEEN datetime('now','-3 hours') AND datetime('now','+30 minutes')`,
  );
  const names = new Set(rows.map((r) => r.slug));
  const slugs = ESPN_LEAGUES.filter((l) => names.has(l.name)).map((l) => l.slug);
  const today = new Date().toISOString().slice(0, 10);
  const r = slugs.length ? await ingestFixtures([today], slugs) : { fixtures: 0, leagues: 0, errors: [] };
  logIngest('live', 'ok', `${slugs.length} leagues live`, r.fixtures, Date.now() - t0);
  return r;
}

/** Detailed stats + referee for finished (or in-play) fixtures that lack them. */
export async function ingestStats(limit = 40): Promise<{ done: number; errors: string[] }> {
  const t0 = Date.now();
  const rows = all<{ id: number; league: string; home_id: number; away_id: number }>(
    `SELECT f.id, l.name AS league, f.home_id, f.away_id
       FROM fixtures f JOIN leagues l ON l.id = f.league_id
      WHERE f.status IN ('FT','AET','PEN','1H','2H','HT','ET')
        AND datetime(f.kickoff) > datetime('now','-45 days')
        AND (f.referee IS NULL OR NOT EXISTS (SELECT 1 FROM fixture_stats s WHERE s.fixture_id=f.id))
      ORDER BY f.kickoff DESC LIMIT @limit`,
    { limit },
  );
  const errors: string[] = [];
  let done = 0;
  for (const r of rows) {
    const def = ESPN_LEAGUES.find((l) => l.name === r.league);
    if (!def) continue;
    try {
      const s = await summary(def.slug, String(r.id));
      const teams = s?.boxscore?.teams ?? [];
      for (const t of teams) {
        const teamId = +t?.team?.id;
        if (!teamId) continue;
        const side = teamId === r.home_id ? 'home' : 'away';
        const mapped = mapBoxStats(t.statistics ?? []);
        if (mapped.shots !== null || mapped.fouls !== null) upsertStats(r.id, teamId, side as 'home' | 'away', mapped);
      }
      const ref = s?.gameInfo?.officials?.find((o: any) => /referee/i.test(o?.position?.name ?? ''))?.displayName;
      if (ref) run(`UPDATE fixtures SET referee=@ref, updated_at=datetime('now') WHERE id=@id`, { ref, id: r.id });
      done++;
    } catch (e: any) {
      errors.push(`${r.id}: ${e?.message ?? e}`);
    }
  }
  logIngest('stats', errors.length ? 'partial' : 'ok', errors.slice(0, 3).join('; '), done, Date.now() - t0);
  return { done, errors };
}

export function dateRange(from: number, to: number): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d++) {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() + d);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}
