/** Poisson match model driven by rolling team form + referee profile. */
import { one } from '@/lib/db';

export interface FormRow {
  team_id: number; played: number; gf: number; ga: number;
  xg_for: number; xg_against: number; corners_for: number; corners_against: number;
  cards_for: number; fouls_for: number; btts_pct: number; over25_pct: number; form: string | null;
}

const LEAGUE_AVG_GOALS = 1.42;     // per team per match
const HOME_ADV = 1.11;
const AWAY_ADJ = 0.93;

export function getForm(teamId: number): FormRow | null {
  return one<FormRow>('SELECT * FROM team_form WHERE team_id = @id', { id: teamId }) ?? null;
}

function fact(n: number) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
export function pois(k: number, lambda: number) {
  return (Math.exp(-lambda) * lambda ** k) / fact(k);
}

export interface Lambdas { home: number; away: number; confidence: number }

/**
 * Multiplicative attack/defence strengths (Dixon–Coles style) rather than a flat
 * average of the two sides — averaging compresses mismatches, which is how a
 * City-vs-Norwich fixture ended up at 51% for the home win.
 */
export function goalLambdas(homeForm: FormRow | null, awayForm: FormRow | null): Lambdas {
  const rate = (f: FormRow | null, key: 'gf' | 'ga', xgKey: 'xg_for' | 'xg_against') => {
    if (!f || !f.played) return { value: LEAGUE_AVG_GOALS, weight: 0 };
    const goals = f[key] ?? LEAGUE_AVG_GOALS;
    const xg = f[xgKey] || 0;
    const value = xg > 0 ? goals * 0.6 + xg * 0.4 : goals;
    return { value, weight: Math.min(1, f.played / 6) };
  };

  // strength relative to the league mean, shrunk toward 1.0 on small samples
  const strength = (r: { value: number; weight: number }) => {
    const raw = r.value / LEAGUE_AVG_GOALS;
    return 1 + (raw - 1) * r.weight;
  };

  const hAtt = strength(rate(homeForm, 'gf', 'xg_for'));
  const hDef = strength(rate(homeForm, 'ga', 'xg_against'));
  const aAtt = strength(rate(awayForm, 'gf', 'xg_for'));
  const aDef = strength(rate(awayForm, 'ga', 'xg_against'));

  const cap = (v: number) => Math.max(0.2, Math.min(4.6, v));
  const home = cap(LEAGUE_AVG_GOALS * hAtt * aDef * HOME_ADV);
  const away = cap(LEAGUE_AVG_GOALS * aAtt * hDef * AWAY_ADJ);
  const played = Math.min(homeForm?.played ?? 0, awayForm?.played ?? 0);
  return { home, away, confidence: Math.min(1, played / 8) };
}

export interface GoalProbs {
  home: number; draw: number; away: number;
  over: Record<string, number>; under: Record<string, number>;
  bttsYes: number; bttsNo: number;
  hd: number; ha: number; da: number;   // double chance
  exp: number;
}

export function goalProbs(l: Lambdas, maxGoals = 9): GoalProbs {
  const ph = Array.from({ length: maxGoals + 1 }, (_, k) => pois(k, l.home));
  const pa = Array.from({ length: maxGoals + 1 }, (_, k) => pois(k, l.away));
  let home = 0, draw = 0, away = 0, bttsYes = 0;
  const totals: number[] = new Array(2 * maxGoals + 1).fill(0);
  for (let i = 0; i <= maxGoals; i++)
    for (let j = 0; j <= maxGoals; j++) {
      const p = ph[i] * pa[j];
      if (i > j) home += p; else if (i === j) draw += p; else away += p;
      if (i > 0 && j > 0) bttsYes += p;
      totals[i + j] += p;
    }
  const lines = [0.5, 1.5, 2.5, 3.5, 4.5];
  const over: Record<string, number> = {}, under: Record<string, number> = {};
  for (const ln of lines) {
    let u = 0;
    for (let t = 0; t <= Math.floor(ln); t++) u += totals[t] ?? 0;
    under[String(ln)] = u;
    over[String(ln)] = 1 - u;
  }
  return {
    home, draw, away, over, under,
    bttsYes, bttsNo: 1 - bttsYes,
    hd: home + draw, ha: home + away, da: draw + away,
    exp: l.home + l.away,
  };
}

