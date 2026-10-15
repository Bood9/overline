/**
 * Staking plans over today's convergence picks.
 *
 * The three profiles differ in what they select and how hard they stake, not in
 * the underlying probabilities. Kelly is always applied to a *shrunk* estimate
 * (half model, half market) — a raw model edge is the fastest way to overbet.
 */
import { all } from '@/lib/db';
import { marketLabel } from '@/lib/types';
import { credibleProb } from './earnings-core';

export type StrategyKey = 'aggressive' | 'balanced' | 'light';

export interface Strategy {
  key: StrategyKey;
  name: string;
  tagline: string;
  description: string;
  minScore: number;
  odds: [number, number];
  kellyFraction: number;   // 0 = flat staking
  flatStake: number;       // share of bank when kellyFraction = 0
  maxStake: number;        // hard cap, share of bank
  maxBets: number;
  risk: 'высокий' | 'средний' | 'низкий';
}

export const STRATEGIES: Record<StrategyKey, Strategy> = {
  aggressive: {
    key: 'aggressive',
    name: 'Агрессивная',
    tagline: 'Быстрый ×2–×3, мало ставок, крупные доли',
    description:
      'Берём только самые сильные схождения на средних коэффициентах и ставим половину Келли. ' +
      'Банк растёт быстро при удачной серии и так же быстро тает при неудачной.',
    minScore: 68, odds: [1.7, 3.5], kellyFraction: 0.5, flatStake: 0, maxStake: 0.2, maxBets: 4,
    risk: 'высокий',
  },
  balanced: {
    key: 'balanced',
    name: 'Баланс',
    tagline: 'Четверть Келли, умеренные коэффициенты',
    description:
      'Компромисс: ставим там, где модель расходится с рынком, но долей в четверть Келли. ' +
      'Просадки заметно мягче, рост медленнее.',
    minScore: 62, odds: [1.5, 2.6], kellyFraction: 0.25, flatStake: 0, maxStake: 0.08, maxBets: 6,
    risk: 'средний',
  },
  light: {
    key: 'light',
    name: 'Лайт · поток',
    tagline: 'Много ставок на низкие коэффициенты, берём количеством',
    description:
      'Фиксированная доля банка на каждый низкий коэффициент. Каждая ставка почти ничего не решает, ' +
      'результат набирается объёмом. Главный риск — редкий, но болезненный промах на 1.2.',
    minScore: 55, odds: [1.18, 1.6], kellyFraction: 0, flatStake: 0.04, maxStake: 0.06, maxBets: 12,
    risk: 'низкий',
  },
};

export interface PlanPick {
  insight_id: number; fixture_id: number;
  home: string; away: string; league: string; kickoff: string;
  label: string; market: string; marketRu: string;
  price: number; score: number;
  modelProb: number; marketProb: number | null; usedProb: number;
  edgePp: number;
  stake: number; stakeShare: number;
  toWin: number;
  signals: { source: string; text: string }[];
}

export interface Simulation {
  runs: number;
  median: number; p10: number; p90: number;
  pGoal: number; pHalved: number; pProfit: number;
  expected: number; roundsToGoal: number | null;
}

export interface Plan {
  strategy: Strategy;
  bank: number; goal: number;
  picks: PlanPick[];
  totalStake: number; totalStakeShare: number;
  bestCase: number; worstCase: number;
  expectedValue: number;
  simulation: Simulation | null;
  note: string;
}

const kelly = (p: number, price: number) => {
  const b = price - 1;
  if (b <= 0) return 0;
  return (p * (b + 1) - 1) / b;
};

interface Row {
  id: number; fixture_id: number; label: string; market: string; line: number; selection: string;
  score: number; price: number; edge: number | null; model_prob: number | null; market_prob: number | null;
  signals: string; kickoff: string; league: string; home: string; away: string;
}

function candidates(strategy: Strategy, day: 'today' | 'tomorrow'): Row[] {
  return all<Row>(
    `WITH ranked AS (
       SELECT i.*, ROW_NUMBER() OVER (PARTITION BY i.fixture_id ORDER BY i.score DESC) rn
         FROM insights i JOIN fixtures f ON f.id = i.fixture_id
        WHERE f.status='NS'
          AND date(f.kickoff) = date('now'${day === 'tomorrow' ? ",'+1 day'" : ''})
          AND datetime(f.kickoff) > datetime('now')
          AND i.price BETWEEN @lo AND @hi
          AND i.score >= @minScore
          AND i.model_prob IS NOT NULL
     )
     SELECT r.id, r.fixture_id, r.label, r.market, r.line, r.selection, r.score, r.price, r.edge,
            r.model_prob, r.market_prob, r.signals, f.kickoff,
            COALESCE(l.name_ru,l.name) AS league,
            COALESCE(th.name_ru,th.name) AS home, COALESCE(ta.name_ru,ta.name) AS away
       FROM ranked r
       JOIN fixtures f ON f.id = r.fixture_id
       JOIN teams th ON th.id = f.home_id JOIN teams ta ON ta.id = f.away_id
       LEFT JOIN leagues l ON l.id = f.league_id
      WHERE r.rn = 1
      ORDER BY r.score DESC
      LIMIT @limit`,
    { lo: strategy.odds[0], hi: strategy.odds[1], minScore: strategy.minScore, limit: strategy.maxBets },
  );
}

