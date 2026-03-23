/**
 * Portfolio & Position Store
 * Manages portfolio state and position tracking
 */

import { db, schema } from '@/db';
import { eq, and, desc, asc, count, sum } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Signal } from '@/lib/types';
import { logError, ErrorCode } from '@/lib/errors';

export interface CreatePositionInput {
  portfolioId?: string; // Optional - will use default if not provided
  signalId?: string;
  marketId: string;
  marketQuestion: string;
  direction: 'yes' | 'no';
  sizePercent: number;
  sizeUSD: number;
  entryPrice: number;
  orderType?: 'market' | 'limit' | 'fillOrKill';
  orderId?: string;
  txSignature?: string;
}

export interface ClosePositionInput {
  positionId: string;
  exitPrice: number;
  exitTxSignature?: string;
}

export interface UpdatePositionInput {
  currentPrice: number;
}

/**
 * Get or create default portfolio
 */
export function getOrCreatePortfolio(name = 'default'): typeof schema.portfolios.$inferSelect {
  const existing = db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.name, name))
    .limit(1)
    .all()[0];

  if (existing) {
    return existing;
  }

  // Create new portfolio with default capital
  const initialCapital = 10000; // $10,000 default
  const now = new Date().toISOString();
  
  const newPortfolio = {
    id: `portfolio_${nanoid(12)}`,
    name,
    totalCapital: initialCapital,
    availableCapital: initialCapital,
    deployedCapital: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    currentDrawdown: 0,
    maxDrawdown: 0,
    winCount: 0,
    lossCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(schema.portfolios).values(newPortfolio).run();
  
  return newPortfolio;
}

/**
 * Open a new position
 */
export function openPosition(input: CreatePositionInput) {
  const portfolio = getOrCreatePortfolio();
  const now = new Date().toISOString();

  // Check available capital
  if (input.sizeUSD > portfolio.availableCapital) {
    logError('PORTFOLIO_INSUFFICIENT_CAPITAL', 
      new Error(`Insufficient capital: need $${input.sizeUSD}, have $${portfolio.availableCapital}`),
      { required: input.sizeUSD, available: portfolio.availableCapital }
    );
    return null;
  }

  const position = {
    id: `pos_${nanoid(12)}`,
    portfolioId: input.portfolioId || portfolio.id,
    signalId: input.signalId || null,
    marketId: input.marketId,
    marketQuestion: input.marketQuestion,
    direction: input.direction,
    sizePercent: input.sizePercent,
    sizeUSD: input.sizeUSD,
    entryPrice: input.entryPrice,
    currentPrice: input.entryPrice,
    unrealizedPnL: 0,
    realizedPnL: null,
    status: 'open' as const,
    orderType: input.orderType || 'market',
    orderId: input.orderId || null,
    txSignature: input.txSignature || null,
    openedAt: now,
    closedAt: null,
    settledAt: null,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(schema.positions).values(position).run();

  // Update portfolio deployed capital
  db.update(schema.portfolios)
    .set({
      availableCapital: portfolio.availableCapital - input.sizeUSD,
      deployedCapital: (portfolio.deployedCapital ?? 0) + input.sizeUSD,
      updatedAt: now,
    })
    .where(eq(schema.portfolios.id, portfolio.id))
    .run();

  return position;
}

/**
 * Close an existing position
 */
export function closePosition(input: ClosePositionInput) {
  const position = db
    .select()
    .from(schema.positions)
    .where(eq(schema.positions.id, input.positionId))
    .limit(1)
    .all()[0];

  if (!position || position.status !== 'open') {
    logError('PORTFOLIO_INVALID_POSITION',
      new Error(`Cannot close position: ${input.positionId} not found or not open`),
      { positionId: input.positionId, status: position?.status }
    );
    return null;
  }

  const now = new Date().toISOString();
  
  // Calculate realized P&L
  // For 'yes' direction: profit if exit > entry
  // For 'no' direction: profit if exit < entry
  let pnl: number;
  if (position.direction === 'yes') {
    pnl = (input.exitPrice - position.entryPrice) * (position.sizeUSD / position.entryPrice);
  } else {
    pnl = (position.entryPrice - input.exitPrice) * (position.sizeUSD / position.entryPrice);
  }

  const isWin = pnl > 0;

  // Update position
  db.update(schema.positions)
    .set({
      exitPrice: input.exitPrice,
      currentPrice: input.exitPrice,
      realizedPnL: pnl,
      unrealizedPnL: 0,
      status: 'closed' as const,
      txSignature: input.exitTxSignature || null,
      closedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.positions.id, input.positionId))
    .run();

  // Update portfolio
  const portfolio = db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.id, position.portfolioId))
    .limit(1)
    .all()[0];

  if (portfolio) {
    const newTotalPnL = (portfolio.totalPnL ?? 0) + pnl;
    const newTotalPnLPercent = (newTotalPnL / portfolio.totalCapital) * 100;
    const newDrawdown = Math.max(0, -newTotalPnLPercent);
    const newMaxDrawdown = Math.max(portfolio.maxDrawdown ?? 0, newDrawdown);

    db.update(schema.portfolios)
      .set({
        availableCapital: (portfolio.availableCapital ?? 0) + position.sizeUSD + pnl,
        deployedCapital: (portfolio.deployedCapital ?? 0) - position.sizeUSD,
        totalPnL: newTotalPnL,
        totalPnLPercent: newTotalPnLPercent,
        currentDrawdown: newDrawdown,
        maxDrawdown: newMaxDrawdown,
        winCount: isWin ? (portfolio.winCount ?? 0) + 1 : (portfolio.winCount ?? 0),
        lossCount: !isWin ? (portfolio.lossCount ?? 0) + 1 : (portfolio.lossCount ?? 0),
        updatedAt: now,
      })
      .where(eq(schema.portfolios.id, portfolio.id))
      .run();
  }

  return { ...position, realizedPnL: pnl, exitPrice: input.exitPrice };
}

