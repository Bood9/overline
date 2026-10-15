/**
 * Settling a bet from a final score. Pure — no DB, fully unit-tested.
 *
 * Asian lines (x.25 / x.75) are split into two half-stakes on the neighbouring
 * lines, the way bookmakers settle them. `factor` is the payout as a multiple
 * of the stake: 0 = lost, 1 = refunded, price = won in full.
 */

export type Outcome = 'won' | 'lost' | 'void' | 'half_won' | 'half_lost';

export interface Settlement { outcome: Outcome; factor: number }

type Result = 'win' | 'push' | 'loss';

function single(margin: number): Result {
  if (Math.abs(margin) < 1e-9) return 'push';
  return margin > 0 ? 'win' : 'loss';
}

/** Split quarter lines: 2.25 -> [2, 2.5], -0.75 -> [-0.5, -1]. */
function splitLine(line: number): number[] {
  const frac = Math.abs(line * 4) % 2;
  if (frac !== 1) return [line];
  return [line - 0.25, line + 0.25];
}

function combine(results: Result[], price: number): Settlement {
  if (results.length === 1) {
    const r = results[0];
    if (r === 'win') return { outcome: 'won', factor: price };
    if (r === 'push') return { outcome: 'void', factor: 1 };
    return { outcome: 'lost', factor: 0 };
  }
  // two half-stakes
  const part = (r: Result) => (r === 'win' ? price : r === 'push' ? 1 : 0);
  const factor = (part(results[0]) + part(results[1])) / 2;
  const wins = results.filter((r) => r === 'win').length;
  const losses = results.filter((r) => r === 'loss').length;
  let outcome: Outcome;
  if (wins === 2) outcome = 'won';
  else if (losses === 2) outcome = 'lost';
  else if (wins === 1 && losses === 0) outcome = 'half_won';
  else if (losses === 1 && wins === 0) outcome = 'half_lost';
  else outcome = factor >= 1 ? 'half_won' : 'half_lost';
  return { outcome, factor: +factor.toFixed(4) };
}

/**
 * @returns null when the market cannot be settled from a score alone
 *          (corners, cards, fouls need box-score data).
 */
export function settleBet(
  market: string, line: number, selection: string, price: number,
  goalsHome: number, goalsAway: number,
): Settlement | null {
  const h = goalsHome, a = goalsAway, total = h + a;
  switch (market) {
    case '1X2': {
      const actual = h > a ? 'HOME' : h < a ? 'AWAY' : 'DRAW';
      return actual === selection ? { outcome: 'won', factor: price } : { outcome: 'lost', factor: 0 };
    }
    case 'ML': {
      if (h === a) return { outcome: 'void', factor: 1 };
      const actual = h > a ? 'HOME' : 'AWAY';
      return actual === selection ? { outcome: 'won', factor: price } : { outcome: 'lost', factor: 0 };
    }
    case 'DC': {
      const win =
        (selection === 'HOME_DRAW' && h >= a) ||
        (selection === 'DRAW_AWAY' && a >= h) ||
        (selection === 'HOME_AWAY' && h !== a);
      return win ? { outcome: 'won', factor: price } : { outcome: 'lost', factor: 0 };
    }
    case 'DNB': {
      if (h === a) return { outcome: 'void', factor: 1 };
      const actual = h > a ? 'HOME' : 'AWAY';
      return actual === selection ? { outcome: 'won', factor: price } : { outcome: 'lost', factor: 0 };
    }
    case 'BTTS': {
      const both = h > 0 && a > 0;
      const win = (selection === 'YES') === both;
      return win ? { outcome: 'won', factor: price } : { outcome: 'lost', factor: 0 };
    }
    case 'OU': {
      const results = splitLine(line).map((l) =>
        single(selection === 'OVER' ? total - l : l - total),
      );
      return combine(results, price);
    }
    case 'AH': {
      // the stored line belongs to the selected side
      const results = splitLine(line).map((l) =>
        single(selection === 'HOME' ? h + l - a : a + l - h),
      );
      return combine(results, price);
    }
    default:
      return null;
  }
}

/** Statuses where a score-based settlement is final. */
export const SETTLEABLE = new Set(['FT']);
/**
 * Extra time and penalties change the score but bookmakers settle football
 * markets on 90 minutes — we do not have the 90-minute score, so these are voided
 * rather than settled on the wrong number.
 */
export const VOID_STATUSES = new Set(['AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO']);
