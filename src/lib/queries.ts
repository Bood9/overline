import { all, one } from '@/lib/db';
import { selectionLabel } from '@/lib/types';

const FIXTURE_SELECT = `
  SELECT f.id, f.league_id, f.kickoff, f.status, f.minute, f.home_id, f.away_id,
         f.goals_home, f.goals_away, f.venue, f.city, f.referee, f.round, f.season,
         l.name AS league_name, COALESCE(l.name_ru,l.name) AS league_ru, l.logo AS league_logo,
         COALESCE(l.country_ru,l.country) AS country, l.tier, f.sport,
         th.name AS home, COALESCE(th.name_ru,th.name) AS home_ru, th.logo AS home_logo,
         ta.name AS away, COALESCE(ta.name_ru,ta.name) AS away_ru, ta.logo AS away_logo
    FROM fixtures f
    JOIN teams th ON th.id=f.home_id
    JOIN teams ta ON ta.id=f.away_id
    LEFT JOIN leagues l ON l.id=f.league_id`;

export interface FixtureCard {
  id: number; kickoff: string; status: string; minute: number | null;
  league_name: string; league_ru: string; league_logo: string | null; country: string | null; tier: number;
  home: string; home_ru: string; home_logo: string | null;
  away: string; away_ru: string; away_logo: string | null;
  goals_home: number | null; goals_away: number | null;
  venue: string | null; referee: string | null;
  odds?: { market?: string; selection: string; price: number; movement: number }[];
  top_score?: number | null;
}

function attach1x2(rows: FixtureCard[]): FixtureCard[] {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const odds = all<{ fixture_id: number; market: string; selection: string; price: number; movement: number }>(
    `SELECT fixture_id, market, selection, price, movement FROM odds_current
      WHERE market IN ('1X2','ML') AND phase='prematch' AND fixture_id IN (${ids.join(',')})`,
  );
  const order = { HOME: 0, DRAW: 1, AWAY: 2 } as Record<string, number>;
  for (const r of rows) {
    const mine = odds.filter((o) => o.fixture_id === r.id);
    // a fixture can carry both a 3-way and a 2-way winner market (hockey does);
    // show one of them, preferring the three-way line
    const market = mine.some((o) => o.market === '1X2') ? '1X2' : 'ML';
    r.odds = mine
      .filter((o) => o.market === market)
      .sort((a, b) => (order[a.selection] ?? 9) - (order[b.selection] ?? 9));
  }
  return rows;
}

export function getTopMatches(limit = 6, sport = 'football'): FixtureCard[] {
  const rows = all<FixtureCard>(
    `${FIXTURE_SELECT}
      WHERE datetime(f.kickoff) > datetime('now','-2 hours') AND f.sport = @sport
      ORDER BY COALESCE(l.tier,9) ASC, f.kickoff ASC LIMIT @limit`,
    { limit, sport },
  );
  const withScore = rows.map((r) => ({
    ...r,
    top_score: one<{ s: number }>('SELECT MAX(score) AS s FROM insights WHERE fixture_id=@id', { id: r.id })?.s ?? null,
  }));
  return attach1x2(withScore);
}

export function getLiveMatches(sport?: string): FixtureCard[] {
  return attach1x2(
    all<FixtureCard>(
      `${FIXTURE_SELECT} WHERE f.status IN ('1H','2H','HT','ET','PEN','LIVE')
        ${sport ? 'AND f.sport = @sport' : ''} ORDER BY f.kickoff`,
      { sport },
    ),
  );
}

export function getSportCounts(date: string) {
  return all<{ sport: string; n: number }>(
    `SELECT sport, COUNT(*) n FROM fixtures WHERE date(kickoff) = @date GROUP BY sport`,
    { date },
  );
}

export interface DayGroup { league_id: number; league_ru: string; league_logo: string | null; country: string | null; matches: FixtureCard[] }

export function getMatchesByDate(
  date: string, leagueTier?: number | null, liveOnly = false, sport = 'football',
): DayGroup[] {
  const rows = attach1x2(
    all<FixtureCard>(
      `${FIXTURE_SELECT}
        WHERE date(f.kickoff) = @date AND f.sport = @sport
          ${liveOnly ? "AND f.status IN ('1H','2H','HT','ET','PEN','LIVE')" : ''}
        ORDER BY COALESCE(l.tier,9), l.name, f.kickoff`,
      { date, sport },
    ),
  );
  const groups = new Map<number, DayGroup>();
  for (const r of rows as any[]) {
    if (!groups.has(r.league_id)) {
      groups.set(r.league_id, {
        league_id: r.league_id, league_ru: r.league_ru, league_logo: r.league_logo,
        country: r.country, matches: [],
      });
    }
    groups.get(r.league_id)!.matches.push(r);
  }
  return [...groups.values()];
}

