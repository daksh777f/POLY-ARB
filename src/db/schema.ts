import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

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
  // Calibration tracking
  actualOutcome: integer('actual_outcome', { mode: 'boolean' }),
  calibrationResolvedAt: text('calibration_resolved_at'),
}, (table) => {
  return {
    confidenceIdx: index('idx_signals_confidence').on(table.confidence),
    evIdx: index('idx_signals_ev').on(table.ev),
    createdAtIdx: index('idx_signals_created_at').on(table.createdAt),
    marketIdIdx: index('idx_signals_market_id').on(table.marketId),
    expiresAtIdx: index('idx_signals_expires_at').on(table.expiresAt),
  };
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
}, (table) => {
  return {
    categoryIdx: index('idx_markets_category').on(table.category),
    endDateIdx: index('idx_markets_end_date').on(table.endDate),
    liquidityIdx: index('idx_markets_liquidity').on(table.liquidity),
    volumeIdx: index('idx_markets_volume').on(table.volume),
    probabilityIdx: index('idx_markets_probability').on(table.probability),
    clobTokenIdIdx: index('idx_markets_clob_token_id').on(table.clobTokenId),
  };
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

// ─── PHASE 2: Portfolio & Position Tracking ───────────────────────────────────

/**
 * Portfolio: Tracks overall capital and performance
 */
export const portfolios = sqliteTable('portfolios', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  totalCapital: real('total_capital').notNull(), // Total capital in USD
  availableCapital: real('available_capital').notNull(), // Capital not deployed
  deployedCapital: real('deployed_capital').default(0), // Capital in positions
  totalPnL: real('total_pnl').default(0), // Realized + unrealized P&L
  totalPnLPercent: real('total_pnl_percent').default(0), // As percentage
  currentDrawdown: real('current_drawdown').default(0), // Current drawdown from peak
  maxDrawdown: real('max_drawdown').default(0), // Peak-to-trough max
  winCount: integer('win_count').default(0), // Number of winning trades
  lossCount: integer('loss_count').default(0), // Number of losing trades
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Positions: Active and closed trades
 */
export const positions = sqliteTable('positions', {
  id: text('id').primaryKey(),
  portfolioId: text('portfolio_id').notNull(), // FK to portfolios
  signalId: text('signal_id'), // Optional link to signal that triggered this trade
  marketId: text('market_id').notNull(),
  marketQuestion: text('market_question').notNull(),
  direction: text('direction', { enum: ['yes', 'no'] }).notNull(),
  sizePercent: real('size_percent').notNull(), // Position size as % of portfolio
  sizeUSD: real('size_usd').notNull(), // Position size in USD
  entryPrice: real('entry_price').notNull(), // Price when position opened
  currentPrice: real('current_price'), // Current market price
  exitPrice: real('exit_price'), // Price when position closed
  unrealizedPnL: real('unrealized_pnl'), // P&L if closed now
  realizedPnL: real('realized_pnl'), // Realized P&L (when closed)
  status: text('status', { enum: ['open', 'closed', 'settled'] }).notNull(),
  orderType: text('order_type', { enum: ['market', 'limit', 'fillOrKill'] }).default('market'),
  orderId: text('order_id'), // Polymarket order ID
  txSignature: text('tx_signature'), // Transaction signature
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at'),
  settledAt: text('settled_at'), // When market resolved
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── Activity & Events (Database-backed) ─────────────────────────────────────

/**
 * Activity log: database-backed for persistence
 */
export const activityLog = sqliteTable('activity_log', {
  id: text('id').primaryKey(),
  source: text('source', { enum: ['orchestrator', 'scanner', 'trading', 'system'] }).notNull(),
  level: text('level', { enum: ['info', 'warn', 'error'] }).notNull(),
  message: text('message').notNull(),
  details: text('details'), // JSON string
  createdAt: text('created_at').notNull(),
}, (table) => {
  return {
    sourceIdx: index('idx_activity_log_source').on(table.source),
    levelIdx: index('idx_activity_log_level').on(table.level),
    createdAtIdx: index('idx_activity_log_created_at').on(table.createdAt),
  };
});

/**
 * Scout events: database-backed for persistence
 */
export const scoutEvents = sqliteTable('scout_events', {
  id: text('id').primaryKey(),
  articleTitle: text('article_title').notNull(),
  articleUrl: text('article_url'),
  matchedMarketId: text('matched_market_id'),
  matchedMarketQuestion: text('matched_market_question'),
  matchScore: real('match_score'),
  status: text('status', { enum: ['new', 'dismissed', 'analyzed'] }).default('new'),
  dismissedAt: text('dismissed_at'),
  createdAt: text('created_at').notNull(),
}, (table) => {
  return {
    statusIdx: index('idx_scout_events_status').on(table.status),
    createdAtIdx: index('idx_scout_events_created_at').on(table.createdAt),
  };
});

/**
 * News events: database-backed for persistence
 */
export const newsEvents = sqliteTable('news_events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url'),
  source: text('source'),
  publishedAt: text('published_at'),
  matchedMarkets: text('matched_markets'), // JSON array
  createdAt: text('created_at').notNull(),
});

/**
 * Trade log: persistent record of all trades
 */
export const tradeLog = sqliteTable('trade_log', {
  id: text('id').primaryKey(),
  signalId: text('signal_id'),
  positionId: text('position_id'),
  marketId: text('market_id').notNull(),
  direction: text('direction', { enum: ['buy', 'sell'] }).notNull(),
  amountUSD: real('amount_usd').notNull(),
  amountTokens: real('amount_tokens'),
  price: real('price').notNull(),
  orderType: text('order_type', { enum: ['market', 'limit', 'fillOrKill'] }).notNull(),
  orderId: text('order_id'),
  txSignature: text('tx_signature'),
  status: text('status', { enum: ['pending', 'filled', 'cancelled', 'failed'] }).notNull(),
  error: text('error'),
  createdAt: text('created_at').notNull(),
  filledAt: text('filled_at'),
});
