/**
 * Smarkets betting exchange — public read API, no key.
 *
 * Gives us two things ESPN cannot: a live order book per outcome and the market's
 * matched volume. Exchange prices carry almost no margin, so the mid-price is a
 * far better "fair probability" than a bookmaker's line.
 *
 * Prices are probability × 10000 (8850 -> 88.50% -> decimal 1.13).
 * Order quantities are in 1/10000 of the currency (verified against the observed
 * min/median/max spread of resting orders). The /volumes/ endpoint uses a
 * different, undocumented scale that we could not verify from outside, so we
 * never print it as currency — only ratios, which are scale-independent.
 */
import { fetchWithRetry, sleep } from '@/lib/util/http';
import { HostThrottle } from '@/lib/util/throttle';

/** Smarkets answers 429 if we fan out; one polite queue for every caller. */
const throttle = new HostThrottle(Number(process.env.SMARKETS_MIN_GAP_MS || 1100), 'smarkets');
export const smarketsBlockedFor = () => throttle.blockedFor;

const BASE = 'https://api.smarkets.com/v3';

export const priceToDecimal = (p: number) => (p > 0 ? +(10000 / p).toFixed(3) : 0);
export const bookMoney = (v: number) => v / 10000;

export interface SmEvent {
  id: string; name: string; start_datetime: string; full_slug: string; state: string;
}
export interface SmMarket {
  id: string; event_id: string; name: string; state: string;
  market_type?: { name: string };
}
export interface SmContract {
  id: string; market_id: string; name: string; contract_type: { name: string };
}
export interface SmQuoteSide { price: number; quantity: number }
export type SmQuotes = Record<string, { bids?: SmQuoteSide[]; offers?: SmQuoteSide[] }>;

async function sm<T>(path: string): Promise<T> {
  return throttle.run(async () => {
    try {
      const r = await fetchWithRetry<T>(`${BASE}${path}`, { retries: 1, timeoutMs: 15000 });
      throttle.clear();
      return r;
    } catch (e: any) {
      if (/rate-limited|HTTP 429|HTTP 403/.test(String(e?.message))) {
        const min = throttle.penalise();
        throw new Error(`Smarkets ограничил доступ. Пауза ${min} мин.`);
      }
      throw e;
    }
  });
}

export const SPORT_TYPES = {
  football: 'football_match',
  hockey: 'ice_hockey_match',
  basketball: 'basketball_match',
  csgo: 'csgo_match',
  lol: 'league_of_legends_match',
  cod: 'call_of_duty_match',
} as const;
export type SportKey = keyof typeof SPORT_TYPES;

/** Upcoming events of one type, paged until we pass `until`. */
export async function listEvents(untilISO: string, maxPages = 6, type = 'football_match'): Promise<SmEvent[]> {
  const out: SmEvent[] = [];
  let query = `?type=${type}&state=upcoming&start_datetime_max=${encodeURIComponent(untilISO)}&limit=100`;
  for (let page = 0; page < maxPages; page++) {
    const json = await sm<{ events: SmEvent[]; pagination?: { next_page?: string } }>(`/events/${query}`);
    out.push(...(json.events ?? []));
    const next = json.pagination?.next_page;
    if (!next || !json.events?.length) break;
    query = next.startsWith('?') ? next : `?${next}`;
    await sleep(120);
  }
  return out;
}

export const listMarkets = (eventId: string) =>
  sm<{ markets: SmMarket[] }>(`/events/${eventId}/markets/`).then((j) => j.markets ?? []);

export const listContracts = (marketIds: string[]) =>
  sm<{ contracts: SmContract[] }>(`/markets/${marketIds.join(',')}/contracts/`).then((j) => j.contracts ?? []);

export const listQuotes = (marketIds: string[]) => sm<SmQuotes>(`/markets/${marketIds.join(',')}/quotes/`);

export const listVolumes = (marketIds: string[]) =>
  sm<{ volumes: { market_id: string; volume: number; double_stake_volume: number }[] }>(
    `/markets/${marketIds.join(',')}/volumes/`,
  ).then((j) => j.volumes ?? []);

/** Smarkets market -> our (market, line). Returns null for markets we don't track. */
export function mapMarket(m: SmMarket): { market: string; line: number } | null {
  const type = m.market_type?.name;
  if (type === 'WINNER_3_WAY' && /full[- ]time result|only regular time/i.test(m.name)) return { market: '1X2', line: 0 };
  if (type === 'WINNER_2_WAY' && !/map\s*\d/i.test(m.name)) return { market: 'ML', line: 0 };
  if (type === 'BTTS') return { market: 'BTTS', line: 0 };
  if (type === 'OVER_UNDER') {
    const n = Number(m.name.match(/([\d.]+)/)?.[1]);
    return Number.isFinite(n) ? { market: 'OU', line: n } : null;
  }
  if (type === 'HANDICAP') {
    const n = Number(m.name.match(/([+-][\d.]+)/)?.[1]);
    return Number.isFinite(n) ? { market: 'AH', line: n } : null;
  }
  return null;
}

/** Competition slug out of "/sport/basketball/wnba/2026/09/18/..." */
export function competitionOf(fullSlug: string): string {
  const parts = (fullSlug ?? '').split('/').filter(Boolean);
  return parts[2] ?? 'other';
}

export function mapContract(c: SmContract): string | null {
  return ({ HOME: 'HOME', DRAW: 'DRAW', AWAY: 'AWAY', OVER: 'OVER', UNDER: 'UNDER', YES: 'YES', NO: 'NO' } as Record<string, string>)[
    c.contract_type?.name
  ] ?? null;
}

/**
 * Order-book read.
 *
 * Smarkets quotes are BUY orders ("bids") and SELL orders ("offers"). Backing an
 * outcome means buying, so the price we could actually get is the best SELL
 * order, not the best bid — reading the bid side reports a price nobody will
 * give us. The bid side is still meaningful as *money that wants to back*, which
 * is what the money-flow signal uses.
 */
export function readBook(q: { bids?: SmQuoteSide[]; offers?: SmQuoteSide[] } | undefined) {
  if (!q) return null;
  const bestBid = q.bids?.[0];      // someone wants to back at this probability
  const bestOffer = q.offers?.[0];  // someone offers to lay — this is what a backer takes
  const depth = (side?: SmQuoteSide[]) => (side ?? []).reduce((a, s) => a + s.quantity, 0);

  const backPrice = bestOffer ? priceToDecimal(bestOffer.price) : null;   // available to us
  const layPrice = bestBid ? priceToDecimal(bestBid.price) : null;
  const midProb = bestBid && bestOffer
    ? (bestBid.price + bestOffer.price) / 2 / 10000
    : bestBid ? bestBid.price / 10000
    : bestOffer ? bestOffer.price / 10000
    : null;

  return {
    backPrice, layPrice,
    midPrice: midProb ? +(1 / midProb).toFixed(3) : null,
    midProb,
    backMoney: bookMoney(depth(q.bids)),   // money pushing onto this outcome
    layMoney: bookMoney(depth(q.offers)),  // money willing to take the other side
  };
}
