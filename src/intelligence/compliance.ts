/**
 * Compliance Module — legal protection and user risk acknowledgments
 * Tracks user disclaimers, enforces position limits, geofencing
 */

import { db } from '@/db';
import { schema } from '@/db';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export interface UserComplianceStatus {
  userId: string;
  allTermsAccepted: boolean;
  disclaimersAccepted: {
    terms: boolean;
    riskDisclaimer: boolean;
    algorithmicTradingWarning: boolean;
    noFinancialAdvice: boolean;
  };
  maxPositionSize: number; // as share of portfolio (e.g., 0.005 = 0.5%)
  maxDrawdown: number; // e.g., 0.05 = 5%
  geoLocation: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Accept all compliance disclaimers for a user
 */
export function acceptAllDisclaimers(userId: string, geoLocation?: string): boolean {
  try {
    const now = new Date().toISOString();

    // Try to update existing record
    const existing = db.select()
      .from(schema.userCompliance)
      .where(eq(schema.userCompliance.userId, userId))
      .get();

    if (existing) {
      db.update(schema.userCompliance)
        .set({
          termsAcceptedAt: now,
          riskDisclaimerAcceptedAt: now,
          algorithmicTradingWarningAcceptedAt: now,
          noFinancialAdviceAcknowledgedAt: now,
          geoLocation: geoLocation || existing.geoLocation,
          updatedAt: now,
        })
        .where(eq(schema.userCompliance.userId, userId))
        .run();
    } else {
      db.insert(schema.userCompliance).values({
        userId,
        termsAcceptedAt: now,
        riskDisclaimerAcceptedAt: now,
        algorithmicTradingWarningAcceptedAt: now,
        noFinancialAdviceAcknowledgedAt: now,
        geoLocation: geoLocation || null,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    return true;
  } catch (e) {
    console.error(`[compliance] Failed to accept disclaimers:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * Get compliance status for a user
 */
export function getUserComplianceStatus(userId: string): UserComplianceStatus | null {
  try {
    const record = db.select()
      .from(schema.userCompliance)
      .where(eq(schema.userCompliance.userId, userId))
      .get();

    if (!record) return null;

    return {
      userId,
      allTermsAccepted: !!(
        record.termsAcceptedAt &&
        record.riskDisclaimerAcceptedAt &&
        record.algorithmicTradingWarningAcceptedAt &&
        record.noFinancialAdviceAcknowledgedAt
      ),
      disclaimersAccepted: {
        terms: !!record.termsAcceptedAt,
        riskDisclaimer: !!record.riskDisclaimerAcceptedAt,
        algorithmicTradingWarning: !!record.algorithmicTradingWarningAcceptedAt,
        noFinancialAdvice: !!record.noFinancialAdviceAcknowledgedAt,
      },
      maxPositionSize: record.maxPositionSizePercent || 0.005,
      maxDrawdown: record.maxDrawdownPercent || 0.05,
      geoLocation: record.geoLocation,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  } catch (e) {
    console.error(`[compliance] Failed to fetch status:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Check if user has accepted required disclaimers
 */
export function hasAcceptedAllDisclaimers(userId: string): boolean {
  const status = getUserComplianceStatus(userId);
  return status?.allTermsAccepted ?? false;
}

/**
 * Enforce position size limit
 * Returns true if trade is within limits
 */
export function checkPositionSizeLimit(userId: string, positionValue: number, portfolioValue: number): boolean {
  try {
    const status = getUserComplianceStatus(userId);
    if (!status) return false; // user must accept terms first

    const positionShare = positionValue / Math.max(portfolioValue, 1);
    return positionShare <= status.maxPositionSize;
  } catch (e) {
    console.error(`[compliance] Failed to check position size:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * Check if user location is allowed (geofencing)
 * Returns true if allowed (or no geo data available)
 */
export function isGeoLocationAllowed(userGeo: string | null): boolean {
  // For now: block only if geo explicitly marked as blocked
  // In production: check against list of sanctioned countries, restricted jurisdictions
  if (!userGeo) return true; // allow unknown locations (privacy-respecting)

  // Blocked countries/regions (example)
  const blockedGeos = ['iran', 'north korea', 'syria'];
  return !blockedGeos.some((bg) => userGeo.toLowerCase().includes(bg));
}

/**
 * Security disclaimer content
 */
export const DISCLAIMERS = {
  terms: `By using this service, you acknowledge that:
1. This is experimental software and may contain bugs
2. No warranty is provided, express or implied
3. Use at your own risk`,

  riskDisclaimer: `You acknowledge the following risks:
1. Markets may not resolve as expected
2. Capital may be lost
3. Liquidity risk if market closes early
4. This is NOT financial advice`,

  algorithmicTradingWarning: `You acknowledge:
1. This system uses algorithmic decision-making
2. Trades are generated automatically by AI
3. No human is reviewing each trade before execution
4. Results may vary significantly`,

  noFinancialAdvice: `IMPORTANT: This service does NOT provide financial advice.
Signals are probability estimates only. All trading decisions are your sole responsibility.
Past performance does not guarantee future results.
Consult a financial advisor before making investment decisions.`,
};

/**
 * Get all user records (for compliance audit)
 */
export function getAllUserCompliance(limit = 100): UserComplianceStatus[] {
  try {
    const records = db.select()
      .from(schema.userCompliance)
      .limit(limit)
      .all() || [];

    return records.map((r) => ({
      userId: r.userId,
      allTermsAccepted: !!(
        r.termsAcceptedAt &&
        r.riskDisclaimerAcceptedAt &&
        r.algorithmicTradingWarningAcceptedAt &&
        r.noFinancialAdviceAcknowledgedAt
      ),
      disclaimersAccepted: {
        terms: !!r.termsAcceptedAt,
        riskDisclaimer: !!r.riskDisclaimerAcceptedAt,
        algorithmicTradingWarning: !!r.algorithmicTradingWarningAcceptedAt,
        noFinancialAdvice: !!r.noFinancialAdviceAcknowledgedAt,
      },
      maxPositionSize: r.maxPositionSizePercent || 0.005,
      maxDrawdown: r.maxDrawdownPercent || 0.05,
      geoLocation: r.geoLocation,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }));
  } catch (e) {
    console.error(`[compliance] Failed to fetch all users:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Update user risk limits
 */
export function updateUserRiskLimits(
  userId: string,
  maxPositionSizePercent: number,
  maxDrawdownPercent: number,
): boolean {
  try {
    const now = new Date().toISOString();

    db.update(schema.userCompliance)
      .set({
        maxPositionSizePercent,
        maxDrawdownPercent,
        updatedAt: now,
      })
      .where(eq(schema.userCompliance.userId, userId))
      .run();

    return true;
  } catch (e) {
    console.error(`[compliance] Failed to update risk limits:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}
