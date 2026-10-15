/**
 * "Схождение" — signal convergence.
 * Independent signals (model, money, line movement, team profile, referee) are
 * scored on the same 0..100 scale and folded into one number per pick.
 */
import { all, one, run, logIngest } from '@/lib/db';
import { selectionLabel, categoryOf, type Signal } from '@/lib/types';
import { logPredictions } from './track-record';
import {
  getForm, goalLambdas, goalProbs, secondaryExpectations, overProb, devig, marketTotal, type FormRow,
} from './model';

interface FixtureLite {
  id: number; kickoff: string; home_id: number; away_id: number;
  home: string; away: string; referee: string | null; tier: number;
}
interface OddsRow { market: string; line: number; selection: string; price: number; open_price: number; movement: number }
interface MoneyRow { market: string; line: number; selection: string; share: number; volume: number; source: string }
interface ExchangeRow { market: string; line: number; selection: string; fair_prob: number | null; mid_price: number | null; back_price: number | null; back_money: number; lay_money: number }

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export interface Candidate {
  market: string; line: number; selection: string;
  modelProb: number;          // our probability
  teamSignal?: number;        // 0..100 from season profile
  teamText?: string;
  headline: string;
  category: ReturnType<typeof categoryOf>;
}

/** two lines bracketing the expectation — not every line on the board */
function bracket(expected: number, spread = 1): number[] {
  const base = Math.floor(expected) + 0.5;
  return [base - spread, base].filter((l) => l > 0.4);
}