export function searchFixtures(q: string, limit = 20): FixtureCard[] {
  const like = `%${q}%`;
  return attach1x2(
    all<FixtureCard>(
      `${FIXTURE_SELECT}
        WHERE (th.name LIKE @q OR ta.name LIKE @q OR th.name_ru LIKE @q OR ta.name_ru LIKE @q
               OR l.name LIKE @q OR l.name_ru LIKE @q)
          AND datetime(f.kickoff) > datetime('now','-2 days')
        ORDER BY f.kickoff LIMIT @limit`,
      { q: like, limit },
    ),
  );
}

export function getFixture(id: number) {
  const fixture = one<FixtureCard & { league_id: number; home_id: number; away_id: number }>(
    `${FIXTURE_SELECT} WHERE f.id=@id`, { id },
  );
  if (!fixture) return null;
  const odds = all<any>(
    `SELECT market,line,selection,open_price,price,best_price,best_book,movement,books,updated_at
       FROM odds_current WHERE fixture_id=@id AND phase='prematch'
      ORDER BY market, line, selection`, { id },
  ).map((o) => ({ ...o, label: selectionLabel(o.market, o.line, o.selection) }));
  const money = all<any>(
    `SELECT market,line,selection,share,volume,source FROM money_flow WHERE fixture_id=@id`, { id },
  ).map((m) => ({ ...m, label: selectionLabel(m.market, m.line, m.selection) }));
  const insights = all<any>(
    `SELECT * FROM insights WHERE fixture_id=@id ORDER BY score DESC LIMIT 14`, { id },
  ).map((i) => ({ ...i, signals: JSON.parse(i.signals || '[]') }));
  const stats = all<any>(`SELECT * FROM fixture_stats WHERE fixture_id=@id`, { id });
  const h2h = all<any>(
    `SELECT f.kickoff, f.goals_home, f.goals_away,
            COALESCE(th.name_ru,th.name) AS home, COALESCE(ta.name_ru,ta.name) AS away
       FROM fixtures f JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
      WHERE f.status IN ('FT','AET','PEN')
        AND ((f.home_id=@h AND f.away_id=@a) OR (f.home_id=@a AND f.away_id=@h))
      ORDER BY f.kickoff DESC LIMIT 6`,
    { h: fixture.home_id, a: fixture.away_id },
  );
  const form = {
    home: one<any>('SELECT * FROM team_form WHERE team_id=@id', { id: fixture.home_id }) ?? null,
    away: one<any>('SELECT * FROM team_form WHERE team_id=@id', { id: fixture.away_id }) ?? null,
  };
  const referee = fixture.referee
    ? one<any>('SELECT * FROM referees WHERE name=@n', { n: fixture.referee }) ?? null
    : null;
  const history = all<any>(
    `SELECT market,line,selection,price,captured_at FROM odds_snapshots
      WHERE fixture_id=@id AND market='1X2' ORDER BY captured_at LIMIT 400`, { id },
  );
  return { fixture, odds, money, insights, stats, h2h, form, referee, history };
}

export interface InsightCard {
  id: number; fixture_id: number; label: string; market: string; line: number; selection: string;
  category: string; score: number; headline: string | null; signals: any[]; price: number | null; edge: number | null;
  kickoff: string; league_ru: string; home_ru: string; away_ru: string;
  home_logo: string | null; away_logo: string | null;
  alternatives: { label: string; market: string; score: number }[];
}

