import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { settleBet } from '../src/lib/analytics/settle';

const s = (m: string, line: number, sel: string, h: number, a: number, price = 2) =>
  settleBet(m, line, sel, price, h, a);

describe('1X2', () => {
  test('home win', () => assert.deepEqual(s('1X2', 0, 'HOME', 2, 1), { outcome: 'won', factor: 2 }));
  test('home loses on a draw', () => assert.equal(s('1X2', 0, 'HOME', 1, 1)!.outcome, 'lost'));
  test('draw', () => assert.equal(s('1X2', 0, 'DRAW', 0, 0)!.outcome, 'won'));
  test('away', () => assert.equal(s('1X2', 0, 'AWAY', 0, 3)!.outcome, 'won'));
});

describe('double chance', () => {
  test('1X covers a draw', () => assert.equal(s('DC', 0, 'HOME_DRAW', 1, 1)!.outcome, 'won'));
  test('1X loses to away', () => assert.equal(s('DC', 0, 'HOME_DRAW', 0, 1)!.outcome, 'lost'));
  test('12 loses on a draw', () => assert.equal(s('DC', 0, 'HOME_AWAY', 2, 2)!.outcome, 'lost'));
  test('X2 covers away', () => assert.equal(s('DC', 0, 'DRAW_AWAY', 0, 2)!.outcome, 'won'));
});

describe('totals', () => {
  test('over 2.5 with 3 goals', () => assert.equal(s('OU', 2.5, 'OVER', 2, 1)!.outcome, 'won'));
  test('under 2.5 with 3 goals', () => assert.equal(s('OU', 2.5, 'UNDER', 2, 1)!.outcome, 'lost'));
  test('whole line pushes', () => assert.deepEqual(s('OU', 2, 'OVER', 1, 1), { outcome: 'void', factor: 1 }));
  test('over 2.25 with exactly 2 goals: half lost', () =>
    assert.deepEqual(s('OU', 2.25, 'OVER', 1, 1, 1.9), { outcome: 'half_lost', factor: 0.5 }));
  test('over 2.75 with 3 goals: half won', () =>
    assert.deepEqual(s('OU', 2.75, 'OVER', 2, 1, 2), { outcome: 'half_won', factor: 1.5 }));
});

describe('both teams to score', () => {
  test('yes', () => assert.equal(s('BTTS', 0, 'YES', 1, 1)!.outcome, 'won'));
  test('yes fails on a clean sheet', () => assert.equal(s('BTTS', 0, 'YES', 2, 0)!.outcome, 'lost'));
  test('no', () => assert.equal(s('BTTS', 0, 'NO', 0, 0)!.outcome, 'won'));
});

describe('handicap', () => {
  test('home -1 wins by two', () => assert.equal(s('AH', -1, 'HOME', 3, 1)!.outcome, 'won'));
  test('home -1 wins by one: push', () => assert.equal(s('AH', -1, 'HOME', 2, 1)!.outcome, 'void'));
  test('away +0.5 on a draw', () => assert.equal(s('AH', 0.5, 'AWAY', 1, 1)!.outcome, 'won'));
  test('home -0.75 wins by one: half won', () =>
    assert.deepEqual(s('AH', -0.75, 'HOME', 1, 0, 2), { outcome: 'half_won', factor: 1.5 }));
});

describe('two-way winner', () => {
  test('draw is refunded', () => assert.equal(s('ML', 0, 'HOME', 2, 2)!.outcome, 'void'));
  test('away wins', () => assert.equal(s('ML', 0, 'AWAY', 90, 101)!.outcome, 'won'));
});

test('score-only settlement refuses corners', () => assert.equal(s('CORNERS', 9.5, 'OVER', 1, 0), null));
