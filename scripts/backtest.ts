/**
 * What each staking strategy would have returned on the picks we actually
 * published, settled by real scores. Day by day, bank compounding.
 *
 * Only `prediction_log` is used: the price is the one that was on screen when the
 * pick was published, and the result comes from the final score — nothing is
 * chosen with hindsight.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { all } from '../src/lib/db';
import { credibleProb, solve, DEFAULT_LIMITS, type Candidate } from '../src/lib/analytics/earnings-core';

interface Row {
  fixture_id: number; market: string; line: number; selection: string; label: string;
  score: number; price: number; model_prob: number | null; market_prob: number | null;
  result: string; factor: number; day: string;
}

const START = 10_000;

const rows = all<Row>(
  `SELECT p.fixture_id, p.market, p.line, p.selection, p.label, p.score, p.price,
          p.model_prob, p.market_prob, p.result, p.factor,
          date(datetime(p.kickoff, '+3 hours')) AS day
     FROM prediction_log p
    WHERE p.result IS NOT NULL AND p.result <> 'void'
    ORDER BY p.kickoff`,
);

const days = [...new Set(rows.map((r) => r.day))].sort();
const probOf = (r: Row) => credibleProb(r.model_prob ?? 0, r.market_prob ?? 1 / r.price);

/** Best pick per match — what the interface puts first. */
function topPerMatch(list: Row[]): Row[] {
  const best = new Map<number, Row>();
  for (const r of list) {
    const prev = best.get(r.fixture_id);
    if (!prev || r.score > prev.score) best.set(r.fixture_id, r);
  }
  return [...best.values()];
}

interface Result {
  name: string; bank: number; bets: number; won: number; staked: number;
  maxDrawdown: number; worstDay: number; bestDay: number; daysUp: number; daysDown: number;
  equity: { day: string; bank: number }[];
}

function run(name: string, pick: (dayRows: Row[], bank: number) => { row: Row; stake: number }[]): Result {
  let bank = START, peak = START, maxDd = 0;
  let bets = 0, won = 0, staked = 0, worstDay = 0, bestDay = 0, daysUp = 0, daysDown = 0;
  const equity: { day: string; bank: number }[] = [];

  for (const day of days) {
    const dayRows = rows.filter((r) => r.day === day);
    const chosen = pick(dayRows, bank);
    let pnl = 0;
    for (const { row, stake } of chosen) {
      if (stake < 1) continue;
      bets++; staked += stake;
      pnl += stake * row.factor - stake;
      if (row.factor > 1) won++;
    }
    bank += pnl;
    peak = Math.max(peak, bank);
    maxDd = Math.max(maxDd, (peak - bank) / peak);
    worstDay = Math.min(worstDay, pnl);
    bestDay = Math.max(bestDay, pnl);
    if (pnl > 0) daysUp++; else if (pnl < 0) daysDown++;
    equity.push({ day, bank: Math.round(bank) });
  }
  return { name, bank: Math.round(bank), bets, won, staked: Math.round(staked), maxDrawdown: +(maxDd * 100).toFixed(1), worstDay: Math.round(worstDay), bestDay: Math.round(bestDay), daysUp, daysDown, equity };
}

/** Portfolio sizing exactly as the app does it: fractional Kelly with caps. */
function kellyPortfolio(dayRows: Row[], bank: number, filter: (r: Row) => boolean, limits = DEFAULT_LIMITS, target = bank * 0.01) {
  const pool = topPerMatch(dayRows).filter(filter);
  const cands: Candidate[] = pool.map((r) => ({
    id: r.fixture_id, fixtureId: r.fixture_id, price: r.price, prob: probOf(r), score: r.score,
  }));
  const sol = solve(cands, bank, target, limits);
  const byId = new Map(pool.map((r) => [r.fixture_id, r]));
  return sol.picks.map((p) => ({ row: byId.get(p.fixtureId)!, stake: p.stake }));
}

const results: Result[] = [
  run('Every published pick, 1% of bank', (d, b) => d.map((row) => ({ row, stake: b * 0.01 }))),
  run('Top pick per match, 2%', (d, b) => topPerMatch(d).map((row) => ({ row, stake: b * 0.02 }))),
  run('Convergence 70+, 3% of bank', (d, b) => topPerMatch(d).filter((r) => r.score >= 70).map((row) => ({ row, stake: b * 0.03 }))),
  run('Earnings mode - 1% of bank per day', (d, b) => kellyPortfolio(d, b, () => true)),
  run('Bankroll - aggressive', (d, b) =>
    kellyPortfolio(d, b, (r) => r.score >= 68 && r.price >= 1.7 && r.price <= 3.5,
      { ...DEFAULT_LIMITS, kellyMax: 0.5, perBet: 0.2, maxBets: 4 }, b * 0.05)),
  run('Bankroll - balanced', (d, b) =>
    kellyPortfolio(d, b, (r) => r.score >= 62 && r.price >= 1.5 && r.price <= 2.6,
      { ...DEFAULT_LIMITS, kellyMax: 0.25, perBet: 0.08, maxBets: 6 }, b * 0.02)),
  run('Bankroll - light (short prices)', (d, b) =>
    topPerMatch(d).filter((r) => r.price >= 1.18 && r.price <= 1.6 && r.score >= 55)
      .slice(0, 12).map((row) => ({ row, stake: b * 0.04 }))),
];

const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
console.log(`\nPeriod: ${days[0]} - ${days[days.length - 1]} (${days.length} days), ${rows.length} settled bets`);
console.log(`Starting bank: ${START.toLocaleString('en-US')}\n`);
console.log('strategy'.padEnd(34), 'bank'.padStart(9), 'total'.padStart(8), 'bets'.padStart(7), 'hit'.padStart(7), 'ROI'.padStart(8), 'drawdown'.padStart(9), 'days +/-');
for (const r of results) {
  const roi = r.staked ? ((r.bank - START) / r.staked) * 100 : 0;
  console.log(
    r.name.padEnd(34),
    r.bank.toLocaleString('en-US').padStart(9),
    pct(((r.bank - START) / START) * 100).padStart(8),
    String(r.bets).padStart(7),
    (r.bets ? `${Math.round((r.won / r.bets) * 100)}%` : '—').padStart(7),
    pct(roi).padStart(8),
    `${r.maxDrawdown}%`.padStart(9),
    `${r.daysUp}/${r.daysDown}`,
  );
}

const main = results[3];
console.log('\nDay by day (earnings mode):');
console.log(main.equity.map((e) => `${e.day.slice(5)} ${e.bank.toLocaleString('en-US')}`).join('  |  '));
console.log(`\nBest day ${main.bestDay > 0 ? '+' : ''}${main.bestDay}, worst day ${main.worstDay}`);
