export type Market = '1X2' | 'ML' | 'OU' | 'BTTS' | 'DC' | 'AH' | 'CORNERS' | 'CARDS' | 'FOULS' | '1H_1X2' | 'DNB';
export type Phase = 'prematch' | 'live';
export type Category = 'outcome' | 'goals' | 'cards' | 'fouls' | 'corners' | 'minutes';

export interface LeagueRow {
  id: number; name: string; name_ru: string | null; country: string | null;
  country_ru: string | null; logo: string | null; flag: string | null; tier: number; season: number | null;
}
export interface TeamRow {
  id: number; name: string; name_ru: string | null; short_name: string | null;
  country: string | null; logo: string | null;
}
export interface FixtureRow {
  id: number; league_id: number; season: number | null; round: string | null;
  kickoff: string; status: string; minute: number | null;
  home_id: number; away_id: number;
  goals_home: number | null; goals_away: number | null;
  ht_home: number | null; ht_away: number | null;
  venue: string | null; city: string | null; referee: string | null;
}
export interface FixtureFull extends FixtureRow {
  league_name: string; league_ru: string; league_logo: string | null; country: string | null;
  home: string; home_ru: string; home_logo: string | null;
  away: string; away_ru: string; away_logo: string | null;
  odds?: OddsQuote[];
}
export interface OddsQuote {
  market: Market | string; line: number; selection: string;
  price: number; open_price: number; movement: number;
  best_price?: number | null; best_book?: string | null; books?: number; phase?: Phase;
}
export interface MoneyRow {
  fixture_id: number; market: string; line: number; selection: string;
  share: number; volume: number; bets: number | null; source: string;
}
export interface InsightRow {
  id: number; fixture_id: number; market: string; line: number; selection: string;
  label: string; category: Category; score: number; headline: string | null;
  signals: string; price: number | null; edge: number | null; created_at: string;
}
export interface Signal { source: string; weight: number; text: string; }

export const LIVE_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
export const DONE_STATUSES = ['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO'];

export function selectionLabel(market: string, line: number, sel: string): string {
  switch (market) {
    case '1X2': return sel === 'HOME' ? 'П1' : sel === 'DRAW' ? 'X' : 'П2';
    case 'ML': return sel === 'HOME' ? 'П1' : 'П2';
    case '1H_1X2': return (sel === 'HOME' ? 'П1' : sel === 'DRAW' ? 'X' : 'П2') + ' (1 тайм)';
    case 'DC': return sel === 'HOME_DRAW' ? '1X' : sel === 'HOME_AWAY' ? '12' : 'X2';
    case 'DNB': return sel === 'HOME' ? 'П1 (без ничьей)' : 'П2 (без ничьей)';
    case 'OU': return (sel === 'OVER' ? 'ТБ ' : 'ТМ ') + line;
    case 'CORNERS': return (sel === 'OVER' ? 'Угловые ТБ ' : 'Угловые ТМ ') + line;
    case 'CARDS': return (sel === 'OVER' ? 'ЖК ТБ ' : 'ЖК ТМ ') + line;
    case 'FOULS': return (sel === 'OVER' ? 'Фолы ТБ ' : 'Фолы ТМ ') + line;
    case 'BTTS': return sel === 'YES' ? 'Обе забьют — да' : 'Обе забьют — нет';
    case 'AH': return `Фора ${sel === 'HOME' ? '1' : '2'} ${line > 0 ? '+' : ''}${line}`;
    default: return `${market} ${sel}`;
  }
}
export function marketLabel(market: string): string {
  return ({
    '1X2': 'Исход', ML: 'Победитель', '1H_1X2': '1-й тайм', OU: 'Тотал', BTTS: 'Обе забьют',
    DC: 'Двойной шанс', AH: 'Фора', CORNERS: 'Угловые', CARDS: 'Карточки',
    FOULS: 'Фолы', DNB: 'Ничья — возврат',
  } as Record<string, string>)[market] ?? market;
}
export function categoryOf(market: string): Category {
  if (market === 'CARDS') return 'cards';
  if (market === 'FOULS') return 'fouls';
  if (market === 'CORNERS') return 'corners';
  if (market === 'OU' || market === 'BTTS') return 'goals';
  return 'outcome';
}
