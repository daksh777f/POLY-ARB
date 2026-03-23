/**
 * Trade Log Store - Persistent trade history
 */

import { db, schema } from '@/db';
import { eq, desc, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface CreateTradeLogInput {
  signalId?: string;
  positionId?: string;
  marketId: string;
  direction: 'buy' | 'sell';
  amountUSD: number;
  amountTokens?: number;
  price: number;
  orderType: 'market' | 'limit' | 'fillOrKill';
  orderId?: string;
  txSignature?: string;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  error?: string;
}

/**
 * Log a trade attempt
 */
export function logTrade(input: CreateTradeLogInput) {
  const now = new Date().toISOString();
  
  const trade = {
    id: `trade_${nanoid(12)}`,
    signalId: input.signalId || null,
    positionId: input.positionId || null,
    marketId: input.marketId,
    direction: input.direction,
    amountUSD: input.amountUSD,
    amountTokens: input.amountTokens || null,
    price: input.price,
    orderType: input.orderType,
    orderId: input.orderId || null,
    txSignature: input.txSignature || null,
    status: input.status,
    error: input.error || null,
    createdAt: now,
    filledAt: input.status === 'filled' ? now : null,
  };

  db.insert(schema.tradeLog).values(trade).run();
  
  return trade;
}

/**
 * Update trade status (e.g., when order fills)
 */
export function updateTradeStatus(
  tradeId: string,
  updates: {
    status?: 'pending' | 'filled' | 'cancelled' | 'failed';
    filledAt?: string;
    txSignature?: string;
    orderId?: string;
    error?: string;
    price?: number;
    amountTokens?: number;
  }
) {
  const updateData: Record<string, unknown> = {
    ...updates,
  };
  
  if (updates.status === 'filled' && !updates.filledAt) {
    updateData.filledAt = new Date().toISOString();
  }

  db.update(schema.tradeLog)
    .set(updateData)
    .where(eq(schema.tradeLog.id, tradeId))
    .run();
}

/**
 * Get trade by ID
 */
export function getTradeById(tradeId: string): typeof schema.tradeLog.$inferSelect | null {
  const rows = db
    .select()
    .from(schema.tradeLog)
    .where(eq(schema.tradeLog.id, tradeId))
    .limit(1)
    .all();

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get recent trades
 */
export function getRecentTrades(limit = 50): typeof schema.tradeLog.$inferSelect[] {
  return db
    .select()
    .from(schema.tradeLog)
    .orderBy(desc(schema.tradeLog.createdAt))
    .limit(limit)
    .all();
}

/**
 * Get trades by status
 */
export function getTradesByStatus(
  status: 'pending' | 'filled' | 'cancelled' | 'failed',
  limit = 50
): typeof schema.tradeLog.$inferSelect[] {
  return db
    .select()
    .from(schema.tradeLog)
    .where(eq(schema.tradeLog.status, status))
    .orderBy(desc(schema.tradeLog.createdAt))
    .limit(limit)
    .all();
}

/**
 * Get trades by market
 */
export function getTradesByMarket(marketId: string): typeof schema.tradeLog.$inferSelect[] {
  return db
    .select()
    .from(schema.tradeLog)
    .where(eq(schema.tradeLog.marketId, marketId))
    .orderBy(desc(schema.tradeLog.createdAt))
    .all();
}

/**
 * Get pending trades (for retry)
 */
export function getPendingTrades(): typeof schema.tradeLog.$inferSelect[] {
  return db
    .select()
    .from(schema.tradeLog)
    .where(eq(schema.tradeLog.status, 'pending'))
    .orderBy(asc(schema.tradeLog.createdAt))
    .all();
}

/**
 * Get trade statistics
 */
export function getTradeStats() {
  const allTrades = db.select().from(schema.tradeLog).all();
  
  const filled = allTrades.filter(t => t.status === 'filled');
  const pending = allTrades.filter(t => t.status === 'pending');
  const failed = allTrades.filter(t => t.status === 'failed');
  
  const totalVolume = filled.reduce((sum, t) => sum + t.amountUSD, 0);
  const avgFillPrice = filled.length > 0 
    ? filled.reduce((sum, t) => sum + t.price, 0) / filled.length 
    : 0;

  return {
    total: allTrades.length,
    filled: filled.length,
    pending: pending.length,
    failed: failed.length,
    totalVolume,
    avgFillPrice,
  };
}
