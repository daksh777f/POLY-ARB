/**
 * Audit Logger — persistent compliance and analysis tracking
 * Records all signal decisions, resolutions, and risk checks
 */

import { db } from '@/db';
import { schema } from '@/db';
import { nanoid } from 'nanoid';
import type { Signal } from '@/lib/types';
import { desc, eq, lt } from 'drizzle-orm';

export interface AuditEvent {
  signalId: string;
  marketId: string;
  eventType: 'signal_created' | 'signal_resolved' | 'signal_expired' | 'risk_check' | 'calibration_update';
  estimatedProbability?: number;
  actualOutcome?: number; // 0 = NO, 1 = YES
  riskFlags?: string[];
  notes?: string;
}

/**
 * Log a signal creation event
 */
export function logSignalCreated(signal: Signal): void {
  try {
    const auditId = nanoid();
    db.insert(schema.auditLog).values({
      id: auditId,
      signalId: signal.id,
      marketId: signal.marketId,
      eventType: 'signal_created',
      estimatedProbability: signal.darwinEstimate,
      riskFlags: JSON.stringify([]),
      notes: `Signal created: ${signal.direction.toUpperCase()} EV=${signal.ev.toFixed(3)}`,
      createdAt: new Date().toISOString(),
    }).run();
  } catch (e) {
    console.error(`[audit-log] Failed to log signal creation:`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Log a signal resolution (market outcome revealed)
 */
export function logSignalResolved(
  signalId: string,
  marketId: string,
  estimatedProb: number,
  actualOutcome: 0 | 1,
): void {
  try {
    const brierComponent = Math.pow(estimatedProb - actualOutcome, 2);

    const auditId = nanoid();
    db.insert(schema.auditLog).values({
      id: auditId,
      signalId,
      marketId,
      eventType: 'signal_resolved',
      estimatedProbability: estimatedProb,
      actualOutcome: actualOutcome === 1 ? 1 : 0,
      brierComponent,
      notes: `Market resolved: estimated ${(estimatedProb * 100).toFixed(1)}% vs actual ${actualOutcome === 1 ? 'YES' : 'NO'}. Brier: ${brierComponent.toFixed(4)}`,
      resolvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }).run();
  } catch (e) {
    console.error(`[audit-log] Failed to log signal resolution:`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Log a risk check (position sizing, portfolio limits, etc.)
 */
export function logRiskCheck(
  signalId: string,
  marketId: string,
  flags: string[],
  passed: boolean,
): void {
  try {
    const auditId = nanoid();
    db.insert(schema.auditLog).values({
      id: auditId,
      signalId,
      marketId,
      eventType: 'risk_check',
      riskFlags: JSON.stringify(flags),
      notes: `Risk check: ${passed ? 'PASSED' : 'FAILED'} (${flags.length} flags)`,
      createdAt: new Date().toISOString(),
    }).run();
  } catch (e) {
    console.error(`[audit-log] Failed to log risk check:`, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Get audit trail for a signal (compliance review)
 */
export function getSignalAuditTrail(signalId: string): any[] {
  try {
    const events = db.select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.signalId, signalId))
      .orderBy((t) => t.createdAt)
      .all();
    
    return events || [];
  } catch (e) {
    console.error(`[audit-log] Failed to fetch audit trail:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Get recent audit events (for compliance dashboard)
 */
export function getRecentAuditEvents(limit = 50): any[] {
  try {
    const events = db.select()
      .from(schema.auditLog)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(limit)
      .all();
    
    return events || [];
  } catch (e) {
    console.error(`[audit-log] Failed to fetch recent events:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Prune old audit events (> 1 year)
 */
export function pruneOldAuditEvents(): number {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = db.delete(schema.auditLog)
      .where(lt(schema.auditLog.createdAt, oneYearAgo.toISOString()))
      .run();
    
    return result.changes || 0;
  } catch (e) {
    console.error(`[audit-log] Failed to prune old events:`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}