export function getInsights(opts: { day?: 'today' | 'tomorrow'; category?: string; limit?: number } = {}): InsightCard[] {
  const { day = 'today', category = 'all', limit = 40 } = opts;
  const where = day === 'today'
    ? `date(f.kickoff) = date('now')`
    : `date(f.kickoff) = date('now','+1 day')`;
  const rows = all<any>(
    `WITH ranked AS (
       SELECT i.*, ROW_NUMBER() OVER (PARTITION BY i.fixture_id ORDER BY i.score DESC) rn
         FROM insights i JOIN fixtures f ON f.id=i.fixture_id
        WHERE ${where} AND f.status='NS' ${category !== 'all' ? 'AND i.category=@category' : ''}
     )
     SELECT r.*, f.kickoff, COALESCE(l.name_ru,l.name) AS league_ru,
            COALESCE(th.name_ru,th.name) AS home_ru, COALESCE(ta.name_ru,ta.name) AS away_ru,
            th.logo AS home_logo, ta.logo AS away_logo
       FROM ranked r
       JOIN fixtures f ON f.id=r.fixture_id
       JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
       LEFT JOIN leagues l ON l.id=f.league_id
      WHERE r.rn = 1
      ORDER BY r.score DESC LIMIT @limit`,
    { category, limit },
  );
  return rows.map((r) => ({
    ...r,
    signals: JSON.parse(r.signals || '[]'),
    alternatives: all<any>(
      `SELECT label, market, score FROM insights
        WHERE fixture_id=@f AND NOT (market=@m AND line=@l AND selection=@s)
        ORDER BY score DESC LIMIT 3`,
      { f: r.fixture_id, m: r.market, l: r.line, s: r.selection },
    ),
  }));
}

export function getInsightStats(day: 'today' | 'tomorrow' = 'today') {
  const where = day === 'today' ? `date('now')` : `date('now','+1 day')`;
  const r = one<{ matches: number; hot: number }>(
    `SELECT COUNT(DISTINCT i.fixture_id) AS matches,
            COUNT(DISTINCT CASE WHEN i.score >= 85 THEN i.fixture_id END) AS hot
       FROM insights i JOIN fixtures f ON f.id=i.fixture_id
      WHERE date(f.kickoff) = ${where} AND f.status='NS'`,
  );
  return { matches: r?.matches ?? 0, hot: r?.hot ?? 0 };
}

export interface FlowRow {
  fixture_id: number; kickoff: string; league_ru: string; country: string | null;
  home_ru: string; away_ru: string; market: string; line: number;
  volume: number;
  rows: { selection: string; label: string; share: number; volume: number; price: number; open_price: number; movement: number; best: boolean }[];
}

export function getMoneyway(opts: {
  mode?: 'money' | 'drop' | 'combined'; market?: string; phase?: 'prematch' | 'live';
  country?: string; league?: string; sort?: 'share' | 'move' | 'volume' | 'date';
  q?: string; limit?: number;
} = {}): FlowRow[] {
  const { mode = 'money', market = '1X2', phase = 'prematch', sort = 'share', q = '', limit = 60 } = opts;
  const groups = all<any>(
    `SELECT mf.fixture_id, mf.market, mf.line, SUM(mf.volume) AS volume,
            MAX(ABS(oc.movement)) AS max_move, MAX(mf.share) AS max_share,
            f.kickoff, COALESCE(l.name_ru,l.name) AS league_ru, COALESCE(l.country_ru,l.country) AS country,
            COALESCE(th.name_ru,th.name) AS home_ru, COALESCE(ta.name_ru,ta.name) AS away_ru
       FROM money_flow mf
       JOIN fixtures f ON f.id=mf.fixture_id
       LEFT JOIN odds_current oc ON oc.fixture_id=mf.fixture_id AND oc.market=mf.market
            AND oc.line=mf.line AND oc.selection=mf.selection AND oc.phase=@phase
       JOIN teams th ON th.id=f.home_id JOIN teams ta ON ta.id=f.away_id
       LEFT JOIN leagues l ON l.id=f.league_id
      WHERE mf.market=@market AND datetime(f.kickoff) > datetime('now','-3 hours')
        ${opts.country ? 'AND COALESCE(l.country_ru,l.country)=@country' : ''}
        ${opts.league ? 'AND COALESCE(l.name_ru,l.name)=@league' : ''}
        ${q ? 'AND (th.name_ru LIKE @q OR ta.name_ru LIKE @q OR l.name_ru LIKE @q OR l.country_ru LIKE @q)' : ''}
      GROUP BY mf.fixture_id, mf.market, mf.line
      ORDER BY ${
        sort === 'volume' ? 'volume DESC'
        : sort === 'move' ? 'max_move DESC'
        : sort === 'date' ? 'f.kickoff ASC'
        : 'max_share DESC'
      }
      LIMIT @limit`,
    { market, phase, limit, q: `%${q}%`, country: opts.country, league: opts.league },
  );

  return groups.map((g) => {
    const rows = all<any>(
      `SELECT mf.selection, mf.share, mf.volume,
              COALESCE(oc.price,0) AS price, COALESCE(oc.open_price,0) AS open_price,
              COALESCE(oc.movement,0) AS movement
         FROM money_flow mf
         LEFT JOIN odds_current oc ON oc.fixture_id=mf.fixture_id AND oc.market=mf.market
              AND oc.line=mf.line AND oc.selection=mf.selection AND oc.phase=@phase
        WHERE mf.fixture_id=@f AND mf.market=@m AND mf.line=@l`,
      { f: g.fixture_id, m: g.market, l: g.line, phase },
    );
    const minPrice = Math.min(...rows.filter((r) => r.price > 0).map((r) => r.price));
    const order = { HOME: 0, DRAW: 1, AWAY: 2, OVER: 0, UNDER: 1, YES: 0, NO: 1 } as Record<string, number>;
    return {
      ...g,
      rows: rows
        .sort((a, b) => (order[a.selection] ?? 9) - (order[b.selection] ?? 9))
        .map((r) => ({ ...r, label: selectionLabel(g.market, g.line, r.selection), best: r.price === minPrice })),
    } as FlowRow;
  }).filter((g) => (mode === 'drop' ? g.rows.some((r) => Math.abs(r.movement) >= 1) : true));
}

