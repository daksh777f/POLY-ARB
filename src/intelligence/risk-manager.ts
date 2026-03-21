/**
 * Risk Manager — portfolio-level risk controls
 * Position sizing, drawdown limits, concentration checks
 */

import { config } from '@/lib/config';
import type { Signal } from '@/lib/types';

export interface PortfolioRiskState {
  totalCapital: number;
  currentPositions: PositionInfo[];
  totalExposure: number;
  cumulativePnL: number;
  currentDrawdown: number;
  maxDrawdown: number;
}

export interface PositionInfo {
  marketId: string;
  signalId: string;
  direction: 'yes' | 'no';
  sizePercent: number; // as share of portfolio
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
}

export interface RiskCheckResult {
  ok: boolean;
  sizePercent: number;
  flags: string[];
  reason?: string;
}

/**
 * Compute Kelly fraction for a signal
 * Returns: (fraction of portfolio to deploy) 
 */
export function computeKellyFraction(
  pHat: number, // model estimate
  pMarket: number, // current market price
  b = 1, // odds (1:1 for binary)
): number {
  // Kelly: f = (p*(b+1) - 1) / b
  // For binary: f = (p*2 - 1)
  // Fractional Kelly: 0.25 * f (conservative)

  const f_full = (pHat * (b + 1) - 1) / b;
  const f_frac = 0.25 * f_full; // 1/4 Kelly

  // Clamp between -0.25 and 0.25 (max 25% of portfolio per direction)
  return Math.max(-0.25, Math.min(0.25, f_frac));
}

/**
 * Check if a signal respects position sizing limits
 */
export function checkPositionSizing(
  signal: Signal,
  portfolioValue: number,
  existingExposure: number,
  maxPositionPercent = 0.01, // max 1% per position
  maxTotalExposure = 0.1, // max 10% total algorithmic
): RiskCheckResult {
  const flags: string[] = [];

  // 1. Compute Kelly sizing
  const kellyFrac = computeKellyFraction(signal.darwinEstimate, signal.marketPrice);
  const potentialSizePercent = Math.abs(kellyFrac);

  // 2. Check individual position limit
  if (potentialSizePercent > maxPositionPercent) {
    flags.push(`position_size_excessive (${(potentialSizePercent * 100).toFixed(1)}% > ${(maxPositionPercent * 100).toFixed(1)}% limit)`);
  }

  // 3. Check total exposure
  const newTotalExposure = existingExposure + potentialSizePercent;
  if (newTotalExposure > maxTotalExposure) {
    flags.push(`total_exposure_exceeded (${(newTotalExposure * 100).toFixed(1)}% > ${(maxTotalExposure * 100).toFixed(1)}% limit)`);
  }

  // 4. Check if signal is tradeable
  if (!signal.tradeable) {
    flags.push('signal_not_tradeable');
  }

  // 5. Check EV threshold
  if (signal.ev < config.evThreshold) {
    flags.push(`below_ev_threshold (${signal.ev.toFixed(3)} < ${config.evThreshold.toFixed(3)})`);
  }

  return {
    ok: flags.length === 0,
    sizePercent: potentialSizePercent,
    flags,
    reason: flags.length > 0 ? flags.join('; ') : undefined,
  };
}

/**
 * Check portfolio-level drawdown limit
 */
export function checkDrawdownLimit(
  cumulativePnL: number,
  startingCapital: number,
  maxDrawdownPercent = 0.05, // 5%
): {
  ok: boolean;
  drawdown: number;
  reason?: string;
} {
  const drawdown = cumulativePnL / startingCapital;

  if (drawdown < -maxDrawdownPercent) {
    return {
      ok: false,
      drawdown,
      reason: `Portfolio drawdown ${(drawdown * 100).toFixed(1)}% exceeds limit of ${(maxDrawdownPercent * 100).toFixed(1)}%`,
    };
  }

  return { ok: true, drawdown };
}

/**
 * Check concentration in single market
 */
export function checkConcentration(
  positions: PositionInfo[],
  maxConcentrationPercent = 0.05, // 5% per market
): {
  ok: boolean;
  violations: string[];
} {
  const marketExposures = new Map<string, number>();

  for (const pos of positions) {
    const current = marketExposures.get(pos.marketId) || 0;
    marketExposures.set(pos.marketId, current + pos.sizePercent);
  }

  const violations: string[] = [];
  for (const [marketId, exposure] of marketExposures) {
    if (exposure > maxConcentrationPercent) {
      violations.push(
        `Market ${marketId}: ${(exposure * 100).toFixed(1)}% exposure > ${(maxConcentrationPercent * 100).toFixed(1)}% limit`,
      );
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

/**
 * Comprehensive risk assessment before executing signal
 */
export function fullRiskAssessment(
  signal: Signal,
  portfolio: PortfolioRiskState,
  userMaxPositionPercent?: number,
  userMaxDrawdownPercent?: number,
): {
  ok: boolean;
  blocks: string[];
  warnings: string[];
  recommendedSize: number;
} {
  const blocks: string[] = [];
  const warnings: string[] = [];

  // 1. Position sizing check
  const sizeCheck = checkPositionSizing(
    signal,
    portfolio.totalCapital,
    portfolio.totalExposure,
    userMaxPositionPercent || 0.01,
    Math.min(0.1, userMaxPositionPercent ? userMaxPositionPercent * 5 : 0.1),
  );

  if (!sizeCheck.ok) {
    sizeCheck.flags.forEach((f) => blocks.push(f));
  }

  // 2. Drawdown check
  const drawdownCheck = checkDrawdownLimit(
    portfolio.cumulativePnL,
    portfolio.totalCapital,
    userMaxDrawdownPercent || 0.05,
  );

  if (!drawdownCheck.ok && drawdownCheck.reason) {
    blocks.push(drawdownCheck.reason);
  }

  // 3. Concentration check
  const concCheck = checkConcentration(
    portfolio.currentPositions,
    userMaxPositionPercent || 0.05,
  );

  if (!concCheck.ok) {
    warnings.push(...concCheck.violations);
  }

  // 4. General risk warnings
  if (signal.confidence === 'low') {
    warnings.push('Signal has low confidence');
  }

  if (portfolio.currentDrawdown < -0.02) {
    warnings.push(`Portfolio down ${(portfolio.currentDrawdown * 100).toFixed(1)}% - be cautious`);
  }

  return {
    ok: blocks.length === 0,
    blocks,
    warnings,
    recommendedSize: sizeCheck.sizePercent,
  };
}
