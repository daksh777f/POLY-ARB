import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

export { schema };

let _db: BetterSQLite3Database<typeof schema> | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const dbPath = path.resolve(process.cwd(), 'darwin.db');
    const sqlite = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    sqlite.pragma('journal_mode = WAL');

    // Ensure tables exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        market_id TEXT NOT NULL,
        market_question TEXT NOT NULL,
        darwin_estimate REAL NOT NULL,
        market_price REAL NOT NULL,
        ev REAL NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('yes', 'no')),
        reasoning TEXT NOT NULL,
        news_events TEXT NOT NULL,
        confidence TEXT NOT NULL CHECK(confidence IN ('low', 'medium', 'high')),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS markets (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        probability REAL NOT NULL,
        volume REAL NOT NULL,
        liquidity REAL NOT NULL,
        end_date TEXT NOT NULL,
        url TEXT NOT NULL,
        category TEXT,
        last_updated TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS watchlist (
        market_id TEXT PRIMARY KEY,
        added_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS seen_articles (
        key TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK(source IN ('rss', 'news')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        signal_id TEXT NOT NULL,
        market_id TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK(event_type IN ('signal_created', 'signal_resolved', 'signal_expired', 'risk_check', 'calibration_update')),
        estimated_probability REAL,
        actual_outcome REAL,
        brier_component REAL,
        notes TEXT,
        risk_flags TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS calibration_records (
        id TEXT PRIMARY KEY,
        signal_id TEXT NOT NULL UNIQUE,
        predicted_probability REAL NOT NULL,
        actual_outcome INTEGER NOT NULL,
        brier_score REAL NOT NULL,
        rolling_brier REAL,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE TABLE IF NOT EXISTS source_ratings (
        domain TEXT PRIMARY KEY,
        credibility_score REAL NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('news', 'social', 'blog', 'unknown')),
        reputation_flags TEXT,
        whitelisted INTEGER DEFAULT 0,
        blacklisted INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_compliance (
        user_id TEXT PRIMARY KEY,
        terms_accepted_at TEXT,
        risk_disclaimer_accepted_at TEXT,
        algorithmic_trading_warning_accepted_at TEXT,
        no_financial_advice_acknowledged_at TEXT,
        max_position_size_percent REAL DEFAULT 0.005,
        max_drawdown_percent REAL DEFAULT 0.05,
        geo_location TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Migrate: add new columns (safe to re-run — we catch duplicate column errors)
    const migrations = [
      `ALTER TABLE signals ADD COLUMN ev_net REAL`,
      `ALTER TABLE signals ADD COLUMN costs TEXT`,
      `ALTER TABLE signals ADD COLUMN features TEXT`,
      `ALTER TABLE signals ADD COLUMN tradeable INTEGER`,
      `ALTER TABLE signals ADD COLUMN p_hat_lb REAL`,
      // Market table expansions for full sync
      `ALTER TABLE markets ADD COLUMN volume_24hr REAL`,
      `ALTER TABLE markets ADD COLUMN spread REAL`,
      `ALTER TABLE markets ADD COLUMN clob_token_id TEXT`,
      `ALTER TABLE markets ADD COLUMN event_id TEXT`,
      `ALTER TABLE markets ADD COLUMN event_title TEXT`,
      `ALTER TABLE markets ADD COLUMN tags TEXT`,
      `ALTER TABLE markets ADD COLUMN one_day_price_change REAL`,
      `ALTER TABLE markets ADD COLUMN synced_at TEXT`,
      // Solana on-chain commitment columns
      `ALTER TABLE signals ADD COLUMN commit_tx_signature TEXT`,
      `ALTER TABLE signals ADD COLUMN commit_hash TEXT`,
      `ALTER TABLE signals ADD COLUMN reveal_tx_signature TEXT`,
      `ALTER TABLE signals ADD COLUMN commit_slot INTEGER`,
      `ALTER TABLE signals ADD COLUMN market_price_at_commit REAL`,
      // PHASE 1: Calibration columns (for tracking prediction accuracy)
      `ALTER TABLE signals ADD COLUMN actual_outcome INTEGER`,
      `ALTER TABLE signals ADD COLUMN calibration_resolved_at TEXT`,
    ];
    for (const sql of migrations) {
      try {
        sqlite.exec(sql);
      } catch {
        // Column already exists — ignore
      }
    }

    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

// Proxy for backward-compatible `db` usage
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
