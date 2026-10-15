/**
 * xG from API-Football.
 *
 * Free-plan limits, verified against the live API on 2026-09-22:
 *   - 100 requests a day;
 *   - dates only inside a rolling window of yesterday → tomorrow
 *     ("Free plans do not have access to this date, try from … to …").
 * So there is no historical back-fill: xG accumulates day by day for matches that
 * finished yesterday or today. One request maps a whole date; the rest of the
 * budget goes to statistics of matches whose teams play again soon.
 */
import {
  afEnabled, afQuotaLeft, getFixturesByDate, getFixtureStats, mapStatRow, type AFFixture,
} from '@/lib/providers/apiFootball';
import { matchFixture, similarity, type Candidate } from '@/lib/util/match-names';
import { all, one, run, logIngest } from '@/lib/db';

const PROVIDER = 'apifootball';
/** Never spend the last few requests — leave room for a manual retry. */
const RESERVE = 3;

interface MapResult { dates: number; mapped: number; errors: string[] }

/** One request per date maps every fixture we track that day. */
export async function mapFixtures(dates: string[]): Promise<MapResult> {
  const res: MapResult = { dates: 0, mapped: 0, errors: [] };
  if (!afEnabled()) {
    res.errors.push('API_FOOTBALL_KEY не задан');
    return res;
  }

  for (const date of dates) {
    if (afQuotaLeft() <= RESERVE) {
      res.errors.push('дневная квота API-Football исчерпана');
      break;
    }
    const known = all<Candidate>(
      `SELECT f.id, th.name AS home, ta.name AS away, f.kickoff
         FROM fixtures f JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
        WHERE f.sport='football' AND date(f.kickoff) = @date`,
      { date },
    );
    if (!known.length) continue;

    try {
      const remote = await getFixturesByDate(date);
      res.dates++;
      for (const r of remote as AFFixture[]) {
        const hit = matchFixture(r.teams.home.name, r.teams.away.name, r.fixture.date, known);
        if (!hit) continue;
        run(
          `INSERT INTO event_map(provider,ext_id,fixture_id,confidence)
           VALUES(@p,@ext,@fx,@c)
           ON CONFLICT(provider,ext_id) DO UPDATE SET fixture_id=@fx, confidence=@c`,
          { p: PROVIDER, ext: String(r.fixture.id), fx: hit.id, c: hit.confidence },
        );
        res.mapped++;
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // outside the free-plan window: not an error worth stopping for
      if (/do not have access to this date/i.test(msg)) continue;
      res.errors.push(`${date}: ${msg}`);
      if (/quota|limit/i.test(msg)) break;
    }
  }
  logIngest('af_map', res.errors.length ? 'partial' : 'ok', res.errors.slice(0, 3).join('; '), res.mapped, 0);
  return res;
}

/**
 * Fixtures worth spending a request on: finished, mapped, still missing xG, and
 * belonging to a team that plays again soon — those are the ones the model needs.
 */
function priorityQueue(limit: number) {
  return all<{ ext_id: string; fixture_id: number; home_id: number; away_id: number }>(
    `SELECT m.ext_id, m.fixture_id, f.home_id, f.away_id
       FROM event_map m
       JOIN fixtures f ON f.id = m.fixture_id
      WHERE m.provider = @p
        AND f.status IN ('FT','AET','PEN')
        AND NOT EXISTS (
          SELECT 1 FROM fixture_stats s WHERE s.fixture_id = f.id AND s.xg IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM kv WHERE kv.k = 'af:stats:' || m.ext_id
        )
        AND datetime(f.kickoff) > datetime('now','-2 days')
      ORDER BY
        -- teams that play again soon first: those are the ones the model needs today
        EXISTS (
          SELECT 1 FROM fixtures up
           WHERE up.status = 'NS'
             AND datetime(up.kickoff) BETWEEN datetime('now') AND datetime('now','+4 days')
             AND (up.home_id IN (f.home_id, f.away_id) OR up.away_id IN (f.home_id, f.away_id))
        ) DESC,
        f.kickoff DESC
      LIMIT @limit`,
    { p: PROVIDER, limit },
  );
}

/**
 * Merge API-Football numbers into fixture_stats. ESPN's own figures win where both
 * exist — they came first and the model was calibrated on them.
 */
export function writeStats(
  fixtureId: number, teamId: number, side: 'home' | 'away', m: ReturnType<typeof mapStatRow>,
) {
  run(
    `INSERT INTO fixture_stats(fixture_id,team_id,side,shots,shots_on,corners,fouls,yellow,red,
        possession,xg,offsides,saves,passes,pass_acc,updated_at)
     VALUES(@fx,@tid,@side,@shots,@shots_on,@corners,@fouls,@yellow,@red,
        @possession,@xg,@offsides,@saves,@passes,@pass_acc,datetime('now'))
     ON CONFLICT(fixture_id,team_id) DO UPDATE SET
       xg         = COALESCE(@xg, fixture_stats.xg),
       shots      = COALESCE(fixture_stats.shots, @shots),
       shots_on   = COALESCE(fixture_stats.shots_on, @shots_on),
       corners    = COALESCE(fixture_stats.corners, @corners),
       fouls      = COALESCE(fixture_stats.fouls, @fouls),
       yellow     = COALESCE(fixture_stats.yellow, @yellow),
       red        = COALESCE(fixture_stats.red, @red),
       possession = COALESCE(fixture_stats.possession, @possession),
       offsides   = COALESCE(fixture_stats.offsides, @offsides),
       saves      = COALESCE(fixture_stats.saves, @saves),
       passes     = COALESCE(fixture_stats.passes, @passes),
       pass_acc   = COALESCE(fixture_stats.pass_acc, @pass_acc),
       updated_at = datetime('now')`,
    {
      fx: fixtureId, tid: teamId, side,
      shots: m.shots, shots_on: m.shots_on, corners: m.corners, fouls: m.fouls,
      yellow: m.yellow, red: m.red, possession: m.possession, xg: m.xg,
      offsides: m.offsides, saves: m.saves, passes: m.passes, pass_acc: m.pass_acc,
    },
  );
}

/** Dates the free plan will answer for: yesterday and today (tomorrow has no results yet). */
export function freeWindow(): string[] {
  const d = (off: number) => {
    const x = new Date();
    x.setUTCDate(x.getUTCDate() + off);
    return x.toISOString().slice(0, 10);
  };
  return [d(-1), d(0)];
}

export async function ingestXg(maxRequests = 40): Promise<{ done: number; skipped: number; errors: string[] }> {
  const t0 = Date.now();
  const errors: string[] = [];
  if (!afEnabled()) {
    return { done: 0, skipped: 0, errors: ['API_FOOTBALL_KEY не задан'] };
  }

  const budget = Math.max(0, Math.min(maxRequests, afQuotaLeft() - RESERVE));
  const queue = priorityQueue(budget);
  let done = 0;

  for (const row of queue) {
    if (afQuotaLeft() <= RESERVE) {
      errors.push('дневная квота исчерпана — продолжим завтра');
      break;
    }
    try {
      const sides = one<{ home_id: number; away_id: number; home: string; away: string }>(
        `SELECT f.home_id, f.away_id, th.name AS home, ta.name AS away
           FROM fixtures f JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
          WHERE f.id = @fx`,
        { fx: row.fixture_id },
      );
      if (!sides) continue;

      const stats = await getFixtureStats(Number(row.ext_id));
      for (const entry of stats as any[]) {
        const remoteName = entry?.team?.name ?? '';
        const mapped = mapStatRow(entry?.statistics ?? []);
        // API-Football publishes xG only for major leagues; the rest of the box
        // score is still worth keeping, since the request is already paid for
        const hasAnything = Object.values(mapped).some((v) => v !== null);
        if (!hasAnything) continue;

        // provider names differ ("Man City" vs "Manchester City") — pick the closer side
        const toHome = similarity(remoteName, sides.home);
        const toAway = similarity(remoteName, sides.away);
        if (Math.max(toHome, toAway) < 0.5) continue;
        const isHome = toHome >= toAway;
        const teamId = isHome ? sides.home_id : sides.away_id;

        writeStats(row.fixture_id, teamId, isHome ? 'home' : 'away', mapped);
      }
      // remember we asked — do not spend another request on it tomorrow
      run(`INSERT INTO kv(k,v) VALUES(@k,'1') ON CONFLICT(k) DO NOTHING`, { k: `af:stats:${row.ext_id}` });
      done++;
    } catch (e: any) {
      errors.push(`${row.ext_id}: ${e?.message ?? e}`);
      if (/quota|limit|rateLimit/i.test(String(e?.message))) break;
    }
  }

  logIngest('xg', errors.length ? 'partial' : 'ok', errors.slice(0, 3).join('; '), done, Date.now() - t0);
  return { done, skipped: queue.length - done, errors };
}

export function xgCoverage() {
  return {
    fixturesWithXg: one<{ n: number }>(
      `SELECT COUNT(DISTINCT fixture_id) n FROM fixture_stats WHERE xg IS NOT NULL`,
    )?.n ?? 0,
    teamsWithXg: one<{ n: number }>(`SELECT COUNT(*) n FROM team_form WHERE xg_for > 0`)?.n ?? 0,
    mapped: one<{ n: number }>(
      `SELECT COUNT(*) n FROM event_map WHERE provider='${PROVIDER}'`,
    )?.n ?? 0,
  };
}
