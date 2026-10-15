/**
 * DB side of "Заработок": candidates from today's insights, the committed plan,
 * and a journal that settles itself from real final scores.
 */
import { all, one, run, tx, logIngest } from '@/lib/db';
import { selectionLabel, marketLabel } from '@/lib/types';
import { todayISO, shiftISO } from '@/lib/util/time';
import { dayBoundsUtc } from '@/lib/util/tz';
import {
  solve, simulateDay, simulateMonth, verdictOf, credibleProb, DEFAULT_LIMITS,
  type Candidate, type Solution, type DaySim, type MonthSim,
} from './earnings-core';
import { settleBet, SETTLEABLE, VOID_STATUSES } from './settle';

/** Markets we can settle from a final score — nothing else goes into a plan. */
const SETTLEABLE_MARKETS = ['1X2', 'DC', 'OU', 'BTTS', 'AH'];
const MIN_SCORE = 55;
/** do not plan a match that kicks off in the next few minutes */
const LEAD_MINUTES = 10;

export interface PickMeta {
  insightId: number; market: string; line: number; selection: string;
  label: string; marketRu: string;
  home: string; away: string; league: string; kickoff: string;
  modelProb: number; marketProb: number;
  signals: { source: string; text: string }[];
}

interface Row {
  id: number; fixture_id: number; market: string; line: number; selection: string;
  score: number; price: number; model_prob: number; market_prob: number | null; signals: string;
  kickoff: string; league: string; home: string; away: string;
}

export function candidatesFor(day: string): Candidate[] {
  const { start, end } = dayBoundsUtc(day);
  const rows = all<Row>(
    `SELECT i.id, i.fixture_id, i.market, i.line, i.selection, i.score, i.price,
            i.model_prob, i.market_prob, i.signals, f.kickoff,
            COALESCE(l.name_ru,l.name) AS league,
            COALESCE(th.name_ru,th.name) AS home, COALESCE(ta.name_ru,ta.name) AS away
       FROM insights i
       JOIN fixtures f ON f.id = i.fixture_id
       JOIN teams th ON th.id = f.home_id JOIN teams ta ON ta.id = f.away_id
       LEFT JOIN leagues l ON l.id = f.league_id
      WHERE f.sport = 'football' AND f.status = 'NS'
        AND datetime(f.kickoff) >= @start AND datetime(f.kickoff) < @end
        AND datetime(f.kickoff) > datetime('now', @lead)
        AND i.market IN (${SETTLEABLE_MARKETS.map((m) => `'${m}'`).join(',')})
        AND i.price > 1 AND i.model_prob IS NOT NULL AND i.score >= @minScore`,
    { start, end, lead: `+${LEAD_MINUTES} minutes`, minScore: MIN_SCORE },
  );

  // one pick per match: bets on the same game are correlated, the maths assumes they are not
  const best = new Map<number, Candidate>();
  for (const r of rows) {
    const market = r.market_prob ?? 1 / r.price;
    const prob = credibleProb(r.model_prob, market);
    const edge = prob * r.price - 1;
    if (edge <= 0) continue;
    const c: Candidate = {
      id: r.id, fixtureId: r.fixture_id, price: r.price, prob: +prob.toFixed(4), score: r.score,
      meta: {
        insightId: r.id, market: r.market, line: r.line, selection: r.selection,
        label: selectionLabel(r.market, r.line, r.selection), marketRu: marketLabel(r.market),
        home: r.home, away: r.away, league: r.league, kickoff: r.kickoff,
        modelProb: r.model_prob, marketProb: +market.toFixed(4),
        signals: (JSON.parse(r.signals || '[]') as any[]).map((s) => ({ source: s.source, text: s.text })),
      } satisfies PickMeta,
    };
    const prev = best.get(r.fixture_id);
    if (!prev || c.score > prev.score || (c.score === prev.score && edge > prev.prob * prev.price - 1)) {
      best.set(r.fixture_id, c);
    }
  }
  return [...best.values()];
}

export interface EarningsPlan {
  day: string; balance: number; target: number;
  candidates: number;
  solution: Solution;
  daySim: DaySim | null;
  monthSim: MonthSim | null;
  /** the same month if our probabilities are no better than the market's */
  monthSimNoEdge: MonthSim | null;
  verdict: ReturnType<typeof verdictOf>;
  committed: JournalDay | null;
  limits: typeof DEFAULT_LIMITS;
}

export function allowedDays(): string[] {
  const t = todayISO();
  return [t, shiftISO(t, 1), shiftISO(t, 2)];
}

