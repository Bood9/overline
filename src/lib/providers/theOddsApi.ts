import { fetchWithRetry } from '@/lib/util/http';
import { kvGet, kvSet } from '@/lib/db';

const BASE = 'https://api.the-odds-api.com/v4';

export const oaKey = () => process.env.ODDS_API_KEY || '';
export const oaEnabled = () => !!oaKey();

function monthKey() {
  return `oa:quota:${new Date().toISOString().slice(0, 7)}`;
}
export const oaUsed = () => Number(kvGet(monthKey()) || 0);
export const oaLeft = () => Math.max(0, Number(process.env.ODDS_API_MONTHLY_LIMIT || 500) - oaUsed());
function bump(n: number) {
  kvSet(monthKey(), String(oaUsed() + n));
}

/** Soccer competitions we track. The Odds API keys. */
export const SOCCER_KEYS = (
  process.env.ODDS_API_SPORTS ||
  [
    'soccer_epl',
    'soccer_spain_la_liga',
    'soccer_italy_serie_a',
    'soccer_germany_bundesliga',
    'soccer_france_ligue_one',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league',
    'soccer_uefa_europa_conference_league',
    'soccer_netherlands_eredivisie',
    'soccer_portugal_primeira_liga',
    'soccer_russia_premier_league',
  ].join(',')
).split(',').map((s) => s.trim()).filter(Boolean);

export interface OAEvent {
  id: string; sport_key: string; sport_title: string; commence_time: string;
  home_team: string; away_team: string;
  bookmakers: {
    key: string; title: string; last_update: string;
    markets: { key: string; last_update: string; outcomes: { name: string; price: number; point?: number }[] }[];
  }[];
}

export async function listSports(): Promise<any[]> {
  return fetchWithRetry(`${BASE}/sports/?apiKey=${oaKey()}`);
}

export async function getOdds(sportKey: string, markets = 'h2h,totals'): Promise<OAEvent[]> {
  if (!oaEnabled()) throw new Error('ODDS_API_KEY missing');
  const cost = markets.split(',').length; // 1 region
  if (oaLeft() < cost) throw new Error('the-odds-api monthly quota exhausted');
  const url = `${BASE}/sports/${sportKey}/odds/?apiKey=${oaKey()}&regions=${
    process.env.ODDS_API_REGIONS || 'eu'
  }&markets=${markets}&oddsFormat=decimal&dateFormat=iso`;
  bump(cost);
  return fetchWithRetry<OAEvent[]>(url);
}

/** map The Odds API market/outcome -> our (market, line, selection) */
export function mapOutcome(
  marketKey: string,
  outcome: { name: string; point?: number },
  home: string,
  away: string,
): { market: string; line: number; selection: string } | null {
  const n = outcome.name;
  if (marketKey === 'h2h') {
    if (n === home) return { market: '1X2', line: 0, selection: 'HOME' };
    if (n === away) return { market: '1X2', line: 0, selection: 'AWAY' };
    if (/draw/i.test(n)) return { market: '1X2', line: 0, selection: 'DRAW' };
  }
  if (marketKey === 'totals') {
    return { market: 'OU', line: outcome.point ?? 2.5, selection: /over/i.test(n) ? 'OVER' : 'UNDER' };
  }
  if (marketKey === 'btts') {
    return { market: 'BTTS', line: 0, selection: /yes/i.test(n) ? 'YES' : 'NO' };
  }
  if (marketKey === 'spreads') {
    return { market: 'AH', line: outcome.point ?? 0, selection: n === home ? 'HOME' : 'AWAY' };
  }
  if (marketKey === 'double_chance') {
    if (/draw/i.test(n) && n.includes(home)) return { market: 'DC', line: 0, selection: 'HOME_DRAW' };
    if (/draw/i.test(n) && n.includes(away)) return { market: 'DC', line: 0, selection: 'DRAW_AWAY' };
    return { market: 'DC', line: 0, selection: 'HOME_AWAY' };
  }
  return null;
}