export function getMarketCounts(phase: 'prematch' | 'live' = 'prematch') {
  return all<{ market: string; n: number }>(
    `SELECT market, COUNT(DISTINCT fixture_id) AS n FROM odds_current
      WHERE phase=@phase GROUP BY market`, { phase },
  );
}

export function getFilterOptions() {
  return {
    countries: all<{ v: string }>(
      `SELECT DISTINCT COALESCE(country_ru,country) AS v FROM leagues WHERE country IS NOT NULL ORDER BY v`,
    ).map((r) => r.v),
    leagues: all<{ v: string }>(
      `SELECT DISTINCT COALESCE(name_ru,name) AS v FROM leagues ORDER BY tier, v`,
    ).map((r) => r.v),
  };
}

export function getReferees(opts: { league?: string; sort?: 'yellow' | 'fouls' | 'red' | 'matches'; limit?: number } = {}) {
  const { league, sort = 'yellow', limit = 60 } = opts;
  const col = { yellow: 'yellow_avg', fouls: 'fouls_avg', red: 'red_avg', matches: 'matches' }[sort];
  return all<any>(
    `SELECT * FROM referees WHERE matches > 0 ${league && league !== 'all' ? 'AND league=@league' : ''}
      ORDER BY ${col} DESC, matches DESC LIMIT @limit`,
    { league, limit },
  );
}
export function getRefereeLeagues() {
  return all<{ v: string }>(`SELECT DISTINCT league AS v FROM referees WHERE league IS NOT NULL ORDER BY v`).map((r) => r.v);
}
export function getRefereeCount() {
  return one<{ n: number }>('SELECT COUNT(*) AS n FROM referees')?.n ?? 0;
}

export function getNews(opts: { source?: string; q?: string; limit?: number } = {}) {
  const { source, q, limit = 60 } = opts;
  return all<any>(
    `SELECT * FROM news
      WHERE 1=1 ${source && source !== 'all' ? 'AND source=@source' : ''} ${q ? 'AND title LIKE @q' : ''}
      ORDER BY published_at DESC LIMIT @limit`,
    { source, q: `%${q}%`, limit },
  );
}
export function getNewsSources() {
  return all<{ v: string }>('SELECT DISTINCT source AS v FROM news ORDER BY v').map((r) => r.v);
}

export function getHealth() {
  return {
    fixtures: one<{ n: number }>('SELECT COUNT(*) AS n FROM fixtures')?.n ?? 0,
    upcoming: one<{ n: number }>(`SELECT COUNT(*) AS n FROM fixtures WHERE datetime(kickoff) > datetime('now')`)?.n ?? 0,
    teams: one<{ n: number }>('SELECT COUNT(*) AS n FROM teams')?.n ?? 0,
    odds: one<{ n: number }>('SELECT COUNT(*) AS n FROM odds_current')?.n ?? 0,
    snapshots: one<{ n: number }>('SELECT COUNT(*) AS n FROM odds_snapshots')?.n ?? 0,
    insights: one<{ n: number }>('SELECT COUNT(*) AS n FROM insights')?.n ?? 0,
    news: one<{ n: number }>('SELECT COUNT(*) AS n FROM news')?.n ?? 0,
    referees: one<{ n: number }>('SELECT COUNT(*) AS n FROM referees')?.n ?? 0,
    jobs: all<any>('SELECT job,status,items,ms,created_at FROM ingest_log ORDER BY created_at DESC LIMIT 12'),
  };
}
