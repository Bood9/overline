/** Fuzzy pairing of the same football fixture across providers. */

const ALIASES: Record<string, string> = {
  man: 'manchester', utd: 'united', spurs: 'tottenham', wolves: 'wolverhampton',
  psg: 'paris', inter: 'internazionale', gladbach: 'monchengladbach',
  bayern: 'bayern', dortmund: 'dortmund', leverkusen: 'leverkusen',
  atleti: 'atletico', barca: 'barcelona', juve: 'juventus',
  nec: 'nijmegen', ofi: 'ofi', azz: 'az',
};

const NOISE = new Set([
  'fc', 'cf', 'sc', 'ac', 'fk', 'sk', 'bk', 'afc', 'cfc', 'sv', 'vfb', 'vfl', 'tsg', 'bsc',
  'cd', 'ca', 'us', 'uc', 'as', 'ss', 'ssc', 'rc', 'rcd', 'ud', 'sd', 'nk', 'hnk', 'gnk',
  'mfk', 'ofk', 'pfc', 'fsv', 'spvgg', 'club', 'de', 'do', 'la', 'le', 'el', 'and', 'the',
  'calcio', 'futbol', 'football', 'team', 'tc', 'if', 'ff', 'bc', 'kv', 'rk', 'sp',
]);

export function tokens(name: string): string[] {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => ALIASES[t] ?? t)
    .filter((t) => t.length > 1 && !NOISE.has(t));
}

/** 0..1 — how much of the smaller token set is covered by the larger. */
export function similarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  let hits = 0;
  for (const t of A) {
    if (B.some((u) => u === t || (t.length >= 4 && u.length >= 4 && (u.startsWith(t.slice(0, 4)) || t.startsWith(u.slice(0, 4)))))) {
      hits++;
    }
  }
  return hits / Math.min(A.length, B.length);
}

export interface Candidate { id: number; home: string; away: string; kickoff: string }

/** Best fixture for an external "Home vs Away" event, or null when unsure. */
export function matchFixture(
  extHome: string, extAway: string, extKickoff: string, candidates: Candidate[],
  maxHoursApart = 3, threshold = 0.5,
): { id: number; confidence: number } | null {
  const t = new Date(extKickoff).getTime();
  let best: { id: number; confidence: number } | null = null;
  for (const c of candidates) {
    const hoursApart = Math.abs(new Date(c.kickoff).getTime() - t) / 3.6e6;
    if (hoursApart > maxHoursApart) continue;
    const h = similarity(extHome, c.home);
    const a = similarity(extAway, c.away);
    if (h < threshold || a < threshold) continue;
    const confidence = +(((h + a) / 2) * (1 - hoursApart / (maxHoursApart * 4))).toFixed(3);
    if (!best || confidence > best.confidence) best = { id: c.id, confidence };
  }
  return best;
}

/** "Man City vs Norwich" -> ["Man City", "Norwich"] */
export function splitEventName(name: string): [string, string] | null {
  const m = name.split(/\s+(?:vs\.?|v)\s+/i);
  return m.length === 2 ? [m[0].trim(), m[1].trim()] : null;
}
