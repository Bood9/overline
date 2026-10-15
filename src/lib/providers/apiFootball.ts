import { fetchWithRetry } from '@/lib/util/http';
import { kvGet, kvSet } from '@/lib/db';
import { HostThrottle } from '@/lib/util/throttle';

/** Free tier also caps requests per minute, so keep one polite queue. */
const throttle = new HostThrottle(Number(process.env.API_FOOTBALL_MIN_GAP_MS || 1200), 'api-football');

const BASE = 'https://v3.football.api-sports.io';
const RAPID = 'https://api-football-v1.p.rapidapi.com/v3';

export function afKey() {
  return process.env.API_FOOTBALL_KEY || '';
}
export function afEnabled() {
  return !!afKey();
}

/** Free tier is 100 req/day — keep a local counter so we never burn the quota blind. */
function quotaKey() {
  return `af:quota:${new Date().toISOString().slice(0, 10)}`;
}
export function afQuotaUsed(): number {
  return Number(kvGet(quotaKey()) || 0);
}
export function afQuotaLeft(): number {
  const cap = Number(process.env.API_FOOTBALL_DAILY_LIMIT || 100);
  return Math.max(0, cap - afQuotaUsed());
}
function bump() {
  kvSet(quotaKey(), String(afQuotaUsed() + 1));
}

async function af<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  if (!afEnabled()) throw new Error('API_FOOTBALL_KEY missing');
  if (afQuotaLeft() <= 0) throw new Error('api-football daily quota exhausted');
  const useRapid = process.env.API_FOOTBALL_HOST === 'rapidapi';
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const url = `${useRapid ? RAPID : BASE}${path}${qs ? `?${qs}` : ''}`;
  const headers: Record<string, string> = useRapid
    ? { 'x-rapidapi-key': afKey(), 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
    : { 'x-apisports-key': afKey() };
  return throttle.run(async () => {
    bump();
    const json = await fetchWithRetry<any>(url, { headers });
    const errors = json?.errors;
    const hasError = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;
    if (hasError) {
      const text = JSON.stringify(errors);
      if (/rateLimit|requests.*limit/i.test(text)) {
        // burn the local counter so we stop asking today
        kvSet(quotaKey(), String(Number(process.env.API_FOOTBALL_DAILY_LIMIT || 100)));
      }
      throw new Error(`api-football: ${text.slice(0, 300)}`);
    }
    return (json?.response ?? []) as T[];
  });
}

export interface AFFixture {
  fixture: {
    id: number; date: string; timezone: string; referee: string | null;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null; city: string | null };
  };
  league: { id: number; name: string; country: string; logo: string; flag: string; season: number; round: string };
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null } };
}

export const getFixturesByDate = (date: string) => af<AFFixture>('/fixtures', { date, timezone: 'UTC' });
export const getLiveFixtures = () => af<AFFixture>('/fixtures', { live: 'all' });
export const getFixtureStats = (fixture: number) => af<any>('/fixtures/statistics', { fixture });
export const getOdds = (fixture: number) => af<any>('/odds', { fixture });
export const getOddsByDate = (date: string, page = 1) => af<any>('/odds', { date, page });
export const getLeagues = () => af<any>('/leagues', { current: 'true' });
export const getTeamStats = (league: number, season: number, team: number) =>
  af<any>('/teams/statistics', { league, season, team });

/** api-football statistic rows -> our column names */
export function mapStatRow(items: { type: string; value: any }[]) {
  const num = (v: any) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace('%', ''));
    return Number.isFinite(n) ? n : null;
  };
  const get = (t: string) => items.find((i) => i.type === t)?.value;
  return {
    shots: num(get('Total Shots')),
    shots_on: num(get('Shots on Goal')),
    corners: num(get('Corner Kicks')),
    fouls: num(get('Fouls')),
    yellow: num(get('Yellow Cards')),
    red: num(get('Red Cards')),
    possession: num(get('Ball Possession')),
    xg: num(get('expected_goals')),
    offsides: num(get('Offsides')),
    saves: num(get('Goalkeeper Saves')),
    passes: num(get('Total passes')),
    pass_acc: num(get('Passes %')),
  };
}
