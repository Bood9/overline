/**
 * "Заработок" — size today's bets so their expected profit meets a daily target.
 *
 * Pure maths, no DB. The key design choice: a daily target is met by *scaling a
 * fractional-Kelly portfolio*, never by chasing losses or raising stakes after a
 * miss. If the target needs more than half-Kelly or breaks the exposure caps, the
 * plan says so and reports the bank that would be required instead.
 */

export interface Candidate {
  id: number;
  fixtureId: number;
  price: number;
  /** probability used for staking — already shrunk toward the market */
  prob: number;
  score: number;
  meta?: Record<string, unknown>;
}

export interface Limits {
  /** max share of the bank on one bet */
  perBet: number;
  /** max share of the bank at risk across the day */
  exposure: number;
  /** fraction of full Kelly we are ever willing to use */
  kellyMax: number;
  /** smallest stake worth placing, in currency */
  minStake: number;
  maxBets: number;
}

export const DEFAULT_LIMITS: Limits = {
  perBet: 0.1,
  exposure: 0.35,
  kellyMax: 0.5,
  minStake: 10,
  maxBets: 8,
};

export interface StakedPick extends Candidate {
  stake: number;
  kelly: number;
  ev: number;          // expected profit of this bet
  toWin: number;       // profit if it wins
}

export type Feasibility = 'reachable' | 'unreachable' | 'no_edge' | 'invalid';

export interface Solution {
  feasibility: Feasibility;
  lambda: number;              // fraction of full Kelly actually used
  picks: StakedPick[];
  expectedProfit: number;
  exposure: number;
  /** bank at which the target becomes reachable within the limits */
  requiredBank: number | null;
  /** best expected profit achievable within the limits */
  maxExpectedProfit: number;
}

/**
 * How much of our model's disagreement with the market we actually believe.
 *
 * A public-data model that disagrees with a liquid market by 20 points is far
 * more likely wrong than right, so trust decays with the size of the gap:
 * weight = 0.5 / (1 + (gap / 0.10)²). The credited edge peaks at 2.5 points
 * (at a 10-point gap) and shrinks after that; a longshot is also never credited
 * with more than 25% above its market probability.
 */
export function credibleProb(model: number, market: number): number {
  if (!(market > 0 && market < 1)) return Math.max(0.01, Math.min(0.99, model));
  const gap = model - market;
  const weight = 0.5 / (1 + (gap / 0.1) ** 2);
  let p = market + weight * gap;
  p = Math.min(p, market * 1.25);
  return +Math.max(0.01, Math.min(0.99, p)).toFixed(4);
}

export function kelly(p: number, price: number): number {
  const b = price - 1;
  if (b <= 0 || p <= 0) return 0;
  return (p * price - 1) / b;
}

/** Stakes for a given Kelly multiplier, honouring every cap. */
export function stakesAt(
  lambda: number, cands: Candidate[], bank: number, limits: Limits,
): StakedPick[] {
  const raw = cands.map((c) => {
    const k = kelly(c.prob, c.price);
    return { c, k, share: Math.min(Math.max(0, lambda * k), limits.perBet) };
  });
  const total = raw.reduce((a, r) => a + r.share, 0);
  const squeeze = total > limits.exposure ? limits.exposure / total : 1;

  const out: StakedPick[] = [];
  for (const r of raw) {
    const stake = Math.floor(r.share * squeeze * bank);
    if (stake < limits.minStake) continue;
    out.push({
      ...r.c,
      stake,
      kelly: +r.k.toFixed(4),
      ev: +(stake * (r.c.prob * r.c.price - 1)).toFixed(2),
      toWin: +(stake * (r.c.price - 1)).toFixed(2),
    });
  }
  return out;
}

const sumEv = (p: StakedPick[]) => p.reduce((a, x) => a + x.ev, 0);

export function solve(
  cands: Candidate[], bank: number, target: number, limits: Limits = DEFAULT_LIMITS,
): Solution {
  const empty = (f: Feasibility): Solution => ({
    feasibility: f, lambda: 0, picks: [], expectedProfit: 0, exposure: 0,
    requiredBank: null, maxExpectedProfit: 0,
  });
  if (!(bank > 0) || !(target > 0)) return empty('invalid');

  const withEdge = cands
    .filter((c) => c.price > 1 && c.prob > 0 && c.prob < 1 && kelly(c.prob, c.price) > 0)
    .sort((a, b) => kelly(b.prob, b.price) * b.score - kelly(a.prob, a.price) * a.score)
    .slice(0, limits.maxBets);
  if (!withEdge.length) return empty('no_edge');

  const atMax = stakesAt(limits.kellyMax, withEdge, bank, limits);
  const maxEv = sumEv(atMax);
  const exposureOf = (p: StakedPick[]) => p.reduce((a, x) => a + x.stake, 0);

  if (maxEv < target) {
    return {
      feasibility: 'unreachable',
      lambda: limits.kellyMax,
      picks: atMax,
      expectedProfit: +maxEv.toFixed(2),
      exposure: exposureOf(atMax),
      // EV is linear in the bank at a fixed multiplier (caps are shares of the bank)
      requiredBank: maxEv > 0 ? Math.ceil((bank * target) / maxEv) : null,
      maxExpectedProfit: +maxEv.toFixed(2),
    };
  }

  // smallest multiplier whose expected profit covers the target
  let lo = 0, hi = limits.kellyMax;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (sumEv(stakesAt(mid, withEdge, bank, limits)) >= target) hi = mid;
    else lo = mid;
  }
  const picks = stakesAt(hi, withEdge, bank, limits);
  return {
    feasibility: 'reachable',
    lambda: +hi.toFixed(4),
    picks,
    expectedProfit: +sumEv(picks).toFixed(2),
    exposure: exposureOf(picks),
    requiredBank: bank,
    maxExpectedProfit: +maxEv.toFixed(2),
  };
}

