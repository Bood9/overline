/**
 * ESPN public soccer data — no key, no quota. Backbone for fixtures, live scores,
 * in-play stats and referees.
 */
import { fetchWithRetry } from '@/lib/util/http';
import { HostThrottle } from '@/lib/util/throttle';

/**
 * ESPN's public API is unauthenticated and undocumented — it answers 403 when it
 * decides we are asking too often. One shared throttle keeps every caller
 * (worker, CLI, page request) on a single polite queue.
 */
const throttle = new HostThrottle(Number(process.env.ESPN_MIN_GAP_MS || 700), 'espn');
export const espnBlockedFor = () => throttle.blockedFor;

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const CDN = 'https://cdn.espn.com/core';

/**
 * ESPN publishes the same scoreboard through two hosts. `site.api` is the
 * convenient one but answers 403 once it decides we ask too often; `cdn.espn.com`
 * serves the site's own XHR payload and keeps working. We try the CDN first and
 * fall back, so a block on one host does not stop ingestion.
 */
async function espnGet<T>(paths: string[], pick: (json: any) => T): Promise<T> {
  return throttle.run(async () => {
    let lastErr: unknown;
    for (const url of paths) {
      try {
        const json = await fetchWithRetry<any>(url, {
          retries: 1,
          timeoutMs: 12000,
          headers: { referer: 'https://www.espn.com/', accept: 'application/json' },
        });
        const picked = pick(json);
        if (picked !== undefined && picked !== null) {
          throttle.clear();
          return picked;
        }
        lastErr = new Error(`пустой ответ: ${url}`);
      } catch (e: any) {
        lastErr = e;
        if (!/HTTP 403|HTTP 429|HTTP 404|rate-limited/.test(String(e?.message))) break;
      }
    }
    if (/HTTP 403|HTTP 429|rate-limited/.test(String((lastErr as any)?.message))) {
      const min = throttle.penalise();
      throw new Error(`ESPN ограничил доступ. Пауза ${min} мин.`);
    }
    throw lastErr ?? new Error('ESPN: нет данных');
  });
}

export interface EspnLeagueDef {
  slug: string; name: string; nameRu: string; country: string; tier: number;
}

export const ESPN_LEAGUES: EspnLeagueDef[] = [
  { slug: 'eng.1', name: 'Premier League', nameRu: 'АПЛ', country: 'England', tier: 1 },
  { slug: 'esp.1', name: 'La Liga', nameRu: 'Ла Лига', country: 'Spain', tier: 1 },
  { slug: 'ita.1', name: 'Serie A', nameRu: 'Серия А', country: 'Italy', tier: 1 },
  { slug: 'ger.1', name: 'Bundesliga', nameRu: 'Бундеслига', country: 'Germany', tier: 1 },
  { slug: 'fra.1', name: 'Ligue 1', nameRu: 'Лига 1', country: 'France', tier: 1 },
  { slug: 'uefa.champions', name: 'UEFA Champions League', nameRu: 'Лига чемпионов', country: 'World', tier: 1 },
  { slug: 'uefa.europa', name: 'UEFA Europa League', nameRu: 'Лига Европы', country: 'World', tier: 1 },
  { slug: 'uefa.europa.conf', name: 'UEFA Conference League', nameRu: 'Лига конференций', country: 'World', tier: 2 },
  { slug: 'ned.1', name: 'Eredivisie', nameRu: 'Эредивизи', country: 'Netherlands', tier: 2 },
  { slug: 'por.1', name: 'Primeira Liga', nameRu: 'Примейра Лига', country: 'Portugal', tier: 2 },
  { slug: 'rus.1', name: 'Russian Premier League', nameRu: 'РПЛ', country: 'Russia', tier: 2 },
  { slug: 'tur.1', name: 'Super Lig', nameRu: 'Суперлига Турции', country: 'Turkey', tier: 2 },
  { slug: 'eng.2', name: 'Championship', nameRu: 'Чемпионшип', country: 'England', tier: 3 },
  { slug: 'eng.league_cup', name: 'League Cup', nameRu: 'Кубок лиги', country: 'England', tier: 2 },
  { slug: 'esp.copa_del_rey', name: 'Copa del Rey', nameRu: 'Кубок Испании', country: 'Spain', tier: 3 },
  { slug: 'ita.coppa_italia', name: 'Coppa Italia', nameRu: 'Кубок Италии', country: 'Italy', tier: 3 },
  { slug: 'ger.dfb_pokal', name: 'DFB Pokal', nameRu: 'Кубок Германии', country: 'Germany', tier: 3 },
  { slug: 'bel.1', name: 'Belgian Pro League', nameRu: 'Про-лига Бельгии', country: 'Belgium', tier: 3 },
  { slug: 'sco.1', name: 'Scottish Premiership', nameRu: 'Чемпионат Шотландии', country: 'Scotland', tier: 3 },
  { slug: 'aut.1', name: 'Austrian Bundesliga', nameRu: 'Бундеслига Австрии', country: 'Austria', tier: 3 },
  { slug: 'gre.1', name: 'Super League', nameRu: 'Суперлига Греции', country: 'Greece', tier: 3 },
  { slug: 'usa.1', name: 'MLS', nameRu: 'MLS', country: 'USA', tier: 3 },
  { slug: 'bra.1', name: 'Brazilian Serie A', nameRu: 'Бразилейрао', country: 'Brazil', tier: 3 },
  { slug: 'arg.1', name: 'Liga Profesional', nameRu: 'Чемпионат Аргентины', country: 'Argentina', tier: 3 },
  { slug: 'mex.1', name: 'Liga MX', nameRu: 'Лига MX', country: 'Mexico', tier: 3 },
  { slug: 'conmebol.libertadores', name: 'Copa Libertadores', nameRu: 'Кубок Либертадорес', country: 'World', tier: 3 },
  // national teams — club leagues pause for international windows, these do not
  { slug: 'uefa.nations', name: 'UEFA Nations League', nameRu: 'Лига наций', country: 'World', tier: 1 },
  { slug: 'fifa.friendly', name: 'International Friendly', nameRu: 'Товарищеские матчи сборных', country: 'World', tier: 3 },
  { slug: 'concacaf.nations.league', name: 'CONCACAF Nations League', nameRu: 'Лига наций КОНКАКАФ', country: 'World', tier: 3 },
  { slug: 'fifa.world', name: 'FIFA World Cup', nameRu: 'Чемпионат мира', country: 'World', tier: 1 },
  { slug: 'fifa.worldq.uefa', name: 'World Cup Qualifying UEFA', nameRu: 'Отбор ЧМ · Европа', country: 'World', tier: 1 },
];