export function buildEarningsPlan(input: { balance: number; target: number; day?: string; seed?: () => number }): EarningsPlan {
  const day = input.day && allowedDays().includes(input.day) ? input.day : todayISO();
  const cands = candidatesFor(day);
  const solution = solve(cands, input.balance, input.target);
  const daySim = solution.picks.length ? simulateDay(solution.picks, input.target, 20000, input.seed) : null;
  const monthSim = solution.picks.length
    ? simulateMonth(solution.picks, input.balance, input.target, 30, 3000, input.seed)
    : null;
  const noEdgePicks = solution.picks.map((p) => ({
    ...p, prob: (p.meta as unknown as PickMeta)?.marketProb ?? 1 / p.price,
  }));
  const monthSimNoEdge = solution.picks.length
    ? simulateMonth(noEdgePicks, input.balance, input.target, 30, 3000, input.seed)
    : null;
  return {
    day, balance: input.balance, target: input.target,
    candidates: cands.length,
    solution, daySim, monthSim, monthSimNoEdge,
    verdict: verdictOf(solution, daySim, input.balance, input.target),
    committed: getDay(day),
    limits: DEFAULT_LIMITS,
  };
}

/* ---------------------------- journal ---------------------------- */

export interface JournalBet {
  id: number; fixture_id: number; market: string; line: number; selection: string; label: string;
  price: number; stake: number; prob: number; status: string; payout: number | null; note: string | null;
  home: string; away: string; kickoff: string; fixture_status: string;
  goals_home: number | null; goals_away: number | null;
}
export interface JournalDay {
  day: string; balance_start: number; target: number; lambda: number | null; expected: number | null;
  p_hit: number | null; status: string; pnl: number; balance_end: number | null; committed_at: string;
  bets: JournalBet[];
  pending: number; atRisk: number; hitTarget: boolean | null;
}

function betsOf(day: string): JournalBet[] {
  return all<JournalBet>(
    `SELECT b.*, COALESCE(th.name_ru,th.name) AS home, COALESCE(ta.name_ru,ta.name) AS away,
            f.kickoff, f.status AS fixture_status, f.goals_home, f.goals_away
       FROM earn_bets b
       JOIN fixtures f ON f.id = b.fixture_id
       JOIN teams th ON th.id = f.home_id JOIN teams ta ON ta.id = f.away_id
      WHERE b.day = @day ORDER BY f.kickoff, b.id`,
    { day },
  );
}

export function getDay(day: string): JournalDay | null {
  const d = one<Omit<JournalDay, 'bets' | 'pending' | 'atRisk' | 'hitTarget'>>(
    'SELECT * FROM earn_days WHERE day = @day', { day },
  );
  if (!d) return null;
  const bets = betsOf(day);
  const pendingBets = bets.filter((b) => b.status === 'pending');
  return {
    ...d, bets,
    pending: pendingBets.length,
    atRisk: pendingBets.reduce((a, b) => a + b.stake, 0),
    hitTarget: d.status === 'settled' ? d.pnl >= d.target : null,
  };
}

export class EarningsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/**
 * Freeze the plan for a day. Stakes are recomputed here from server-side data —
 * the client only sends balance, target and day.
 */
export function commitPlan(input: { balance: number; target: number; day?: string }): JournalDay {
  if (!(input.balance > 0) || !(input.target > 0)) throw new EarningsError('Баланс и цель должны быть больше нуля');
  const plan = buildEarningsPlan(input);
  if (!plan.solution.picks.length) throw new EarningsError('На этот день нет ставок с перевесом — фиксировать нечего');

  const existing = getDay(plan.day);
  if (existing) {
    const locked = existing.bets.some(
      (b) => b.status !== 'pending' || Date.parse(b.kickoff) <= Date.now(),
    );
    if (locked) throw new EarningsError('План на этот день уже зафиксирован и матчи начались — изменить нельзя', 409);
  }

  tx(() => {
    run('DELETE FROM earn_days WHERE day = @day', { day: plan.day });
    run(
      `INSERT INTO earn_days(day,balance_start,target,lambda,expected,p_hit,status,pnl)
       VALUES(@day,@balance,@target,@lambda,@expected,@p,'open',0)`,
      {
        day: plan.day, balance: input.balance, target: input.target,
        lambda: plan.solution.lambda, expected: plan.solution.expectedProfit,
        p: plan.daySim?.pHitTarget ?? null,
      },
    );
    for (const p of plan.solution.picks) {
      const m = p.meta as unknown as PickMeta;
      run(
        `INSERT INTO earn_bets(day,fixture_id,market,line,selection,label,price,stake,prob)
         VALUES(@day,@fx,@market,@line,@sel,@label,@price,@stake,@prob)`,
        {
          day: plan.day, fx: p.fixtureId, market: m.market, line: m.line, sel: m.selection,
          label: m.label, price: p.price, stake: p.stake, prob: p.prob,
        },
      );
    }
  });
  return getDay(plan.day)!;
}

