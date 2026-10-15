/**
 * Track record of the recommendations themselves.
 *
 * `insights` is a working table — every rebuild deletes and rewrites it, so past
 * advice used to vanish and could never be checked. This log keeps one immutable
 * row per pick at the moment it was first published (with the price that was on
 * screen), then settles it from the final score. It is what makes "как отработали
 * прогнозы" answerable instead of a guess.
 */
import { all, one, run, logIngest } from '@/lib/db';
import { settleBet, SETTLEABLE, VOID_STATUSES } from './settle';

export const SETTLEABLE_MARKETS = ['1X2', 'ML', 'DC', 'OU', 'BTTS', 'AH'];
const MIN_SCORE = 55;

/** Snapshot today's publishable picks. Existing rows keep their original price. */
export function logPredictions(): number {
  const n = run(
    `INSERT INTO prediction_log
       (fixture_id, market, line, selection, label, score, price, price_source,
        model_prob, market_prob, edge, kickoff, logged_at)
     SELECT i.fixture_id, i.market, i.line, i.selection, i.label, i.score, i.price, i.price_source,
            i.model_prob, i.market_prob, i.edge, f.kickoff, datetime('now')
       FROM insights i
       JOIN fixtures f ON f.id = i.fixture_id
      WHERE f.status = 'NS'
        AND datetime(f.kickoff) > datetime('now')
        AND i.price IS NOT NULL
        AND i.score >= ${MIN_SCORE}
        AND i.market IN (${SETTLEABLE_MARKETS.map((m) => `'${m}'`).join(',')})
     ON CONFLICT(fixture_id, market, line, selection) DO UPDATE SET
        -- the pick stays as first published; only its live numbers refresh
        score = excluded.score,
        latest_price = excluded.price,
        updated_at = datetime('now')`,
  ).changes;
  return n;
}

export function settlePredictions(): { settled: number; voided: number } {
  const rows = all<{
    id: number; market: string; line: number; selection: string; price: number;
    status: string; goals_home: number | null; goals_away: number | null; kickoff: string;
  }>(
    `SELECT p.id, p.market, p.line, p.selection, p.price,
            f.status, f.goals_home, f.goals_away, f.kickoff
       FROM prediction_log p JOIN fixtures f ON f.id = p.fixture_id
      WHERE p.result IS NULL`,
  );
  let settled = 0, voided = 0;
  for (const r of rows) {
    let outcome: string | null = null, factor = 0;
    if (SETTLEABLE.has(r.status) && r.goals_home !== null && r.goals_away !== null) {
      const s = settleBet(r.market, r.line, r.selection, r.price, r.goals_home, r.goals_away);
      if (s) { outcome = s.outcome; factor = s.factor; }
    } else if (VOID_STATUSES.has(r.status)) {
      outcome = 'void'; factor = 1;
    }
    // deliberately no "too old, call it void": a missing score means our ingest
    // fell behind, and voiding would quietly erase a real result. It stays
    // pending and settles whenever the score arrives.
    if (!outcome) continue;
    run(`UPDATE prediction_log SET result=@o, factor=@f, settled_at=datetime('now') WHERE id=@id`,
      { o: outcome, f: factor, id: r.id });
    outcome === 'void' ? voided++ : settled++;
  }
  if (settled || voided) logIngest('predictions', 'ok', '', settled + voided, 0);
  return { settled, voided };
}

export interface Bucket {
  label: string; n: number; won: number; hitRate: number | null;
  roi: number | null; avgPrice: number | null; profit: number;
}
export interface TrackRecord {
  overall: Bucket;
  byScore: Bucket[];
  byMarket: Bucket[];
  pending: number;
  firstLogged: string | null;
  /** only the single best pick per match — what the interface actually shows */
  topPickOnly: Bucket;
  recent: {
    kickoff: string; home: string; away: string; label: string; score: number;
    price: number; result: string; goals: string | null;
  }[];
}

const STAKE = 100;

function bucketFrom(label: string, rows: { factor: number | null; price: number; result: string | null }[]): Bucket {
  const done = rows.filter((r) => r.result && r.result !== 'void');
  const staked = done.length * STAKE;
  const returned = done.reduce((a, r) => a + STAKE * (r.factor ?? 0), 0);
  const won = done.filter((r) => (r.factor ?? 0) > 1).length;
  return {
    label,
    n: done.length,
    won,
    hitRate: done.length ? +((won / done.length) * 100).toFixed(1) : null,
    roi: staked ? +(((returned - staked) / staked) * 100).toFixed(1) : null,
    avgPrice: done.length ? +(done.reduce((a, r) => a + r.price, 0) / done.length).toFixed(2) : null,
    profit: Math.round(returned - staked),
  };
}

export function getTrackRecord(): TrackRecord {
  const rows = all<{ score: number; market: string; price: number; result: string | null; factor: number | null }>(
    'SELECT score, market, price, result, factor FROM prediction_log',
  );
  const scoreBuckets: [string, (s: number) => boolean][] = [
    ['85+', (s) => s >= 85],
    ['75–84', (s) => s >= 75 && s < 85],
    ['65–74', (s) => s >= 65 && s < 75],
    ['55–64', (s) => s >= 55 && s < 65],
  ];
  const markets = [...new Set(rows.map((r) => r.market))];

  const top = all<{ price: number; result: string | null; factor: number | null }>(
    `SELECT p.price, p.result, p.factor FROM prediction_log p
      WHERE p.result IS NOT NULL
        AND p.score = (SELECT MAX(q.score) FROM prediction_log q WHERE q.fixture_id = p.fixture_id)
      GROUP BY p.fixture_id`,
  );

  return {
    overall: bucketFrom('все', rows),
    byScore: scoreBuckets.map(([l, f]) => bucketFrom(l, rows.filter((r) => f(r.score)))).filter((b) => b.n > 0),
    byMarket: markets.map((m) => bucketFrom(m, rows.filter((r) => r.market === m))).filter((b) => b.n > 0)
      .sort((a, b) => b.n - a.n),
    pending: rows.filter((r) => !r.result).length,
    firstLogged: one<{ t: string }>('SELECT MIN(logged_at) t FROM prediction_log')?.t ?? null,
    topPickOnly: bucketFrom('лучшая ставка матча', top),
    recent: all(
      `SELECT p.kickoff, p.label, p.score, p.price, p.result,
              COALESCE(th.name_ru, th.name) AS home, COALESCE(ta.name_ru, ta.name) AS away,
              CASE WHEN f.goals_home IS NULL THEN NULL ELSE f.goals_home || ':' || f.goals_away END AS goals
         FROM prediction_log p
         JOIN fixtures f ON f.id = p.fixture_id
         JOIN teams th ON th.id = f.home_id JOIN teams ta ON ta.id = f.away_id
        WHERE p.result IS NOT NULL
        ORDER BY p.kickoff DESC LIMIT 40`,
    ),
  };
}