export const leagueBySlug = (slug: string) => ESPN_LEAGUES.find((l) => l.slug === slug);

/** Stable numeric id per league slug (we mix providers in one table). */
export function leagueId(slug: string): number {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return 900000 + (Math.abs(h) % 90000);
}

export interface EspnEvent {
  id: string; date: string; name: string; shortName: string;
  season?: { year: number };
  competitions: {
    id: string; date: string;
    venue?: { fullName?: string; address?: { city?: string } };
    competitors: {
      id: string; homeAway: 'home' | 'away'; score?: string; winner?: boolean;
      team: { id: string; displayName: string; shortDisplayName: string; abbreviation?: string; logo?: string };
      statistics?: { name: string; displayValue: string }[];
      form?: string; records?: { summary: string }[];
    }[];
    status: { clock: number; displayClock: string; period: number; type: { state: string; completed: boolean; shortDetail: string; description: string } };
    odds?: { provider?: { name: string }; details?: string; overUnder?: number;
      homeTeamOdds?: { moneyLine?: number }; awayTeamOdds?: { moneyLine?: number }; drawOdds?: { moneyLine?: number } }[];
    details?: any[];
  }[];
  status: { type: { state: string; completed: boolean; shortDetail: string } };
}

export async function scoreboard(slug: string, date?: string): Promise<EspnEvent[]> {
  const compact = date ? date.replace(/-/g, '') : '';
  return espnGet<EspnEvent[]>(
    [
      `${CDN}/soccer/scoreboard?xhr=1&league=${slug}${compact ? `&date=${compact}` : ''}`,
      `${SITE}/${slug}/scoreboard${compact ? `?dates=${compact}&limit=200` : '?limit=200'}`,
    ],
    (j) => (j?.content?.sbData?.events ?? j?.events ?? null) as EspnEvent[],
  );
}

export async function summary(slug: string, eventId: string): Promise<any> {
  return espnGet<any>(
    [
      `${CDN}/soccer/match?xhr=1&gameId=${eventId}`,
      `${SITE}/${slug}/summary?event=${eventId}`,
    ],
    (j) => j?.gamepackageJSON ?? j?.content?.gamepackageJSON ?? (j?.boxscore ? j : null),
  );
}

export function mapStatus(
  state: string,
  detail: string,
  completed: boolean,
  period = 0,
): string {
  if (completed || state === 'post') return 'FT';
  if (state === 'pre') {
    if (/postponed/i.test(detail)) return 'PST';
    if (/cancel/i.test(detail)) return 'CANC';
    return 'NS';
  }
  // state === 'in'
  if (/^HT$|halftime|half.?time/i.test(detail.trim())) return 'HT';
  if (/pen/i.test(detail) || period >= 5) return 'PEN';
  if (/\bET\b|extra/i.test(detail) || period === 3 || period === 4) return 'ET';
  if (period >= 2 || /2nd/i.test(detail)) return '2H';
  return '1H';
}

/** Minute on the clock: "67'" / "90'+3" -> 67 / 90 */
export function liveMinute(displayClock: string | undefined, clockSeconds: number, period: number): number | null {
  const m = displayClock?.match(/(\d+)/);
  if (m) return Number(m[1]);
  if (clockSeconds > 0) return Math.round(clockSeconds / 60);
  return period > 1 ? 45 : null;
}

const NUM = (v?: string) => (v == null ? null : Number(String(v).replace('%', '')) || 0);

/** ESPN boxscore team statistics -> our columns */
export function mapBoxStats(stats: { name: string; displayValue: string }[] = []) {
  const g = (n: string) => stats.find((s) => s.name === n)?.displayValue;
  return {
    shots: NUM(g('totalShots')),
    shots_on: NUM(g('shotsOnTarget')),
    corners: NUM(g('wonCorners')),
    fouls: NUM(g('foulsCommitted')),
    yellow: NUM(g('yellowCards')),
    red: NUM(g('redCards')),
    possession: NUM(g('possessionPct')),
    xg: null as number | null,
    offsides: NUM(g('offsides')),
    saves: NUM(g('saves')),
    passes: NUM(g('totalPasses')),
    pass_acc: NUM(g('passPct')),
  };
}

/** American moneyline -> decimal odds */
export function mlToDecimal(ml?: number | null): number | null {
  if (ml == null || Number.isNaN(ml)) return null;
  return ml > 0 ? +(ml / 100 + 1).toFixed(2) : +(100 / Math.abs(ml) + 1).toFixed(2);
}
