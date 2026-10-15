/**
 * End-to-end over a throwaway SQLite file: seed matches and insights, commit a
 * plan, finish the matches, and check the journal settles itself correctly.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DB = path.join(os.tmpdir(), `overline-test-${process.pid}.db`);
process.env.DB_PATH = DB;

// imported after DB_PATH is set — the connection is created lazily on first use
let E: typeof import('../src/lib/analytics/earnings');
let D: typeof import('../src/lib/db');
let T: typeof import('../src/lib/util/time');

const iso = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3.6e6).toISOString();

function seedMatch(id: number, kickoff: string, market: string, selection: string, line: number,
  price: number, modelProb: number, marketProb: number, score = 75) {
  const { run } = D;
  run(`INSERT OR IGNORE INTO leagues(id,name,tier) VALUES(1,'Test League',1)`);
  run(`INSERT OR IGNORE INTO teams(id,name,name_ru) VALUES(@h,@hn,@hn),(@a,@an,@an)`,
    { h: id * 10 + 1, hn: `Home ${id}`, a: id * 10 + 2, an: `Away ${id}` });
  run(`INSERT INTO fixtures(id,league_id,kickoff,status,home_id,away_id,sport)
       VALUES(@id,1,@k,'NS',@h,@a,'football')`, { id, k: kickoff, h: id * 10 + 1, a: id * 10 + 2 });
  run(`INSERT INTO insights(fixture_id,market,line,selection,label,category,score,price,edge,model_prob,market_prob,signals)
       VALUES(@id,@m,@l,@s,'x','outcome',@score,@p,5,@mp,@kp,'[]')`,
    { id, m: market, l: line, s: selection, score, p: price, mp: modelProb, kp: marketProb });
}

function finish(id: number, gh: number, ga: number, status = 'FT') {
  D.run(`UPDATE fixtures SET status=@s, goals_home=@gh, goals_away=@ga WHERE id=@id`, { s: status, gh, ga, id });
}

describe('earnings journal', () => {
  let day: string;

  before(async () => {
    D = await import('../src/lib/db');
    E = await import('../src/lib/analytics/earnings');
    T = await import('../src/lib/util/time');
    day = T.todayISO();
    // kick-offs a few hours out but still today in the display timezone is not
    // guaranteed late in the evening — plan for tomorrow, which always has room
    day = T.shiftISO(day, 1);
    const tomorrowNoonUtc = (h: number) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00Z`).toISOString();
    // value exists only where the offered price beats the market's fair price
    seedMatch(1, tomorrowNoonUtc(10), '1X2', 'HOME', 0, 2.15, 0.60, 0.50);
    seedMatch(2, tomorrowNoonUtc(12), 'OU', 'OVER', 2.5, 2.2, 0.56, 0.48);
    seedMatch(3, tomorrowNoonUtc(14), 'BTTS', 'YES', 0, 2.0, 0.60, 0.53);
    seedMatch(4, tomorrowNoonUtc(15), 'DC', 'HOME_DRAW', 0, 1.5, 0.78, 0.72);
    // model likes it, but the price carries the bookmaker's margin — negative after credibility
    seedMatch(5, tomorrowNoonUtc(16), '1X2', 'AWAY', 0, 1.9, 0.62, 0.50);
    // a corners pick cannot be settled from the score — must be excluded
    seedMatch(6, tomorrowNoonUtc(17), 'CORNERS', 'OVER', 9.5, 1.9, 0.7, 0.5);
  });

  after(() => { for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) fs.rmSync(f, { force: true }); });

  test('candidates: only positive-edge, score-settleable picks', () => {
    const c = E.candidatesFor(day);
    const ids = c.map((x) => x.fixtureId).sort();
    assert.deepEqual(ids, [1, 2, 3, 4]);
  });

  test('plan for a modest target is reachable and within limits', () => {
    const plan = E.buildEarningsPlan({ balance: 10000, target: 60, day });
    assert.equal(plan.solution.feasibility, 'reachable');
    assert.ok(plan.solution.expectedProfit >= 60);
    assert.ok(plan.solution.exposure <= 3500);
    assert.ok(plan.daySim && plan.daySim.pHitTarget > 0 && plan.daySim.pHitTarget < 1);
  });

  test('an impossible target is flagged, never forced', () => {
    const plan = E.buildEarningsPlan({ balance: 10000, target: 3000, day });
    assert.equal(plan.solution.feasibility, 'unreachable');
    assert.equal(plan.verdict.verdict, 'unreachable');
  });

  test('commit freezes server-computed stakes', () => {
    const d = E.commitPlan({ balance: 10000, target: 60, day });
    assert.equal(d.status, 'open');
    assert.ok(d.bets.length >= 2);
    assert.equal(d.pending, d.bets.length);
    assert.ok(d.bets.every((b) => b.stake >= 10));
  });

  test('re-commit before kick-off replaces the plan instead of duplicating it', () => {
    const before = E.getDay(day)!.bets.length;
    const again = E.commitPlan({ balance: 10000, target: 60, day });
    assert.equal(again.bets.length, before);
    assert.equal(D.one<{ n: number }>('SELECT COUNT(*) n FROM earn_days')!.n, 1);
  });

  test('settlement computes each bet from the real score', () => {
    const d = E.getDay(day)!;
    finish(1, 2, 0);            // HOME win
    finish(2, 1, 0);            // OVER 2.5 loses
    finish(3, 1, 1);            // BTTS yes wins
    finish(4, 0, 0, 'AET');     // extra time → void
    E.settlePending();

    const after = E.getDay(day)!;
    const byFx = new Map(after.bets.map((b) => [b.fixture_id, b]));
    const exp: Record<number, string> = { 1: 'won', 2: 'lost', 3: 'won', 4: 'void' };
    for (const b of d.bets) assert.equal(byFx.get(b.fixture_id)!.status, exp[b.fixture_id], `fixture ${b.fixture_id}`);

    // pnl is exactly Σ(payout − stake)
    const expected = after.bets.reduce((a, b) => {
      if (b.status === 'won') return a + b.stake * (b.price - 1);
      if (b.status === 'lost') return a - b.stake;
      return a;
    }, 0);
    assert.ok(Math.abs(after.pnl - expected) < 0.05, `pnl ${after.pnl} vs ${expected}`);
    assert.equal(after.status, 'settled');
    assert.ok(Math.abs(after.balance_end! - (10000 + after.pnl)) < 0.05);
  });

  test('settling twice changes nothing', () => {
    const snap = JSON.stringify(E.getDay(day));
    const r = E.settlePending();
    assert.deepEqual(r, { settled: 0, voided: 0 });
    assert.equal(JSON.stringify(E.getDay(day)), snap);
  });

  test('a day whose matches have started cannot be overwritten', () => {
    D.run(`UPDATE fixtures SET kickoff=@k WHERE id IN (1,2,3,4)`, { k: iso(-5) });
    assert.throws(() => E.commitPlan({ balance: 10000, target: 60, day }), /изменить нельзя|нет ставок/);
  });

  test('journal summary adds up', () => {
    const j = E.getJournal();
    assert.equal(j.days.length, 1);
    assert.equal(j.settledDays, 1);
    assert.equal(j.bets.pending, 0);
    assert.ok(Math.abs(j.currentBalance! - (10000 + j.totalPnl)) < 0.05);
    assert.ok(j.roi !== null);
  });

  test('matches abandoned for 3+ days are refunded', () => {
    const d2 = T.shiftISO(day, 1);
    seedMatch(7, new Date(`${d2}T12:00:00Z`).toISOString(), '1X2', 'HOME', 0, 2.15, 0.6, 0.5);
    E.commitPlan({ balance: 10000, target: 5, day: d2 });
    D.run(`UPDATE fixtures SET kickoff=@k WHERE id=7`, { k: iso(-80) });
    E.settlePending();
    const b = E.getDay(d2)!.bets[0];
    assert.equal(b.status, 'void');
    assert.equal(b.payout, b.stake);
  });
});