/**
 * Update position with current market price (for unrealized P&L)
 */
export function updatePositionPrice(positionId: string, currentPrice: number) {
  const position = db
    .select()
    .from(schema.positions)
    .where(eq(schema.positions.id, positionId))
    .limit(1)
    .all()[0];

  if (!position || position.status !== 'open') {
    return null;
  }

  // Calculate unrealized P&L
  let unrealizedPnL: number;
  if (position.direction === 'yes') {
    unrealizedPnL = (currentPrice - position.entryPrice) * (position.sizeUSD / position.entryPrice);
  } else {
    unrealizedPnL = (position.entryPrice - currentPrice) * (position.sizeUSD / position.entryPrice);
  }

  db.update(schema.positions)
    .set({
      currentPrice,
      unrealizedPnL,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.positions.id, positionId))
    .run();

  return { ...position, currentPrice, unrealizedPnL };
}

/**
 * Mark position as settled (when market resolves)
 */
export function settlePosition(positionId: string, actualOutcome: boolean) {
  const position = db
    .select()
    .from(schema.positions)
    .where(eq(schema.positions.id, positionId))
    .limit(1)
    .all()[0];

  if (!position || position.status !== 'closed') {
    return null;
  }

  const now = new Date().toISOString();
  
  // Position is already closed, just mark as settled
  db.update(schema.positions)
    .set({
      status: 'settled' as const,
      settledAt: now,
      updatedAt: now,
    })
    .where(eq(schema.positions.id, positionId))
    .run();

  return { ...position, status: 'settled', settledAt: now };
}

/**
 * Get all open positions
 */
