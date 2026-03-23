import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

export { schema };

let _db: BetterSQLite3Database<typeof schema> | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const dbPath = process.env.DATABASE_PATH
      ? path.resolve(process.env.DATABASE_PATH)
      : process.env.VERCEL
        ? '/tmp/darwin.db'
        : path.resolve(process.cwd(), 'darwin.db');
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
      CREATE TABLE IF NOT EXISTS portfolios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        total_capital REAL NOT NULL,
        available_capital REAL NOT NULL,
        deployed_capital REAL DEFAULT 0,
        total_pnl REAL DEFAULT 0,
        total_pnl_percent REAL DEFAULT 0,
        current_drawdown REAL DEFAULT 0,
        max_drawdown REAL DEFAULT 0,
        win_count INTEGER DEFAULT 0,
        loss_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        portfolio_id TEXT NOT NULL,
        signal_id TEXT,
        market_id TEXT NOT NULL,
        market_question TEXT NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('yes', 'no')),
        size_percent REAL NOT NULL,
        size_usd REAL NOT NULL,
        entry_price REAL NOT NULL,
        current_price REAL,
        exit_price REAL,
        unrealized_pnl REAL,
        realized_pnl REAL,
        status TEXT NOT NULL CHECK(status IN ('open', 'closed', 'settled')),
        order_type TEXT DEFAULT 'market' CHECK(order_type IN ('market', 'limit', 'fillOrKill')),
        order_id TEXT,
        tx_signature TEXT,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        settled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK(source IN ('orchestrator', 'scanner', 'trading', 'system')),
        level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error')),
        message TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scout_events (
        id TEXT PRIMARY KEY,
        article_title TEXT NOT NULL,
        article_url TEXT,
        matched_market_id TEXT,
        matched_market_question TEXT,
        match_score REAL,
        status TEXT DEFAULT 'new' CHECK(status IN ('new', 'dismissed', 'analyzed')),
        dismissed_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS news_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT,
        source TEXT,
        published_at TEXT,
        matched_markets TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trade_log (
        id TEXT PRIMARY KEY,
        signal_id TEXT,
        position_id TEXT,
        market_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('buy', 'sell')),
        amount_usd REAL NOT NULL,
        amount_tokens REAL,
        price REAL NOT NULL,
        order_type TEXT NOT NULL CHECK(order_type IN ('market', 'limit', 'fillOrKill')),
        order_id TEXT,
        tx_signature TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'filled', 'cancelled', 'failed')),
        error TEXT,
        created_at TEXT NOT NULL,
        filled_at TEXT
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

    // Create indexes for better query performance
    const indexes = [
      // Signals indexes
      `CREATE INDEX IF NOT EXISTS idx_signals_market_id ON signals(market_id)`,
      `CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_signals_expires_at ON signals(expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_signals_confidence ON signals(confidence)`,
      `CREATE INDEX IF NOT EXISTS idx_signals_direction ON signals(direction)`,
      `CREATE INDEX IF NOT EXISTS idx_signals_commit_tx ON signals(commit_tx_signature)`,
      // Markets indexes
      `CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category)`,
      `CREATE INDEX IF NOT EXISTS idx_markets_end_date ON markets(end_date)`,
      `CREATE INDEX IF NOT EXISTS idx_markets_volume_24hr ON markets(volume_24hr)`,
      `CREATE INDEX IF NOT EXISTS idx_markets_liquidity ON markets(liquidity)`,
      `CREATE INDEX IF NOT EXISTS idx_markets_question ON markets(question)`,
      `CREATE INDEX IF NOT EXISTS idx_markets_event_id ON markets(event_id)`,
      // Audit log indexes
      `CREATE INDEX IF NOT EXISTS idx_audit_signal_id ON audit_log(signal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_market_id ON audit_log(market_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type)`,
      // Calibration records indexes
      `CREATE INDEX IF NOT EXISTS idx_calibration_signal_id ON calibration_records(signal_id)`,
      `CREATE INDEX IF NOT EXISTS idx_calibration_resolved_at ON calibration_records(resolved_at)`,
      // Seen articles indexes
      `CREATE INDEX IF NOT EXISTS idx_seen_articles_source ON seen_articles(source)`,
      // Source ratings indexes
      `CREATE INDEX IF NOT EXISTS idx_source_ratings_credibility ON source_ratings(credibility_score)`,
      // Portfolio and positions indexes
      `CREATE INDEX IF NOT EXISTS idx_portfolios_name ON portfolios(name)`,
      `CREATE INDEX IF NOT EXISTS idx_positions_portfolio_id ON positions(portfolio_id)`,
      `CREATE INDEX IF NOT EXISTS idx_positions_market_id ON positions(market_id)`,
      `CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_positions_opened_at ON positions(opened_at)`,
      // Activity and scout indexes
      `CREATE INDEX IF NOT EXISTS idx_activity_log_source ON activity_log(source)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_log_level ON activity_log(level)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_scout_events_status ON scout_events(status)`,
      `CREATE INDEX IF NOT EXISTS idx_scout_events_created_at ON scout_events(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_news_events_created_at ON news_events(created_at)`,
      // Trade log indexes
      `CREATE INDEX IF NOT EXISTS idx_trade_log_market_id ON trade_log(market_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trade_log_status ON trade_log(status)`,
      `CREATE INDEX IF NOT EXISTS idx_trade_log_created_at ON trade_log(created_at)`,
    ];
    for (const sql of indexes) {
      try {
        sqlite.exec(sql);
      } catch {
        // Index already exists — ignore
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