function buildCandidates(
  fx: FixtureLite, hf: FormRow | null, af: FormRow | null,
  ref: { yellow_avg: number; fouls_avg: number; matches: number } | null,
  goalLines: number[] = [],
): Candidate[] {
  const lam = goalLambdas(hf, af);
  const gp = goalProbs(lam);
  const sec = secondaryExpectations(hf, af, ref);
  const out: Candidate[] = [];

  out.push(
    { market: '1X2', line: 0, selection: 'HOME', modelProb: gp.home, category: 'outcome',
      headline: `Модель даёт хозяевам ${(gp.home * 100).toFixed(0)}%.` },
    { market: '1X2', line: 0, selection: 'DRAW', modelProb: gp.draw, category: 'outcome',
      headline: `Ожидаемый счёт близкий: ${lam.home.toFixed(2)}–${lam.away.toFixed(2)}.` },
    { market: '1X2', line: 0, selection: 'AWAY', modelProb: gp.away, category: 'outcome',
      headline: `Модель даёт гостям ${(gp.away * 100).toFixed(0)}%.` },
    { market: 'DC', line: 0, selection: 'HOME_DRAW', modelProb: gp.hd, category: 'outcome',
      headline: 'Хозяева не должны проигрывать.' },
    { market: 'DC', line: 0, selection: 'DRAW_AWAY', modelProb: gp.da, category: 'outcome',
      headline: 'Гости держат матч в равной игре.' },
  );

  const totalLines = goalLines.length ? goalLines : [2.5];
  for (const ln of totalLines) {
    const over = gp.over[String(ln)], under = gp.under[String(ln)];
    out.push(
      { market: 'OU', line: ln, selection: 'OVER', modelProb: over, category: 'goals',
        teamSignal: hf && af ? (hf.over25_pct + af.over25_pct) / 2 : undefined,
        teamText: hf && af ? `ТБ 2.5 в ${Math.round((hf.over25_pct + af.over25_pct) / 2)}% матчей пары` : undefined,
        headline: `Ожидаемый тотал ${gp.exp.toFixed(2)} — верх линии.` },
      { market: 'OU', line: ln, selection: 'UNDER', modelProb: under, category: 'goals',
        teamSignal: hf && af ? 100 - (hf.over25_pct + af.over25_pct) / 2 : undefined,
        teamText: hf && af ? `ТМ 2.5 в ${Math.round(100 - (hf.over25_pct + af.over25_pct) / 2)}% матчей пары` : undefined,
        headline: `Ожидаемый тотал ${gp.exp.toFixed(2)} — низ линии.` },
    );
  }

  out.push(
    { market: 'BTTS', line: 0, selection: 'YES', modelProb: gp.bttsYes, category: 'goals',
      teamSignal: hf && af ? (hf.btts_pct + af.btts_pct) / 2 : undefined,
      teamText: hf && af ? `ОЗ в ${Math.round((hf.btts_pct + af.btts_pct) / 2)}% последних матчей` : undefined,
      headline: 'Обе атаки регулярно доводят до гола.' },
    { market: 'BTTS', line: 0, selection: 'NO', modelProb: gp.bttsNo, category: 'goals',
      headline: 'Один из клубов регулярно оставляет ворота сухими.' },
  );

  for (const ln of bracket(sec.cards)) {
    const p = overProb(sec.cards, ln);
    const refText = ref && ref.matches >= 3 ? `Арбитр: ${ref.yellow_avg.toFixed(1)} ЖК в среднем` : undefined;
    out.push(
      { market: 'CARDS', line: ln, selection: 'OVER', modelProb: p, category: 'cards',
        teamSignal: sec.coverage > 0 ? clamp((sec.cards / 7) * 100) : undefined, teamText: refText,
        headline: `Ожидание по карточкам — ${sec.cards.toFixed(1)}.` },
      { market: 'CARDS', line: ln, selection: 'UNDER', modelProb: 1 - p, category: 'cards',
        teamSignal: sec.coverage > 0 ? clamp(100 - (sec.cards / 7) * 100) : undefined, teamText: refText,
        headline: `Пара спокойная: ожидание ${sec.cards.toFixed(1)} ЖК.` },
    );
  }

  for (const ln of bracket(sec.corners)) {
    const p = overProb(sec.corners, ln);
    out.push(
      { market: 'CORNERS', line: ln, selection: 'OVER', modelProb: p, category: 'corners',
        teamSignal: sec.coverage > 0 ? clamp((sec.corners / 14) * 100) : undefined,
        teamText: `Ожидание по угловым — ${sec.corners.toFixed(1)}`,
        headline: `Ожидание по угловым — ${sec.corners.toFixed(1)}.` },
      { market: 'CORNERS', line: ln, selection: 'UNDER', modelProb: 1 - p, category: 'corners',
        teamSignal: sec.coverage > 0 ? clamp(100 - (sec.corners / 14) * 100) : undefined,
        teamText: `Ожидание по угловым — ${sec.corners.toFixed(1)}`,
        headline: `Угловых немного: ожидание ${sec.corners.toFixed(1)}.` },
    );
  }

  for (const ln of bracket(sec.fouls, 3)) {
    const p = overProb(sec.fouls, ln);
    out.push(
      { market: 'FOULS', line: ln, selection: 'OVER', modelProb: p, category: 'fouls',
        teamSignal: sec.coverage > 0 ? clamp((sec.fouls / 32) * 100) : undefined,
        teamText: ref && ref.matches >= 3 ? `Арбитр свистит ${ref.fouls_avg.toFixed(1)} фола за матч` : `Ожидание — ${sec.fouls.toFixed(1)} фола`,
        headline: `Ожидание по фолам — ${sec.fouls.toFixed(1)}.` },
      { market: 'FOULS', line: ln, selection: 'UNDER', modelProb: 1 - p, category: 'fouls',
        teamSignal: sec.coverage > 0 ? clamp(100 - (sec.fouls / 32) * 100) : undefined,
        teamText: `Ожидание — ${sec.fouls.toFixed(1)} фола`,
        headline: `Игра без грубости: ${sec.fouls.toFixed(1)} фола ожидаемо.` },
    );
  }
  return out;
}

const WEIGHTS = { model: 0.3, money: 0.22, move: 0.22, teams: 0.16, ref: 0.1 };