/** Expected totals for the "secondary" markets. */
export interface SecondaryExp { corners: number; cards: number; fouls: number; refFactor: number; coverage: number }

export function secondaryExpectations(
  hf: FormRow | null, af: FormRow | null,
  ref: { yellow_avg: number; fouls_avg: number; matches: number } | null,
): SecondaryExp {
  const LEAGUE_CORNERS = 10.2, LEAGUE_CARDS = 4.3, LEAGUE_FOULS = 22.5;
  // a zero here means "we never collected that stat", not "it never happens"
  const known = (v: number | null | undefined) => (v && v > 0 ? v : null);
  const enough = (t: FormRow | null) => (t && t.played >= 3 ? t : null);
  const h = enough(hf), a = enough(af);

  const cFor = known(h?.corners_for), cAgH = known(h?.corners_against);
  const cForA = known(a?.corners_for), cAgA = known(a?.corners_against);
  const cornersTeams =
    cFor && cForA
      ? ((cFor + (cAgA ?? LEAGUE_CORNERS / 2)) / 2) + ((cForA + (cAgH ?? LEAGUE_CORNERS / 2)) / 2)
      : LEAGUE_CORNERS;

  const yH = known(h?.cards_for), yA = known(a?.cards_for);
  const cardsTeams = yH && yA ? yH + yA : LEAGUE_CARDS;

  const fH = known(h?.fouls_for), fA = known(a?.fouls_for);
  const foulsTeams = fH && fA ? fH + fA : LEAGUE_FOULS;

  let refFactor = 1;
  if (ref && ref.matches >= 3 && ref.yellow_avg > 0) {
    refFactor = Math.max(0.7, Math.min(1.4, ref.yellow_avg / LEAGUE_CARDS));
  }
  const foulFactor = ref && ref.matches >= 3 && ref.fouls_avg > 0
    ? Math.max(0.75, Math.min(1.3, ref.fouls_avg / LEAGUE_FOULS)) : 1;

  return {
    corners: +(cornersTeams * 0.75 + LEAGUE_CORNERS * 0.25).toFixed(2),
    cards: +((cardsTeams * 0.65 + LEAGUE_CARDS * 0.35) * refFactor).toFixed(2),
    fouls: +((foulsTeams * 0.6 + LEAGUE_FOULS * 0.4) * foulFactor).toFixed(1),
    refFactor: +refFactor.toFixed(2),
    // how much of the above is real data rather than league defaults
    coverage: +(([cFor && cForA, yH && yA, fH && fA].filter(Boolean).length / 3)).toFixed(2),
  };
}

/** P(total > line) for a Poisson-ish count market. */
export function overProb(lambda: number, line: number): number {
  let under = 0;
  for (let k = 0; k <= Math.floor(line); k++) under += pois(k, lambda);
  return Math.max(0.01, Math.min(0.99, 1 - under));
}

export const impliedProb = (price: number) => (price > 1 ? 1 / price : 0);

/**
 * How many units of probability a full set of this market's selections covers.
 * Double chance is the odd one out: its three selections each cover two of the
 * three 1X2 outcomes, so they sum to 2, not 1.
 */
export function marketTotal(market: string): number {
  return market === 'DC' ? 2 : 1;
}

export function devig(prices: number[], market = '1X2'): number[] {
  const raw = prices.map(impliedProb);
  const s = raw.reduce((a, b) => a + b, 0) || 1;
  const target = marketTotal(market);
  return raw.map((r) => (r / s) * target);
}

export const fairPrice = (p: number) => (p > 0 ? +(1 / p).toFixed(2) : 0);
