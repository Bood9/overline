import { run, db } from '@/lib/db';
import { teamRu, leagueRu, countryRu } from '@/lib/util/ru';

export function upsertLeague(l: {
  id: number; name: string; country: string; logo?: string | null; flag?: string | null;
  tier?: number; season?: number | null; provider?: string;
}) {
  run(
    `INSERT INTO leagues(id,provider,name,name_ru,country,country_ru,logo,flag,tier,season,updated_at)
     VALUES(@id,@provider,@name,@name_ru,@country,@country_ru,@logo,@flag,@tier,@season,datetime('now'))
     ON CONFLICT(id) DO UPDATE SET name=@name, name_ru=@name_ru, country=@country,
       country_ru=@country_ru, logo=COALESCE(@logo,leagues.logo), flag=COALESCE(@flag,leagues.flag),
       tier=@tier, season=COALESCE(@season,leagues.season), updated_at=datetime('now')`,
    {
      id: l.id, provider: l.provider ?? 'espn', name: l.name, name_ru: leagueRu(l.name),
      country: l.country, country_ru: countryRu(l.country), logo: l.logo ?? null,
      flag: l.flag ?? null, tier: l.tier ?? 5, season: l.season ?? null,
    },
  );
}

export function upsertTeam(t: {
  id: number; name: string; short_name?: string | null; logo?: string | null;
  country?: string | null; provider?: string;
}) {
  run(
    `INSERT INTO teams(id,provider,name,name_ru,short_name,country,logo,updated_at)
     VALUES(@id,@provider,@name,@name_ru,@short_name,@country,@logo,datetime('now'))
     ON CONFLICT(id) DO UPDATE SET name=@name, name_ru=@name_ru,
       short_name=COALESCE(@short_name,teams.short_name), logo=COALESCE(@logo,teams.logo),
       country=COALESCE(@country,teams.country), updated_at=datetime('now')`,
    {
      id: t.id, provider: t.provider ?? 'espn', name: t.name, name_ru: teamRu(t.name),
      short_name: t.short_name ?? null, country: t.country ?? null, logo: t.logo ?? null,
    },
  );
}

export function upsertFixture(f: {
  id: number; league_id: number; season?: number | null; round?: string | null;
  kickoff: string; status: string; minute?: number | null;
  home_id: number; away_id: number;
  goals_home?: number | null; goals_away?: number | null;
  ht_home?: number | null; ht_away?: number | null;
  venue?: string | null; city?: string | null; referee?: string | null; provider?: string;
}) {
  run(
    `INSERT INTO fixtures(id,provider,league_id,season,round,kickoff,status,minute,home_id,away_id,
        goals_home,goals_away,ht_home,ht_away,venue,city,referee,updated_at)
     VALUES(@id,@provider,@league_id,@season,@round,@kickoff,@status,@minute,@home_id,@away_id,
        @goals_home,@goals_away,@ht_home,@ht_away,@venue,@city,@referee,datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       league_id=@league_id, kickoff=@kickoff, status=@status, minute=@minute,
       goals_home=COALESCE(@goals_home,fixtures.goals_home),
       goals_away=COALESCE(@goals_away,fixtures.goals_away),
       ht_home=COALESCE(@ht_home,fixtures.ht_home), ht_away=COALESCE(@ht_away,fixtures.ht_away),
       venue=COALESCE(@venue,fixtures.venue), city=COALESCE(@city,fixtures.city),
       referee=COALESCE(@referee,fixtures.referee), round=COALESCE(@round,fixtures.round),
       season=COALESCE(@season,fixtures.season), updated_at=datetime('now')`,
    {
      id: f.id, provider: f.provider ?? 'espn', league_id: f.league_id, season: f.season ?? null,
      round: f.round ?? null, kickoff: f.kickoff, status: f.status, minute: f.minute ?? null,
      home_id: f.home_id, away_id: f.away_id,
      goals_home: f.goals_home ?? null, goals_away: f.goals_away ?? null,
      ht_home: f.ht_home ?? null, ht_away: f.ht_away ?? null,
      venue: f.venue ?? null, city: f.city ?? null, referee: f.referee ?? null,
    },
  );
}