/** Exchanges charge on net winnings, so their headline price is not what you keep. */
const COMMISSION = Number(process.env.EXCHANGE_COMMISSION ?? 0.02);
const afterCommission = (price: number) => +(1 + (price - 1) * (1 - COMMISSION)).toFixed(3);

/** The best price actually available to us across the sources we track. */
function bestPrice(book: number | null | undefined, exchangeBack: number | null | undefined) {
  const net = exchangeBack && exchangeBack > 1 ? afterCommission(exchangeBack) : null;
  if (net && (!book || net > book)) return { price: net, source: 'Биржа' };
  if (book) return { price: book, source: 'Букмекер' };
  return null;
}

export function computeInsightsForFixture(fx: FixtureLite): number {
  const odds = all<OddsRow>(
    `SELECT market,line,selection,price,open_price,movement FROM odds_current
      WHERE fixture_id=@id AND phase='prematch'`, { id: fx.id },
  );
  const money = all<MoneyRow>(
    `SELECT market,line,selection,share,volume,source FROM money_flow WHERE fixture_id=@id`, { id: fx.id },
  );
  const exchange = all<ExchangeRow>(
    `SELECT market,line,selection,fair_prob,mid_price,back_price,back_money,lay_money FROM exchange WHERE fixture_id=@id`, { id: fx.id },
  );
  const hf = getForm(fx.home_id), af = getForm(fx.away_id);
  const ref = fx.referee
    ? one<{ yellow_avg: number; fouls_avg: number; matches: number }>(
        'SELECT yellow_avg,fouls_avg,matches FROM referees WHERE name=@n', { n: fx.referee },
      ) ?? null
    : null;

  const oddsKey = (m: string, l: number, s: string) => odds.find((o) => o.market === m && o.line === l && o.selection === s);
  const moneyKey = (m: string, l: number, s: string) => money.find((o) => o.market === m && o.line === l && o.selection === s);
  const exKey = (m: string, l: number, s: string) => exchange.find((o) => o.market === m && o.line === l && o.selection === s);

  const goalLines = [...new Set(odds.filter((o) => o.market === 'OU').map((o) => o.line))].sort((a, b) => a - b);
  const cands = buildCandidates(fx, hf, af, ref, goalLines);
  let written = 0;

  for (const c of cands) {
    const o = oddsKey(c.market, c.line, c.selection);
    const signals: Signal[] = [];
    const parts: { w: number; v: number }[] = [];

    // 1. model vs market (priced at the best source above)
    let edge: number | null = null;
    let marketProbOut: number | null = null;
    const exRow = exKey(c.market, c.line, c.selection);
    const priced = bestPrice(o?.price, exRow?.back_price);
    let price: number | null = priced?.price ?? null;
    const priceSource: string | null = priced?.source ?? null;
    if (price) {
      // An exchange mid-price is near-margin-free, so prefer it as "what the
      // market thinks"; fall back to de-vigging the bookmaker's own line.
      const exGroup = exchange.filter((x) => x.market === c.market && x.line === c.line && x.fair_prob);
      const ex = exRow;
      let marketProb: number;
      if (ex?.fair_prob && exGroup.length >= 2) {
        const sum = exGroup.reduce((a, x) => a + (x.fair_prob ?? 0), 0) || 1;
        marketProb = (ex.fair_prob / sum) * marketTotal(c.market);
      } else {
        const sameGroup = odds.filter((x) => x.market === c.market && x.line === c.line);
        const fair = devig(sameGroup.map((x) => x.price), c.market);
        const idx = sameGroup.findIndex((x) => x.selection === c.selection);
        marketProb = idx >= 0 ? fair[idx] : 1 / price;
      }
      marketProbOut = +marketProb.toFixed(4);
      edge = +((c.modelProb - marketProb) * 100).toFixed(1);
      // A double-digit disagreement with a liquid market is far more often our
      // model being wrong than the market being wrong — compress the excess.
      const soft = Math.sign(edge) * (Math.abs(edge) <= 12
        ? Math.abs(edge)
        : 12 + (Math.abs(edge) - 12) * 0.25);
      const modelScore = clamp(50 + soft * 3.1);
      parts.push({ w: WEIGHTS.model, v: modelScore });
      if (Math.abs(edge) >= 2) {
        signals.push({
          source: 'Combined', weight: modelScore,
          text: `Модель ${(c.modelProb * 100).toFixed(0)}% против рынка ${(marketProb * 100).toFixed(0)}% (${edge > 0 ? '+' : ''}${edge} п.п.)`,
        });
      }
    } else {
      parts.push({ w: WEIGHTS.model * 0.6, v: clamp(c.modelProb * 100) });
    }

    // 2. money flow
    const ex = exRow;
    const mf = moneyKey(c.market, c.line, c.selection);

    if (ex && (ex.back_money > 0 || ex.lay_money > 0)) {
      // Directional pressure on an exchange: money wanting to BACK this outcome
      // versus money wanting to LAY it, measured against the rest of the market.
      const grp = exchange.filter((x) => x.market === c.market && x.line === c.line);
      const press = (r: ExchangeRow) => {
        const t = r.back_money + r.lay_money;
        return t > 0 ? r.back_money / t : 0.5;
      };
      const mine = press(ex);
      const avg = grp.reduce((a, r) => a + press(r), 0) / Math.max(1, grp.length);
      const moneyScore = clamp(50 + (mine - avg) * 190);
      parts.push({ w: WEIGHTS.money, v: moneyScore });
      if (mine - avg >= 0.06) {
        signals.push({
          source: 'Moneyway', weight: moneyScore,
          text: `Биржа: ${(mine * 100).toFixed(0)}% денег на стороне ставки против ${(avg * 100).toFixed(0)}% в среднем по рынку`,
        });
      }
    } else if (mf) {
      const grp = money.filter((x) => x.market === c.market && x.line === c.line);
      const fairShare = 100 / Math.max(1, grp.length);
      // Derived share is computed from the same drift as the movement signal —
      // half its weight so the two do not double-count each other.
      const moneyScore = clamp(50 + (mf.share - fairShare) * 1.6);
      parts.push({ w: WEIGHTS.money * 0.5, v: moneyScore });
      if (mf.share >= fairShare * 1.3) {
        signals.push({
          source: 'Moneyway', weight: moneyScore,
          text: `Оценка объёма: ${mf.share.toFixed(0)}% на ${selectionLabel(c.market, c.line, c.selection)} — расчёт по движению линии, не наблюдаемые деньги`,
        });
      }
    }

    // 3. line movement (a drop = support)
    if (o && Math.abs(o.movement) > 0.01) {
      const moveScore = clamp(50 - o.movement * 5);
      parts.push({ w: WEIGHTS.move, v: moveScore });
      if (o.movement <= -1.5) {
        signals.push({
          source: 'Падение кэфов', weight: moveScore,
          text: `Линия: ${selectionLabel(c.market, c.line, c.selection)} просел на ${Math.abs(o.movement).toFixed(1)}% (${o.open_price.toFixed(2)} → ${o.price.toFixed(2)})`,
        });
      } else if (o.movement >= 4) {
        signals.push({
          source: 'Падение кэфов', weight: moveScore,
          text: `Линия растёт: ${o.open_price.toFixed(2)} → ${o.price.toFixed(2)} (+${o.movement.toFixed(1)}%)`,
        });
      }
    }

    // 4. season profile of the two teams
    if (c.teamSignal !== undefined) {
      parts.push({ w: WEIGHTS.teams, v: clamp(c.teamSignal) });
      if (c.teamSignal >= 60 && c.teamText) signals.push({ source: 'Команды', weight: c.teamSignal, text: c.teamText });
    }

    // 5. referee
    if (ref && ref.matches >= 3 && (c.category === 'cards' || c.category === 'fouls')) {
      const base = c.category === 'cards' ? ref.yellow_avg / 4.3 : ref.fouls_avg / 22.5;
      const dir = c.selection === 'OVER' ? base : 2 - base;
      const refScore = clamp(50 + (dir - 1) * 110);
      parts.push({ w: WEIGHTS.ref, v: refScore });
      if (refScore >= 60) {
        signals.push({
          source: 'Арбитр', weight: refScore,
          text: c.category === 'cards'
            ? `${fx.referee}: ${ref.yellow_avg.toFixed(1)} ЖК за матч (${ref.matches} матчей)`
            : `${fx.referee}: ${ref.fouls_avg.toFixed(1)} фола за матч`,
        });
      }
    }

    const wSum = parts.reduce((a, p) => a + p.w, 0) || 1;
    const base = parts.reduce((a, p) => a + p.w * p.v, 0) / wSum;

    // Convergence means *several independent* signals agreeing. One lonely
    // signal — or a pick the market never priced — must not reach the top.
    const evidence = parts.length;
    const damp = (o ? 1 : 0.8) * (0.62 + 0.38 * Math.min(1, evidence / 4));
    let score = Math.round(base * damp);
    if (!o) score = Math.min(score, 72);
    if (signals.length === 0) score = Math.min(score, 66);

    run(
      `INSERT INTO insights(fixture_id,market,line,selection,label,category,score,headline,signals,price,edge,model_prob,market_prob,price_source,created_at)
       VALUES(@fixture_id,@market,@line,@selection,@label,@category,@score,@headline,@signals,@price,@edge,@model_prob,@market_prob,@price_source,datetime('now'))
       ON CONFLICT(fixture_id,market,line,selection) DO UPDATE SET
         score=@score, headline=@headline, signals=@signals, price=@price, edge=@edge,
         model_prob=@model_prob, market_prob=@market_prob, price_source=@price_source,
         label=@label, category=@category, created_at=datetime('now')`,
      {
        fixture_id: fx.id, market: c.market, line: c.line, selection: c.selection,
        label: selectionLabel(c.market, c.line, c.selection), category: c.category,
        score, headline: c.headline, signals: JSON.stringify(signals),
        price, edge,
        model_prob: +c.modelProb.toFixed(4), market_prob: marketProbOut, price_source: priceSource,
      },
    );
    written++;
  }
  return written;
}

