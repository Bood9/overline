import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  solve, kelly, stakesAt, simulateDay, simulateMonth, mulberry32, verdictOf, DEFAULT_LIMITS, type Candidate,
} from '../src/lib/analytics/earnings-core';

const cand = (id: number, price: number, prob: number, score = 70): Candidate =>
  ({ id, fixtureId: id, price, prob, score });

// a realistic slate: small edges on typical prices
const SLATE = [cand(1, 1.8, 0.6), cand(2, 2.1, 0.52), cand(3, 1.45, 0.73), cand(4, 2.5, 0.43), cand(5, 1.65, 0.64)];

describe('kelly', () => {
  test('fair price gives zero', () => assert.equal(kelly(0.5, 2), 0));
  test('edge gives positive fraction', () => assert.ok(Math.abs(kelly(0.6, 2) - 0.2) < 1e-9));
  test('negative edge stays negative', () => assert.ok(kelly(0.4, 2) < 0));
});

describe('solve', () => {
  test('rejects bad input', () => {
    assert.equal(solve(SLATE, 0, 100).feasibility, 'invalid');
    assert.equal(solve(SLATE, 10000, 0).feasibility, 'invalid');
  });

  test('no edge means no bets', () => {
    const s = solve([cand(1, 2, 0.45), cand(2, 1.5, 0.6)], 10000, 50);
    assert.equal(s.feasibility, 'no_edge');
    assert.equal(s.picks.length, 0);
  });

  test('a modest target is reached with a small Kelly fraction', () => {
    const s = solve(SLATE, 10000, 50);
    assert.equal(s.feasibility, 'reachable');
    assert.ok(s.expectedProfit >= 50, `EV ${s.expectedProfit}`);
    assert.ok(s.lambda < 0.5);
  });

  test('uses the smallest multiplier that covers the target', () => {
    const s = solve(SLATE, 10000, 50);
    const lower = stakesAt(s.lambda * 0.9, SLATE, 10000, DEFAULT_LIMITS).reduce((a, p) => a + p.ev, 0);
    assert.ok(lower < 50, 'a noticeably smaller multiplier should fall short');
  });

  test('an absurd target is reported as unreachable, not forced', () => {
    const s = solve(SLATE, 10000, 5000);
    assert.equal(s.feasibility, 'unreachable');
    assert.ok(s.lambda <= DEFAULT_LIMITS.kellyMax);
    assert.ok(s.requiredBank! > 10000);
  });

  test('required bank really reaches the target', () => {
    const s = solve(SLATE, 10000, 1000);
    assert.equal(s.feasibility, 'unreachable');
    const again = solve(SLATE, s.requiredBank!, 1000);
    assert.equal(again.feasibility, 'reachable');
  });

  test('caps: no bet above 10% of bank, day exposure at most 35%', () => {
    const big = [cand(1, 3, 0.6), cand(2, 3, 0.6), cand(3, 3, 0.6), cand(4, 3, 0.6), cand(5, 3, 0.6)];
    const s = solve(big, 10000, 100000);
    for (const p of s.picks) assert.ok(p.stake <= 1000, `stake ${p.stake}`);
    assert.ok(s.exposure <= 3500, `exposure ${s.exposure}`);
  });

  test('stakes below the minimum are dropped', () => {
    const s = solve(SLATE, 200, 1);
    for (const p of s.picks) assert.ok(p.stake >= DEFAULT_LIMITS.minStake);
  });

  test('never more than maxBets', () => {
    const many = Array.from({ length: 20 }, (_, i) => cand(i + 1, 1.9, 0.56));
    assert.ok(solve(many, 100000, 200).picks.length <= DEFAULT_LIMITS.maxBets);
  });
});

describe('simulation', () => {
  test('is reproducible with a seed', () => {
    const s = solve(SLATE, 10000, 50);
    const a = simulateDay(s.picks, 50, 5000, mulberry32(7));
    const b = simulateDay(s.picks, 50, 5000, mulberry32(7));
    assert.deepEqual(a, b);
  });

  test('simulated mean converges to the analytic expected profit', () => {
    const s = solve(SLATE, 10000, 50);
    const d = simulateDay(s.picks, 50, 60000, mulberry32(42));
    const tolerance = Math.max(3, s.expectedProfit * 0.15);
    assert.ok(Math.abs(d.expected - s.expectedProfit) < tolerance,
      `sim ${d.expected} vs analytic ${s.expectedProfit}`);
  });

  test('bounds: worst case is losing every stake, best is winning every bet', () => {
    const s = solve(SLATE, 10000, 50);
    const d = simulateDay(s.picks, 50, 2000, mulberry32(1));
    assert.equal(d.worst, -s.exposure);
    assert.ok(d.p10 >= d.worst && d.p90 <= d.best);
  });

  test('expected profit ≥ target does not mean the target is hit most days', () => {
    const s = solve(SLATE, 10000, 80);
    const d = simulateDay(s.picks, 80, 20000, mulberry32(3));
    assert.ok(d.pHitTarget < 0.9, `pHit ${d.pHitTarget}`);
  });

  test('month simulation stays inside sane ranges', () => {
    const s = solve(SLATE, 10000, 50);
    const m = simulateMonth(s.picks, 10000, 50, 30, 2000, mulberry32(9));
    assert.ok(m.avgDaysHit >= 0 && m.avgDaysHit <= 30);
    assert.ok(m.pDrawdown50 >= 0 && m.pDrawdown50 <= 1);
    assert.ok(m.p10Final <= m.medianFinal);
  });
});

describe('verdict', () => {
  test('no picks', () => {
    const v = verdictOf(solve([cand(1, 2, 0.4)], 10000, 50), null, 10000, 50);
    assert.equal(v.verdict, 'no_picks');
  });
  test('unreachable carries the required bank', () => {
    const s = solve(SLATE, 10000, 5000);
    const v = verdictOf(s, simulateDay(s.picks, 5000, 1000, mulberry32(1)), 10000, 5000);
    assert.equal(v.verdict, 'unreachable');
    assert.match(v.text, /банк/);
  });
});

import { credibleProb } from '../src/lib/analytics/earnings-core';

describe('credibleProb', () => {
  test('agreement is left alone', () => assert.equal(credibleProb(0.5, 0.5), 0.5));
  test('never credits more than ~2.5 points over the market', () => {
    for (const gap of [0.02, 0.05, 0.1, 0.2, 0.3, 0.45]) {
      const p = credibleProb(0.4 + gap, 0.4);
      assert.ok(p - 0.4 <= 0.0251, `gap ${gap} -> credited ${(p - 0.4).toFixed(4)}`);
      assert.ok(p >= 0.4);
    }
  });
  test('a wild disagreement is trusted less than a moderate one', () =>
    assert.ok(credibleProb(0.8, 0.5) - 0.5 < credibleProb(0.6, 0.5) - 0.5));
  test('longshots are capped at +25% of their market probability', () =>
    assert.ok(credibleProb(0.27, 0.07) <= 0.0875 + 1e-9));
  test('symmetric when the model is below the market', () =>
    assert.ok(credibleProb(0.3, 0.5) < 0.5 && credibleProb(0.3, 0.5) >= 0.475));
});
