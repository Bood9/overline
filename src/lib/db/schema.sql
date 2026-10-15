PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leagues (
  id            INTEGER PRIMARY KEY,
  provider      TEXT NOT NULL DEFAULT 'espn',
  sport         TEXT NOT NULL DEFAULT 'football',
  name          TEXT NOT NULL,
  name_ru       TEXT,
  country       TEXT,
  country_ru    TEXT,
  logo          TEXT,
  flag          TEXT,
  tier          INTEGER NOT NULL DEFAULT 5,
  season        INTEGER,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id            INTEGER PRIMARY KEY,
  provider      TEXT NOT NULL DEFAULT 'espn',
  sport         TEXT NOT NULL DEFAULT 'football',
  name          TEXT NOT NULL,
  name_ru       TEXT,
  short_name    TEXT,
  country       TEXT,
  logo          TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

CREATE TABLE IF NOT EXISTS fixtures (
  id            INTEGER PRIMARY KEY,
  provider      TEXT NOT NULL DEFAULT 'espn',
  sport         TEXT NOT NULL DEFAULT 'football',
  league_id     INTEGER REFERENCES leagues(id),
  season        INTEGER,
  round         TEXT,
  kickoff       TEXT NOT NULL,              -- ISO UTC
  status        TEXT NOT NULL DEFAULT 'NS', -- NS,1H,HT,2H,ET,PEN,FT,AET,PST,CANC
  minute        INTEGER,
  home_id       INTEGER REFERENCES teams(id),
  away_id       INTEGER REFERENCES teams(id),
  goals_home    INTEGER,
  goals_away    INTEGER,
  ht_home       INTEGER,
  ht_away       INTEGER,
  venue         TEXT,
  city          TEXT,
  referee       TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff ON fixtures(kickoff);
CREATE INDEX IF NOT EXISTS idx_fixtures_league ON fixtures(league_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);

CREATE TABLE IF NOT EXISTS fixture_stats (
  fixture_id    INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  team_id       INTEGER NOT NULL,
  side          TEXT NOT NULL,      -- home | away
  shots         INTEGER, shots_on   INTEGER,
  corners       INTEGER, fouls      INTEGER,
  yellow        INTEGER, red        INTEGER,
  possession    REAL,    xg         REAL,
  offsides      INTEGER, saves      INTEGER,
  passes        INTEGER, pass_acc   REAL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (fixture_id, team_id)
);

-- every odds snapshot; powers movement / dropping odds
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id    INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  bookmaker     TEXT NOT NULL,
  market        TEXT NOT NULL,   -- 1X2, OU, BTTS, DC, AH, CORNERS, CARDS, 1H_1X2
  line          REAL,            -- 2.5 for totals, handicap for AH
  selection     TEXT NOT NULL,   -- HOME/DRAW/AWAY/OVER/UNDER/YES/NO/1X/12/X2
  price         REAL NOT NULL,
  captured_at   TEXT NOT NULL,
  phase         TEXT NOT NULL DEFAULT 'prematch' -- prematch | live
);
CREATE INDEX IF NOT EXISTS idx_odds_fx ON odds_snapshots(fixture_id, market, selection, captured_at);

-- denormalised current + opening price per (fixture, market, line, selection)
CREATE TABLE IF NOT EXISTS odds_current (
  fixture_id    INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  market        TEXT NOT NULL,
  line          REAL NOT NULL DEFAULT 0,
  selection     TEXT NOT NULL,
  open_price    REAL NOT NULL,
  price         REAL NOT NULL,
  best_price    REAL,
  best_book     TEXT,
  books         INTEGER NOT NULL DEFAULT 0,
  movement      REAL NOT NULL DEFAULT 0,   -- (price-open)/open*100
  opened_at     TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  phase         TEXT NOT NULL DEFAULT 'prematch',
  PRIMARY KEY (fixture_id, market, line, selection, phase)
);
CREATE INDEX IF NOT EXISTS idx_oddscur_move ON odds_current(market, movement);

-- moneyway: distribution of stake volume across selections
CREATE TABLE IF NOT EXISTS money_flow (
  fixture_id    INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  market        TEXT NOT NULL,
  line          REAL NOT NULL DEFAULT 0,
  selection     TEXT NOT NULL,
  share         REAL NOT NULL,       -- 0..100 %
  volume        REAL NOT NULL,       -- money units
  bets          INTEGER,
  source        TEXT NOT NULL DEFAULT 'derived',
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (fixture_id, market, line, selection)
);
CREATE INDEX IF NOT EXISTS idx_money_vol ON money_flow(volume DESC);

CREATE TABLE IF NOT EXISTS referees (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  league        TEXT,
  league_logo   TEXT,
  matches       INTEGER NOT NULL DEFAULT 0,
  fouls_avg     REAL NOT NULL DEFAULT 0,
  yellow_avg    REAL NOT NULL DEFAULT 0,
  red_avg       REAL NOT NULL DEFAULT 0,
  pens_avg      REAL NOT NULL DEFAULT 0,
  season_matches INTEGER NOT NULL DEFAULT 0,
  season_fouls  REAL NOT NULL DEFAULT 0,
  season_yellow REAL NOT NULL DEFAULT 0,
  season_red    REAL NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_form (
  team_id       INTEGER PRIMARY KEY,
  league_id     INTEGER,
  played        INTEGER NOT NULL DEFAULT 0,
  wins INTEGER DEFAULT 0, draws INTEGER DEFAULT 0, losses INTEGER DEFAULT 0,
  gf REAL DEFAULT 0, ga REAL DEFAULT 0,
  xg_for REAL DEFAULT 0, xg_against REAL DEFAULT 0,
  corners_for REAL DEFAULT 0, corners_against REAL DEFAULT 0,
  cards_for REAL DEFAULT 0, fouls_for REAL DEFAULT 0,
  btts_pct REAL DEFAULT 0, over25_pct REAL DEFAULT 0,
  form TEXT,     -- "WWDLW"
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS news (
  id            TEXT PRIMARY KEY,     -- hash of link
  source        TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  image         TEXT,
  summary       TEXT,
  published_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_news_pub ON news(published_at DESC);

-- signal convergence ("Схождение")
CREATE TABLE IF NOT EXISTS insights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id    INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  market        TEXT NOT NULL,
  line          REAL NOT NULL DEFAULT 0,
  selection     TEXT NOT NULL,
  label         TEXT NOT NULL,       -- "ТМ 3.5"
  category      TEXT NOT NULL,       -- outcome|goals|cards|fouls|corners|minutes
  score         INTEGER NOT NULL,    -- 0..100
  headline      TEXT,
  signals       TEXT,                -- json array of {source,weight,text}
  price         REAL,
  edge          REAL,
  model_prob    REAL,
  market_prob   REAL,
  price_source  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(fixture_id, market, line, selection)
);
CREATE INDEX IF NOT EXISTS idx_insights_score ON insights(score DESC);

CREATE TABLE IF NOT EXISTS ai_predictions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id    INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  model         TEXT NOT NULL,
  verdict       TEXT,                -- short headline
  confidence    INTEGER,             -- 0..100
  payload       TEXT NOT NULL,       -- full json {picks:[...], analysis, risks}
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_fx ON ai_predictions(fixture_id, created_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ext_id        TEXT UNIQUE,
  name          TEXT NOT NULL DEFAULT 'Гость',
  tz            TEXT NOT NULL DEFAULT 'Europe/Moscow',
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id       INTEGER NOT NULL,
  kind          TEXT NOT NULL,       -- fixture | team
  ref_id        INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, ref_id)
);

CREATE TABLE IF NOT EXISTS ingest_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  job           TEXT NOT NULL,
  status        TEXT NOT NULL,
  detail        TEXT,
  items         INTEGER DEFAULT 0,
  ms            INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ingest_job ON ingest_log(job, created_at DESC);

CREATE TABLE IF NOT EXISTS kv (
  k             TEXT PRIMARY KEY,
  v             TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- betting-exchange snapshot (real order book + matched volume)
CREATE TABLE IF NOT EXISTS exchange (
  fixture_id     INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  market         TEXT NOT NULL,
  line           REAL NOT NULL DEFAULT 0,
  selection      TEXT NOT NULL,
  back_price     REAL, lay_price REAL, mid_price REAL, fair_prob REAL,
  back_money     REAL NOT NULL DEFAULT 0,
  lay_money      REAL NOT NULL DEFAULT 0,
  matched_volume REAL NOT NULL DEFAULT 0,
  source         TEXT NOT NULL DEFAULT 'smarkets',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (fixture_id, market, line, selection)
);
CREATE INDEX IF NOT EXISTS idx_exchange_vol ON exchange(matched_volume DESC);

-- external provider id -> our fixture id
CREATE TABLE IF NOT EXISTS event_map (
  provider   TEXT NOT NULL,
  ext_id     TEXT NOT NULL,
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, ext_id)
);

-- "Заработок": paper-trading journal, settled automatically from final scores
CREATE TABLE IF NOT EXISTS earn_days (
  day           TEXT PRIMARY KEY,           -- YYYY-MM-DD in the display timezone
  balance_start REAL NOT NULL,
  target        REAL NOT NULL,
  lambda        REAL,
  expected      REAL,
  p_hit         REAL,
  status        TEXT NOT NULL DEFAULT 'open',   -- open | settled
  pnl           REAL NOT NULL DEFAULT 0,
  balance_end   REAL,
  committed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS earn_bets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  day         TEXT NOT NULL REFERENCES earn_days(day) ON DELETE CASCADE,
  fixture_id  INTEGER NOT NULL,
  market      TEXT NOT NULL,
  line        REAL NOT NULL DEFAULT 0,
  selection   TEXT NOT NULL,
  label       TEXT NOT NULL,
  price       REAL NOT NULL,
  stake       REAL NOT NULL,
  prob        REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | won | lost | void | half_won | half_lost
  payout      REAL,
  note        TEXT,
  settled_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_earn_bets_status ON earn_bets(status);

-- immutable record of published picks, so the advice can be checked afterwards
CREATE TABLE IF NOT EXISTS prediction_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id   INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  market       TEXT NOT NULL,
  line         REAL NOT NULL DEFAULT 0,
  selection    TEXT NOT NULL,
  label        TEXT NOT NULL,
  score        INTEGER NOT NULL,
  price        REAL NOT NULL,          -- price at the moment it was published
  latest_price REAL,
  price_source TEXT,
  model_prob   REAL, market_prob REAL, edge REAL,
  kickoff      TEXT NOT NULL,
  result       TEXT,                   -- won | lost | void | half_won | half_lost
  factor       REAL,
  logged_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT,
  settled_at   TEXT,
  UNIQUE(fixture_id, market, line, selection)
);
CREATE INDEX IF NOT EXISTS idx_prediction_result ON prediction_log(result, score);
