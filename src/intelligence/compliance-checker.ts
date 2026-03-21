/**
 * Compliance-Aware Signal Generation
 * Enforces user limits, risk checks, compliance acceptance before signal creation
 */

import { hasAcceptedAllDisclaimers, checkPositionSizeLimit, isGeoLocationAllowed } from '@/intelligence/compliance';
import { logRiskCheck } from '@/store/audit-log';
import type { Signal } from '@/lib/types';

export interface ComplianceCheckResult {
  passed: boolean;
  flags: string[];
  reason?: string;
  shouldBlock: boolean;
}

/**
 * Run all compliance checks on a potential signal
 */
export function checkSignalCompliance(
  userId: string,
  signal: Signal,
  portfolioValue: number,
  geoLocation?: string,
): ComplianceCheckResult {
  const flags: string[] = [];
  let shouldBlock = false;

  // 1. User must accept disclaimers
  if (!hasAcceptedAllDisclaimers(userId)) {
    flags.push('no_disclaimer_acceptance');
    shouldBlock = true;
  }

  // 2. Geo check
  if (!isGeoLocationAllowed(geoLocation ?? null)) {
    flags.push('geo_restricted');
    shouldBlock = true;
  }

  // 3. Position size limit
  if (!checkPositionSizeLimit(userId, signal.ev * portfolioValue, portfolioValue)) {
    flags.push('exceeds_position_size');
    shouldBlock = true;
  }

  // 4. Risk flags based on signal properties
  if (signal.ev < 0.02) {
    flags.push('low_ev_signal');
  }
  if (!signal.tradeable) {
    flags.push('not_tradeable_lower_bound');
    shouldBlock = true;
  }
  if (signal.confidence === 'low') {
    flags.push('low_confidence');
  }

  // Log the check
  logRiskCheck(signal.id, signal.marketId, flags, !shouldBlock);

  return {
    passed: !shouldBlock && flags.length === 0,
    flags,
    shouldBlock,
    reason: shouldBlock ? flags.join('; ') : undefined,
  };
}

/**
 * Build compliance disclaimer summary for API response
 */
export function getComplianceDisclaimer(): string {
  return `⚠️  IMPORTANT: This alert is a probability estimate, NOT investment advice. 
  Trading prediction markets carries significant risk of total loss. 
  Past performance does not guarantee future results. 
  Consult a financial advisor before trading.`;
}

/**
 * Check if a user is in good compliance standing
 */
export function isUserInCompliance(userId: string): boolean {
  return hasAcceptedAllDisclaimers(userId);
}