export function getOpenPositions(portfolioId?: string): typeof schema.positions.$inferSelect[] {
  const conditions = [eq(schema.positions.status, 'open')];
  if (portfolioId) {
    conditions.push(eq(schema.positions.portfolioId, portfolioId));
  }

  return db
    .select()
    .from(schema.positions)
    .where(and(...conditions))
    .orderBy(desc(schema.positions.openedAt))
    .all();
}

/**
 * Get all positions (open and closed)
 */
export function getAllPositions(portfolioId?: string): typeof schema.positions.$inferSelect[] {
  if (portfolioId) {
    return db
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.portfolioId, portfolioId))
      .orderBy(desc(schema.positions.openedAt))
      .all();
  }

  return db
    .select()
    .from(schema.positions)
    .orderBy(desc(schema.positions.openedAt))
    .all();
}

/**
 * Get position by ID
 */
export function getPositionById(positionId: string): typeof schema.positions.$inferSelect | null {
  const rows = db
    .select()
    .from(schema.positions)
    .where(eq(schema.positions.id, positionId))
    .limit(1)
    .all();

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get position by market ID (if open)
 */
export function getOpenPositionByMarket(marketId: string): typeof schema.positions.$inferSelect | null {
  const rows = db
    .select()
    .from(schema.positions)
    .where(
      and(
        eq(schema.positions.marketId, marketId),
        eq(schema.positions.status, 'open')
      )
    )
    .limit(1)
    .all();

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get portfolio by ID or name
 */
export function getPortfolio(identifier: string): typeof schema.portfolios.$inferSelect | null {
  // Try as ID first
  let rows = db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.id, identifier))
    .limit(1)
    .all();

  if (rows.length > 0) {
    return rows[0];
  }

  // Try as name
  rows = db
    .select()
    .from(schema.portfolios)
    .where(eq(schema.portfolios.name, identifier))
    .limit(1)
    .all();

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get all portfolios
 */
export function getAllPortfolios(): typeof schema.portfolios.$inferSelect[] {
  return db.select().from(schema.portfolios).all();
}

/**
 * Get portfolio summary stats
 */
export function getPortfolioStats(portfolioId?: string) {
  const portfolio = portfolioId 
    ? getPortfolio(portfolioId) 
    : getOrCreatePortfolio();

  if (!portfolio) {
    return null;
  }

  const openPositions = getOpenPositions(portfolio.id);
  const allPositions = getAllPositions(portfolio.id);
  const closedPositions = allPositions.filter(p => p.status === 'closed' || p.status === 'settled');

  // Calculate win rate
  const totalClosed = closedPositions.length;
  const wins = closedPositions.filter(p => (p.realizedPnL || 0) > 0).length;
  const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;

  // Average win/loss
  const winsPnL = closedPositions
    .filter(p => (p.realizedPnL || 0) > 0)
    .map(p => p.realizedPnL || 0);
  const lossesPnL = closedPositions
    .filter(p => (p.realizedPnL || 0) < 0)
    .map(p => p.realizedPnL || 0);
  
  const avgWin = winsPnL.length > 0 
    ? winsPnL.reduce((a, b) => a + b, 0) / winsPnL.length 
    : 0;
  const avgLoss = lossesPnL.length > 0 
    ? Math.abs(lossesPnL.reduce((a, b) => a + b, 0) / lossesPnL.length)
    : 0;

  // Profit factor
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

  return {
    portfolio,
    openPositionsCount: openPositions.length,
    totalPositions: allPositions.length,
    totalClosed,
    winRate,
    avgWin,
    avgLoss,
    profitFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
  };
}

/**
 * Update all open positions with latest prices
 * This should be called periodically to keep unrealized P&L updated
 */
export function refreshPositionPrices(prices: Map<string, number>): number {
  const openPositions = getOpenPositions();
  let updated = 0;

  for (const position of openPositions) {
    const currentPrice = prices.get(position.marketId);
    if (currentPrice !== undefined) {
      updatePositionPrice(position.id, currentPrice);
      updated++;
    }
  }

  return updated;
}