/** Small, fast, seedable PRNG — tests need reproducible simulations. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DaySim {
  runs: number;
  pHitTarget: number;
  pLoss: number;
  pAllLost: number;
  expected: number;
  median: number; p10: number; p90: number;
  best: number; worst: number;
}

/** Distribution of one day's profit, bets treated as independent (one per match). */
export function simulateDay(picks: StakedPick[], target: number, runs = 20000, rng = Math.random): DaySim {
  const pnl: number[] = new Array(runs);
  let hit = 0, loss = 0, allLost = 0;
  for (let r = 0; r < runs; r++) {
    let x = 0, wins = 0;
    for (const p of picks) {
      if (rng() < p.prob) { x += p.toWin; wins++; } else x -= p.stake;
    }
    pnl[r] = x;
    if (x >= target) hit++;
    if (x < 0) loss++;
    if (picks.length && wins === 0) allLost++;
  }
  pnl.sort((a, b) => a - b);
  const q = (f: number) => +pnl[Math.min(runs - 1, Math.floor(runs * f))].toFixed(2);
  return {
    runs,
    pHitTarget: +(hit / runs).toFixed(4),
    pLoss: +(loss / runs).toFixed(4),
    pAllLost: +(allLost / runs).toFixed(4),
    expected: +(pnl.reduce((a, b) => a + b, 0) / runs).toFixed(2),
    median: q(0.5), p10: q(0.1), p90: q(0.9),
    best: +picks.reduce((a, p) => a + p.toWin, 0).toFixed(2),
    worst: -picks.reduce((a, p) => a + p.stake, 0),
  };
}

export interface MonthSim {
  days: number;
  avgDaysHit: number;
  pDrawdown50: number;
  medianFinal: number;
  p10Final: number;
  pAboveStart: number;
}

/**
 * Thirty days of the same kind of slate, stakes re-sized to the current bank each
 * day. It answers the question a daily target hides: how often is the target met,
 * and how likely is a deep drawdown on the way.
 */
export function simulateMonth(
  picks: StakedPick[], bank: number, target: number, days = 30, runs = 4000, rng = Math.random,
): MonthSim {
  const finals: number[] = [];
  let hitDaysTotal = 0, drawdowns = 0, above = 0;
  for (let r = 0; r < runs; r++) {
    let b = bank, dd = false;
    for (let d = 0; d < days; d++) {
      if (b <= 0) break;
      const scale = b / bank;
      let dayPnl = 0;
      for (const p of picks) {
        const stake = p.stake * scale;
        dayPnl += rng() < p.prob ? stake * (p.price - 1) : -stake;
      }
      b += dayPnl;
      if (dayPnl >= target) hitDaysTotal++;
      if (b <= bank * 0.5) dd = true;
    }
    finals.push(b);
    if (dd) drawdowns++;
    if (b > bank) above++;
  }
  finals.sort((a, b) => a - b);
  return {
    days,
    avgDaysHit: +(hitDaysTotal / runs).toFixed(1),
    pDrawdown50: +(drawdowns / runs).toFixed(4),
    medianFinal: Math.round(finals[Math.floor(runs / 2)]),
    p10Final: Math.round(finals[Math.floor(runs * 0.1)]),
    pAboveStart: +(above / runs).toFixed(4),
  };
}

export type Verdict = 'realistic' | 'stretch' | 'aggressive' | 'unreachable' | 'no_picks';

export function verdictOf(sol: Solution, day: DaySim | null, bank: number, target: number): {
  verdict: Verdict; title: string; text: string;
} {
  const roi = (target / bank) * 100;
  if (sol.feasibility === 'no_edge' || !sol.picks.length) {
    return {
      verdict: 'no_picks',
      title: 'Сегодня ставить не на что',
      text: 'Ни одна ставка в окне не даёт перевеса после сжатия вероятностей к рынку. Пропустить день — тоже решение.',
    };
  }
  if (sol.feasibility === 'unreachable') {
    return {
      verdict: 'unreachable',
      title: 'Цель недостижима без переставок',
      text: `Максимум в рамках лимитов — около ${Math.round(sol.maxExpectedProfit)} в ожидании. ` +
        (sol.requiredBank ? `Для цели нужен банк примерно ${sol.requiredBank.toLocaleString('ru-RU')}.` : ''),
    };
  }
  const p = day?.pHitTarget ?? 0;
  if (sol.lambda <= 0.25 && p >= 0.45 && roi <= 2) {
    return { verdict: 'realistic', title: 'Реалистичная цель', text: `Цель — ${roi.toFixed(2)}% банка за день, ставки в пределах четверти Келли.` };
  }
  if (sol.lambda <= 0.35) {
    return { verdict: 'stretch', title: 'Цель на пределе', text: `Нужно ${roi.toFixed(2)}% банка в день. Цель достижима в ожидании, но в отдельный день выполняется с вероятностью около ${Math.round(p * 100)}%.` };
  }
  return { verdict: 'aggressive', title: 'Агрессивная цель', text: `Чтобы в ожидании выйти на ${roi.toFixed(2)}% банка, ставки близки к половине Келли — просадки будут глубокими.` };
}
