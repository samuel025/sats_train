import Database from "better-sqlite3";
import { seedDemo } from "./seed";

const g = globalThis as unknown as { _db?: Database.Database };

export function db() {
  if (g._db) return g._db;
  const d = new Database(process.env.DB_PATH || "sats.db");
  d.pragma("journal_mode = WAL");
  d.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, requester TEXT NOT NULL, title TEXT NOT NULL,
    kind TEXT NOT NULL, src_lang TEXT NOT NULL, dst_lang TEXT NOT NULL,
    instructions TEXT NOT NULL, reward_sats INTEGER NOT NULL,
    nwc_enc TEXT NOT NULL, nostr_event_id TEXT, created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', answers_per_item INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, task_id TEXT NOT NULL, position INTEGER NOT NULL,
    prompt TEXT NOT NULL, is_check INTEGER NOT NULL DEFAULT 0, known_answer TEXT,
    labels TEXT
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY, item_id TEXT NOT NULL, task_id TEXT NOT NULL,
    worker TEXT NOT NULL, answer TEXT NOT NULL, verdict TEXT NOT NULL,
    score REAL NOT NULL, reason TEXT NOT NULL, attempt INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY, item_id TEXT NOT NULL, task_id TEXT NOT NULL,
    worker TEXT NOT NULL, sats INTEGER NOT NULL, status TEXT NOT NULL,
    preimage TEXT, error TEXT, created_at INTEGER NOT NULL,
    UNIQUE(item_id, worker)
  );
  CREATE TABLE IF NOT EXISTS workers (
    pubkey TEXT PRIMARY KEY, lightning_address TEXT
  );
  CREATE TABLE IF NOT EXISTS served (
    item_id TEXT NOT NULL, worker TEXT NOT NULL, served_at INTEGER NOT NULL, PRIMARY KEY(item_id, worker)
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, task_id TEXT NOT NULL, reviewer TEXT NOT NULL,
    transcript TEXT NOT NULL, similarity REAL NOT NULL, match INTEGER NOT NULL, created_at INTEGER NOT NULL,
    UNIQUE(submission_id, reviewer)
  );
  CREATE TABLE IF NOT EXISTS quals (
    pubkey TEXT NOT NULL, language TEXT NOT NULL, best_score INTEGER NOT NULL DEFAULT 0, passed INTEGER NOT NULL DEFAULT 0,
    attempts_today INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(pubkey, language)
  );
  CREATE TABLE IF NOT EXISTS consents (
    pubkey TEXT NOT NULL, kind TEXT NOT NULL, version INTEGER NOT NULL, accepted_at INTEGER, withdrawn_at INTEGER, PRIMARY KEY(pubkey, kind)
  );
  CREATE INDEX IF NOT EXISTS idx_sub_worker ON submissions(worker, task_id);
  `);
  for (const [tbl, col] of [["payouts", "release_at INTEGER"], ["payouts", "sending INTEGER NOT NULL DEFAULT 0"], ["submissions", "audio_path TEXT"], ["submissions", "duration_ms INTEGER"], ["tasks", "min_level INTEGER NOT NULL DEFAULT 0"], ["tasks", "require_qual INTEGER NOT NULL DEFAULT 0"], ["tasks", "review_sats INTEGER"], ["items", "payload TEXT"], ["tasks", "license TEXT"], ["tasks", "pause_reason TEXT"]]) {
    try { d.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col}`); } catch { /* already there */ }
  }
  g._db = d;
  // Demo tasks use a placeholder wallet, so they only make sense when payments are simulated.
  if (process.env.MOCK_PAYMENTS === "1" || process.env.SEED_DEMO === "1") seedDemo(d);
  return d;
}