export function buildPlan(
  bank: number, strategyKey: StrategyKey, goalMultiplier = 2, day: 'today' | 'tomorrow' = 'today',
): Plan {
  const strategy = STRATEGIES[strategyKey] ?? STRATEGIES.balanced;
  const rows = candidates(strategy, day);

  const picks: PlanPick[] = [];
  for (const r of rows) {
    const model = r.model_prob ?? 0;
    const market = r.market_prob ?? 1 / r.price;
    // trust decays with the size of the disagreement — see credibleProb
    const usedProb = credibleProb(model, market);

    let share: number;
    if (strategy.kellyFraction > 0) {
      const k = kelly(usedProb, r.price) * strategy.kellyFraction;
      if (k <= 0.005) continue;             // no edge after shrinking — skip
      share = Math.min(k, strategy.maxStake);
    } else {
      if (usedProb * r.price <= 1.0) continue;
      share = Math.min(strategy.flatStake, strategy.maxStake);
    }

    const stake = Math.round(bank * share);
    if (stake < 1) continue;
    picks.push({
      insight_id: r.id, fixture_id: r.fixture_id,
      home: r.home, away: r.away, league: r.league, kickoff: r.kickoff,
      label: r.label, market: r.market, marketRu: marketLabel(r.market),
      price: r.price, score: r.score,
      modelProb: +model.toFixed(4), marketProb: +market.toFixed(4), usedProb: +usedProb.toFixed(4),
      edgePp: +((usedProb - market) * 100).toFixed(1),
      stake, stakeShare: +(share * 100).toFixed(1),
      toWin: Math.round(stake * (r.price - 1)),
      signals: (JSON.parse(r.signals || '[]') as any[]).map((s) => ({ source: s.source, text: s.text })),
    });
  }

  const totalStake = picks.reduce((a, p) => a + p.stake, 0);
  const bestCase = bank + picks.reduce((a, p) => a + p.toWin, 0);
  const worstCase = bank - totalStake;
  const expectedValue = picks.reduce((a, p) => a + (p.usedProb * p.toWin - (1 - p.usedProb) * p.stake), 0);

  return {
    strategy, bank, goal: bank * goalMultiplier,
    picks, totalStake, totalStakeShare: bank ? +((totalStake / bank) * 100).toFixed(1) : 0,
    bestCase, worstCase, expectedValue: Math.round(expectedValue),
    simulation: picks.length ? simulate(bank, picks, bank * goalMultiplier, strategy) : null,
    note: picks.length
      ? 'Чем сильнее модель спорит с рынком, тем меньше ей верим: перевес над рынком ограничен ~2.5 п.п.'
      : 'Под фильтры этой стратегии сегодня ничего не подошло. Это нормальный результат, а не ошибка.',
  };
}

/** Monte-Carlo over repeated days of the same plan. */
function simulate(bank: number, picks: PlanPick[], goal: number, strategy: Strategy, runs = 4000, days = 20): Simulation {
  const finals: number[] = [];
  let goalHits = 0, halved = 0, profit = 0;
  let roundsSum = 0, roundsCount = 0;

  for (let r = 0; r < runs; r++) {
    let b = bank;
    let hitDay: number | null = null;
    for (let d = 0; d < days; d++) {
      if (b < bank * 0.02) break;
      const scale = b / bank;                        // stakes follow the bank
      for (const p of picks) {
        const stake = Math.min(b, p.stake * scale);
        if (stake <= 0) continue;
        b -= stake;
        if (Math.random() < p.usedProb) b += stake * p.price;
      }
      if (hitDay === null && b >= goal) { hitDay = d + 1; }
      if (b >= goal) break;
    }
    finals.push(b);
    if (b >= goal) { goalHits++; if (hitDay) { roundsSum += hitDay; roundsCount++; } }
    if (b <= bank * 0.5) halved++;
    if (b > bank) profit++;
  }

  finals.sort((a, b) => a - b);
  const at = (q: number) => Math.round(finals[Math.floor(finals.length * q)]);
  return {
    runs,
    median: at(0.5), p10: at(0.1), p90: at(0.9),
    pGoal: +((goalHits / runs) * 100).toFixed(1),
    pHalved: +((halved / runs) * 100).toFixed(1),
    pProfit: +((profit / runs) * 100).toFixed(1),
    expected: Math.round(finals.reduce((a, b) => a + b, 0) / runs),
    roundsToGoal: roundsCount ? Math.round(roundsSum / roundsCount) : null,
  };
}