export function upsertStats(fixtureId: number, teamId: number, side: 'home' | 'away', s: Record<string, number | null>) {
  run(
    `INSERT INTO fixture_stats(fixture_id,team_id,side,shots,shots_on,corners,fouls,yellow,red,
        possession,xg,offsides,saves,passes,pass_acc,updated_at)
     VALUES(@fixture_id,@team_id,@side,@shots,@shots_on,@corners,@fouls,@yellow,@red,
        @possession,@xg,@offsides,@saves,@passes,@pass_acc,datetime('now'))
     ON CONFLICT(fixture_id,team_id) DO UPDATE SET
       shots=@shots, shots_on=@shots_on, corners=@corners, fouls=@fouls, yellow=@yellow, red=@red,
       possession=@possession, xg=COALESCE(@xg,fixture_stats.xg), offsides=@offsides, saves=@saves,
       passes=@passes, pass_acc=@pass_acc, updated_at=datetime('now')`,
    {
      fixture_id: fixtureId, team_id: teamId, side,
      shots: s.shots ?? null, shots_on: s.shots_on ?? null, corners: s.corners ?? null,
      fouls: s.fouls ?? null, yellow: s.yellow ?? null, red: s.red ?? null,
      possession: s.possession ?? null, xg: s.xg ?? null, offsides: s.offsides ?? null,
      saves: s.saves ?? null, passes: s.passes ?? null, pass_acc: s.pass_acc ?? null,
    },
  );
}

export interface OddsInput {
  fixture_id: number; bookmaker: string; market: string; line?: number;
  selection: string; price: number; open_price?: number | null; phase?: 'prematch' | 'live';
  captured_at?: string;
}

/** Writes a snapshot and folds it into odds_current (open price is sticky). */
export function recordOdds(o: OddsInput) {
  const now = o.captured_at ?? new Date().toISOString();
  const line = o.line ?? 0;
  const phase = o.phase ?? 'prematch';
  if (!Number.isFinite(o.price) || o.price <= 1) return;

  run(
    `INSERT INTO odds_snapshots(fixture_id,bookmaker,market,line,selection,price,captured_at,phase)
     VALUES(@fixture_id,@bookmaker,@market,@line,@selection,@price,@captured_at,@phase)`,
    { ...o, line, captured_at: now, phase },
  );

  const open = o.open_price && o.open_price > 1 ? o.open_price : null;
  run(
    `INSERT INTO odds_current(fixture_id,market,line,selection,open_price,price,best_price,best_book,books,movement,opened_at,updated_at,phase)
     VALUES(@fixture_id,@market,@line,@selection,COALESCE(@open,@price),@price,@price,@bookmaker,1,
       ROUND((@price-COALESCE(@open,@price))/COALESCE(@open,@price)*100,2),@now,@now,@phase)
     ON CONFLICT(fixture_id,market,line,selection,phase) DO UPDATE SET
       open_price=COALESCE(@open, odds_current.open_price),
       price=@price,
       best_price=CASE WHEN @price > COALESCE(odds_current.best_price,0) THEN @price ELSE odds_current.best_price END,
       best_book=CASE WHEN @price > COALESCE(odds_current.best_price,0) THEN @bookmaker ELSE odds_current.best_book END,
       movement=ROUND((@price - COALESCE(@open, odds_current.open_price)) / COALESCE(@open, odds_current.open_price) * 100, 2),
       updated_at=@now`,
    {
      fixture_id: o.fixture_id, market: o.market, line, selection: o.selection,
      price: o.price, open, bookmaker: o.bookmaker, now, phase,
    },
  );
}

export const tx = <T,>(fn: () => T) => db().transaction(fn)();
