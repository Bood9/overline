import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const file = process.env.DB_PATH || path.join(process.cwd(), 'data', 'overline.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma('journal_mode = WAL');
  conn.pragma('busy_timeout = 5000');
  const schema = fs.readFileSync(path.join(process.cwd(), 'src/lib/db/schema.sql'), 'utf8');
  conn.exec(schema);
  migrate(conn);
  _db = conn;
  return conn;
}

/**
 * Columns and indexes added after a database already exists. Each statement is
 * idempotent on its own, so running this on every open is safe and cheap.
 */
const MIGRATIONS: string[] = [
  `ALTER TABLE leagues  ADD COLUMN sport TEXT NOT NULL DEFAULT 'football'`,
  `ALTER TABLE teams    ADD COLUMN sport TEXT NOT NULL DEFAULT 'football'`,
  `ALTER TABLE fixtures ADD COLUMN sport TEXT NOT NULL DEFAULT 'football'`,
  `ALTER TABLE insights ADD COLUMN model_prob REAL`,
  `ALTER TABLE insights ADD COLUMN market_prob REAL`,
  `ALTER TABLE insights ADD COLUMN price_source TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_fixtures_sport ON fixtures(sport, kickoff)`,
];

function migrate(conn: Database.Database) {
  for (const sql of MIGRATIONS) {
    try {
      conn.exec(sql);
    } catch (e: any) {
      // "duplicate column name" simply means the migration already ran
      if (!/duplicate column name|already exists/i.test(String(e?.message))) throw e;
    }
  }
}

export function all<T = any>(sql: string, params: any = {}): T[] {
  return db().prepare(sql).all(params) as T[];
}
export function one<T = any>(sql: string, params: any = {}): T | undefined {
  return db().prepare(sql).get(params) as T | undefined;
}
export function run(sql: string, params: any = {}) {
  return db().prepare(sql).run(params);
}
export function tx<T>(fn: () => T): T {
  return db().transaction(fn)();
}

export function kvGet(key: string): string | null {
  const r = one<{ v: string }>('SELECT v FROM kv WHERE k = @k', { k: key });
  return r?.v ?? null;
}
export function kvSet(key: string, value: string) {
  run(
    `INSERT INTO kv(k,v,updated_at) VALUES(@k,@v,datetime('now'))
     ON CONFLICT(k) DO UPDATE SET v=@v, updated_at=datetime('now')`,
    { k: key, v: value },
  );
}

export function logIngest(job: string, status: string, detail: string, items = 0, ms = 0) {
  run(
    `INSERT INTO ingest_log(job,status,detail,items,ms) VALUES(@job,@status,@detail,@items,@ms)`,
    { job, status, detail: detail.slice(0, 2000), items, ms },
  );
}