/** Settle every pending bet whose match has a final result. Idempotent. */
export function settlePending(): { settled: number; voided: number } {
  const pending = all<{
    id: number; day: string; market: string; line: number; selection: string; price: number; stake: number;
    status: string; goals_home: number | null; goals_away: number | null; kickoff: string;
  }>(
    `SELECT b.id, b.day, b.market, b.line, b.selection, b.price, b.stake,
            f.status, f.goals_home, f.goals_away, f.kickoff
       FROM earn_bets b JOIN fixtures f ON f.id = b.fixture_id
      WHERE b.status = 'pending'`,
  );
  let settled = 0, voided = 0;
  const touched = new Set<string>();

  tx(() => {
    for (const b of pending) {
      let outcome: string | null = null, payout = 0, note: string | null = null;

      if (SETTLEABLE.has(b.status) && b.goals_home !== null && b.goals_away !== null) {
        const s = settleBet(b.market, b.line, b.selection, b.price, b.goals_home, b.goals_away);
        if (s) { outcome = s.outcome; payout = +(b.stake * s.factor).toFixed(2); }
      } else if (VOID_STATUSES.has(b.status)) {
        outcome = 'void'; payout = b.stake;
        note = b.status === 'AET' || b.status === 'PEN'
          ? 'Доп. время: счёта основного времени нет, ставка возвращена'
          : 'Матч не состоялся';
      } else if (Date.parse(b.kickoff) < Date.now() - 3 * 86400_000) {
        outcome = 'void'; payout = b.stake; note = 'Нет итогового счёта спустя 3 дня';
      }
      if (!outcome) continue;

      run(
        `UPDATE earn_bets SET status=@o, payout=@p, note=@n, settled_at=datetime('now') WHERE id=@id`,
        { o: outcome, p: payout, n: note, id: b.id },
      );
      outcome === 'void' ? voided++ : settled++;
      touched.add(b.day);
    }

    for (const day of touched) {
      const agg = one<{ pnl: number; pending: number }>(
        `SELECT COALESCE(SUM(CASE WHEN status <> 'pending' THEN payout - stake END), 0) AS pnl,
                SUM(status = 'pending') AS pending
           FROM earn_bets WHERE day = @day`,
        { day },
      )!;
      const pnl = +agg.pnl.toFixed(2);
      if (agg.pending === 0) {
        run(`UPDATE earn_days SET pnl=@pnl, status='settled', balance_end=balance_start+@pnl WHERE day=@day`, { pnl, day });
      } else {
        run(`UPDATE earn_days SET pnl=@pnl WHERE day=@day`, { pnl, day });
      }
    }
  });
  if (settled || voided) logIngest('earn_settle', 'ok', `${touched.size} дн.`, settled + voided, 0);
  return { settled, voided };
}

export interface JournalSummary {
  days: JournalDay[];
  startBalance: number | null;
  currentBalance: number | null;
  totalPnl: number;
  settledDays: number;
  daysHitTarget: number;
  bets: { total: number; won: number; lost: number; void: number; pending: number };
  staked: number;
  roi: number | null;
}

export function getJournal(limit = 60): JournalSummary {
  const list = all<{ day: string }>('SELECT day FROM earn_days ORDER BY day DESC LIMIT @limit', { limit });
  const days = list.map((d) => getDay(d.day)!).filter(Boolean);
  const chrono = [...days].reverse();
  const allBets = days.flatMap((d) => d.bets);
  const settledBets = allBets.filter((b) => b.status !== 'pending');
  const staked = settledBets.reduce((a, b) => a + b.stake, 0);
  const totalPnl = +days.reduce((a, d) => a + d.pnl, 0).toFixed(2);
  const latest = days[0];
  return {
    days,
    startBalance: chrono[0]?.balance_start ?? null,
    currentBalance: latest ? +(latest.balance_start + latest.pnl).toFixed(2) : null,
    totalPnl,
    settledDays: days.filter((d) => d.status === 'settled').length,
    daysHitTarget: days.filter((d) => d.hitTarget === true).length,
    bets: {
      total: allBets.length,
      won: allBets.filter((b) => b.status === 'won' || b.status === 'half_won').length,
      lost: allBets.filter((b) => b.status === 'lost' || b.status === 'half_lost').length,
      void: allBets.filter((b) => b.status === 'void').length,
      pending: allBets.filter((b) => b.status === 'pending').length,
    },
    staked,
    roi: staked > 0 ? +((settledBets.reduce((a, b) => a + (b.payout ?? 0) - b.stake, 0) / staked) * 100).toFixed(2) : null,
  };
}

export function deleteDay(day: string) {
  const d = getDay(day);
  if (!d) return false;
  if (d.bets.some((b) => b.status === 'pending' && Date.parse(b.kickoff) <= Date.now())) {
    throw new EarningsError('Матчи этого дня уже идут — удалить можно после расчёта', 409);
  }
  run('DELETE FROM earn_days WHERE day = @day', { day });
  return true;
}

export function resetJournal() {
  run('DELETE FROM earn_days');
}
