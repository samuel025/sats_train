import { Pool, types, type PoolClient, type QueryResult } from "pg";
import { seedDemo } from "./seed";

// bigint / numeric come back as strings by default; COUNT(), SUM() and unix timestamps should be numbers.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

export type Db = {
  all: <T = any>(sql: string, ...params: unknown[]) => Promise<T[]>;
  get: <T = any>(sql: string, ...params: unknown[]) => Promise<T | undefined>;
  run: (sql: string, ...params: unknown[]) => Promise<number>;
};

// Queries are written with ? placeholders; convert to $1, $2, ...
const num = (sql: string) => { let n = 0; return sql.replace(/\?/g, () => "$" + ++n); };
const bind = (exec: (sql: string, params: unknown[]) => Promise<QueryResult>): Db => ({
  all: async (sql, ...p) => (await exec(num(sql), p)).rows,
  get: async (sql, ...p) => (await exec(num(sql), p)).rows[0],
  run: async (sql, ...p) => (await exec(num(sql), p)).rowCount ?? 0,
});

const g = globalThis as unknown as { _pool?: Pool; _ready?: Promise<void> };

function pool() {
  if (g._pool) return g._pool;
  const url = process.env.DATABASE_URL || process.env.NEON_POSTGRES;
  if (!url) throw new Error("Set NEON_POSTGRES (or DATABASE_URL) to your Postgres connection string");
  const p = new Pool({
    connectionString: url.replace("sslmode=require", "sslmode=verify-full"), max: Number(process.env.PG_POOL_MAX || (process.env.VERCEL ? 3 : 5)), idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000,
    // Optional: isolate a run in its own schema (used for tests). Set at connection start, so it cannot race; needs a direct, non-pooled connection.
    ...(process.env.DB_SCHEMA ? { options: `-c search_path=${process.env.DB_SCHEMA}` } : {}),
  });
  p.on("error", (e) => console.error("[pg] idle client error:", e.message));
  return (g._pool = p);
}

const raw = bind((sql, params) => pool().query(sql, params as any[]));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, requester TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL,
  src_lang TEXT NOT NULL, dst_lang TEXT NOT NULL, instructions TEXT NOT NULL, reward_sats INTEGER NOT NULL,
  nwc_enc TEXT NOT NULL, nostr_event_id TEXT, created_at BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  answers_per_item INTEGER NOT NULL DEFAULT 1, min_level INTEGER NOT NULL DEFAULT 0, require_qual INTEGER NOT NULL DEFAULT 0,
  review_sats INTEGER, license TEXT, pause_reason TEXT
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, position INTEGER NOT NULL, prompt TEXT NOT NULL,
  is_check INTEGER NOT NULL DEFAULT 0, known_answer TEXT, labels TEXT, payload TEXT
);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, task_id TEXT NOT NULL, worker TEXT NOT NULL, answer TEXT NOT NULL,
  verdict TEXT NOT NULL, score DOUBLE PRECISION NOT NULL, reason TEXT NOT NULL, attempt INTEGER NOT NULL,
  created_at BIGINT NOT NULL, audio_path TEXT, duration_ms INTEGER
);
CREATE TABLE IF NOT EXISTS audio (submission_id TEXT PRIMARY KEY, data BYTEA NOT NULL);
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, task_id TEXT NOT NULL, worker TEXT NOT NULL, sats INTEGER NOT NULL,
  status TEXT NOT NULL, preimage TEXT, error TEXT, created_at BIGINT NOT NULL, release_at BIGINT, sending INTEGER NOT NULL DEFAULT 0,
  UNIQUE(item_id, worker)
);
CREATE TABLE IF NOT EXISTS workers (pubkey TEXT PRIMARY KEY, lightning_address TEXT);
CREATE TABLE IF NOT EXISTS served (item_id TEXT NOT NULL, worker TEXT NOT NULL, served_at BIGINT NOT NULL, PRIMARY KEY(item_id, worker));
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, task_id TEXT NOT NULL, reviewer TEXT NOT NULL, transcript TEXT NOT NULL,
  similarity DOUBLE PRECISION NOT NULL, match INTEGER NOT NULL, created_at BIGINT NOT NULL, UNIQUE(submission_id, reviewer)
);
CREATE TABLE IF NOT EXISTS quals (
  pubkey TEXT NOT NULL, language TEXT NOT NULL, best_score INTEGER NOT NULL DEFAULT 0, passed INTEGER NOT NULL DEFAULT 0,
  attempts_today INTEGER NOT NULL DEFAULT 0, window_start BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(pubkey, language)
);
CREATE TABLE IF NOT EXISTS consents (
  pubkey TEXT NOT NULL, kind TEXT NOT NULL, version INTEGER NOT NULL, accepted_at BIGINT, withdrawn_at BIGINT, PRIMARY KEY(pubkey, kind)
);
CREATE TABLE IF NOT EXISTS wallet_links (
  pubkey TEXT PRIMARY KEY, nwc_enc TEXT NOT NULL, lud16 TEXT, alias TEXT, methods TEXT NOT NULL, can_send INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_task ON items(task_id, position);
CREATE INDEX IF NOT EXISTS idx_sub_item ON submissions(item_id, worker);
CREATE INDEX IF NOT EXISTS idx_sub_worker ON submissions(worker, task_id);
CREATE INDEX IF NOT EXISTS idx_pay_task ON payouts(task_id);
CREATE INDEX IF NOT EXISTS idx_pay_worker ON payouts(worker, status);
CREATE INDEX IF NOT EXISTS idx_rev_sub ON reviews(submission_id);
-- one row per (item, worker, attempt): concurrent duplicate submits cannot both be recorded
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_attempt ON submissions(item_id, worker, attempt);
`;

async function init() {
  if (process.env.DB_SCHEMA) await pool().query(`CREATE SCHEMA IF NOT EXISTS "${process.env.DB_SCHEMA}"`);
  await pool().query(SCHEMA);
  // Demo tasks use a placeholder wallet, so they only make sense when payments are simulated.
  // Demo tasks need a wallet to pay from: simulated payments, or a funded sandbox link in DEMO_NWC (see `npm run demo:wallet`).
  const mock = process.env.MOCK_PAYMENTS === "1";
  if (mock || (process.env.SEED_DEMO === "1" && process.env.DEMO_NWC)) await seedDemo({ ...raw, tx }, mock ? "demo" : process.env.DEMO_NWC!);
  else if (process.env.SEED_DEMO === "1") console.warn("[seed] SEED_DEMO=1 needs DEMO_NWC (a funded sandbox wallet link) when payments are real; demo tasks not loaded");
}
const ready = () => (g._ready ??= init().catch((e) => { g._ready = undefined; throw e; }));

export const all: Db["all"] = async (sql, ...p) => { await ready(); return raw.all(sql, ...p); };
export const get: Db["get"] = async (sql, ...p) => { await ready(); return raw.get(sql, ...p); };
export const run: Db["run"] = async (sql, ...p) => { await ready(); return raw.run(sql, ...p); };

// Runs fn in a transaction. Use the passed helpers (not the module-level ones) inside fn.
export async function tx<T>(fn: (t: Db) => Promise<T>): Promise<T> {
  const c: PoolClient = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(bind((sql, params) => c.query(sql, params as any[])));
    await c.query("COMMIT");
    return out;
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
  finally { c.release(); }
}

export const isUniqueViolation = (e: any) => e?.code === "23505";