export function rebuildInsights(hours = 96): number {
  const t0 = Date.now();
  const fixtures = all<FixtureLite>(
    `SELECT f.id, f.kickoff, f.home_id, f.away_id, f.referee,
            th.name AS home, ta.name AS away, COALESCE(l.tier,5) AS tier
       FROM fixtures f
       JOIN teams th ON th.id=f.home_id
       JOIN teams ta ON ta.id=f.away_id
       LEFT JOIN leagues l ON l.id=f.league_id
      WHERE f.status='NS' AND f.sport='football'
        AND datetime(f.kickoff) BETWEEN datetime('now','-2 hours') AND datetime('now', @h)`,
    { h: `+${hours} hours` },
  );
  run(`DELETE FROM insights WHERE fixture_id IN (
         SELECT id FROM fixtures WHERE datetime(kickoff) < datetime('now','-6 hours'))`);
  // wipe the previous pass for these fixtures — lines and candidates change
  if (fixtures.length) {
    run(`DELETE FROM insights WHERE fixture_id IN (${fixtures.map((f) => f.id).join(',')})`);
  }
  let n = 0;
  for (const fx of fixtures) n += computeInsightsForFixture(fx);
  const logged = logPredictions();
  logIngest('insights', 'ok', `${fixtures.length} fixtures, ${logged} в журнал прогнозов`, n, Date.now() - t0);
  return n;
}
