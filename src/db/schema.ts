import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const signals = sqliteTable('signals', {
  id: text('id').primaryKey(),
  marketId: text('market_id').notNull(),
  marketQuestion: text('market_question').notNull(),
  darwinEstimate: real('darwin_estimate').notNull(),
  marketPrice: real('market_price').notNull(),
  ev: real('ev').notNull(),
  direction: text('direction', { enum: ['yes', 'no'] }).notNull(),
  reasoning: text('reasoning').notNull(),
  newsEvents: text('news_events').notNull(), // JSON string
  confidence: text('confidence', { enum: ['low', 'medium', 'high'] }).notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  evNet: real('ev_net'),
  costs: text('costs'), // JSON string
  features: text('features'), // JSON string
  tradeable: integer('tradeable', { mode: 'boolean' }),
  pHatLb: real('p_hat_lb'),
  commitTxSignature: text('commit_tx_signature'),
  commitHash: text('commit_hash'),
  revealTxSignature: text('reveal_tx_signature'),
  commitSlot: integer('commit_slot'),
  marketPriceAtCommit: real('market_price_at_commit'),
});

export const markets = sqliteTable('markets', {
  id: text('id').primaryKey(),
  question: text('question').notNull(),
  probability: real('probability').notNull(),
  volume: real('volume').notNull(),
  liquidity: real('liquidity').notNull(),
  endDate: text('end_date').notNull(),
  url: text('url').notNull(),
  category: text('category'),
  lastUpdated: text('last_updated').notNull(),
  volume24hr: real('volume_24hr'),
  spread: real('spread'),
  clobTokenId: text('clob_token_id'),
  eventId: text('event_id'),
  eventTitle: text('event_title'),
  tags: text('tags'), // JSON array
  oneDayPriceChange: real('one_day_price_change'),
  syncedAt: text('synced_at'),
});

export const seenArticles = sqliteTable('seen_articles', {
  key: text('key').primaryKey(),
  source: text('source', { enum: ['rss', 'news'] }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const watchlist = sqliteTable('watchlist', {
  marketId: text('market_id').primaryKey(),
  addedAt: text('added_at').notNull(),
});

// ─── PHASE 1: Compliance + Calibration Infrastructure ──────────────────

/**
 * Audit log: persistent record of all signal analysis, resolutions, and risk checks
 * Used for: compliance, backtesting, dispute resolution
 */
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  signalId: text('signal_id').notNull(),
  marketId: text('market_id').notNull(),
  eventType: text('event_type', { 
    enum: ['signal_created', 'signal_resolved', 'signal_expired', 'risk_check', 'calibration_update'] 
  }).notNull(),
  estimatedProbability: real('estimated_probability'), // at time of signal
  actualOutcome: real('actual_outcome'), // 0 or 1 (resolved YES/NO)
  brierComponent: real('brier_component'), // (estimate - actual)^2
  notes: text('notes'),
  riskFlags: text('risk_flags'), // JSON array: ["high_ev", "low_liquidity", "near_expiry"]
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull(),
});

/**
 * Calibration records: (predicted_probability, actual_outcome) for Brier score tracking
 * Auto-updated when signals resolve; used to adjust W_NEWS weight
 */
export const calibrationRecords = sqliteTable('calibration_records', {
  id: text('id').primaryKey(),
  signalId: text('signal_id').notNull().unique(),
  predictedProbability: real('predicted_probability').notNull(),
  actualOutcome: integer('actual_outcome', { mode: 'boolean' }).notNull(), // 0 = NO, 1 = YES
  brierScore: real('brier_score').notNull(), // (predicted - actual)^2
  rollingBrier: real('rolling_brier'), // 20-signal rolling average
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
});

/**
 * Source ratings: cached domain credibility scores
 * Updated periodically; used to filter news before LLM analysis
 */
export const sourceRatings = sqliteTable('source_ratings', {
  domain: text('domain').primaryKey(), // e.g., "reuters.com", "twitter.com"
  credibilityScore: real('credibility_score').notNull(), // 0-1
  category: text('category', {
    enum: ['news', 'social', 'blog', 'unknown']
  }).notNull(),
  reputationFlags: text('reputation_flags'), // JSON array: ["low-traffic", "new-domain", "spam-risk"]
  whitelisted: integer('whitelisted', { mode: 'boolean' }).default(false),
  blacklisted: integer('blacklisted', { mode: 'boolean' }).default(false),
  lastUpdated: text('last_updated').notNull(),
});

/**
 * User compliance: tracks user acknowledgments of disclaimers and risk acknowledgments
 * Required for legal compliance
 */
export const userCompliance = sqliteTable('user_compliance', {
  userId: text('user_id').primaryKey(),
  termsAcceptedAt: text('terms_accepted_at'),
  riskDisclaimerAcceptedAt: text('risk_disclaimer_accepted_at'),
  algorithmicTradingWarningAcceptedAt: text('algorithmic_trading_warning_accepted_at'),
  noFinancialAdviceAcknowledgedAt: text('no_financial_advice_acknowledged_at'),
  maxPositionSizePercent: real('max_position_size_percent').default(0.005), // 0.5% default
  maxDrawdownPercent: real('max_drawdown_percent').default(0.05), // 5% default
  geoLocation: text('geo_location'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
