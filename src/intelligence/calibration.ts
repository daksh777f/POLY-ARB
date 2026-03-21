/**
 * Calibration Tracker — measures Claude's prediction accuracy
 * Computes Brier scores and auto-adjusts confidence weights
 */

import { db } from '@/db';
import { schema } from '@/db';
import { nanoid } from 'nanoid';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

export interface CalibrationStats {
  totalSignals: number;
  resolvedSignals: number;
  brierScore: number; // mean squared error
  rollingBrier20: number; // last 20 signals
  confidence: 'low' | 'medium' | 'high';
  recommendedWNews: number; // suggested weight based on calibration
}

/**
 * Record a prediction (called when signal resolves)
 * Returns Brier component (squared error)
 */
export function recordPrediction(
  signalId: string,
  predictedProbability: number,
  actualOutcome: 0 | 1, // 0 = NO, 1 = YES
): number {
  try {
    const brierScore = Math.pow(predictedProbability - actualOutcome, 2);

    const id = nanoid();
    db.insert(schema.calibrationRecords).values({
      id,
      signalId,
      predictedProbability,
      actualOutcome: actualOutcome === 1,
      brierScore,
      createdAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
    }).run();

    return brierScore;
  } catch (e) {
    console.error(`[calibration] Failed to record prediction:`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}

/**
 * Get overall calibration stats
 */
export function getCalibrationStats(): CalibrationStats {
  try {
    // Fetch all calibration records
    const allRecords = db.select()
      .from(schema.calibrationRecords)
      .orderBy((t) => t.createdAt)
      .all() || [];

    const resolvedRecords = allRecords.filter((r) => r.resolvedAt !== null && r.brierScore != null);

    if (resolvedRecords.length === 0) {
      return {
        totalSignals: 0,
        resolvedSignals: 0,
        brierScore: 0.25, // baseline (random guess)
        rollingBrier20: 0.25,
        confidence: 'low',
        recommendedWNews: 0.2, // conservative
      };
    }

    // Overall Brier score
    const overallBrier = resolvedRecords.reduce((sum, r) => sum + (r.brierScore || 0), 0) / resolvedRecords.length;

    // Rolling 20-signal Brier
    const last20 = resolvedRecords.slice(-20);
    const rolling20Brier = last20.length > 0
      ? last20.reduce((sum, r) => sum + (r.brierScore || 0), 0) / last20.length
      : overallBrier;

    // Calibration confidence
    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (rolling20Brier < 0.10) confidence = 'high'; // well-calibrated
    else if (rolling20Brier < 0.15) confidence = 'medium';

    // Recommended W_NEWS adjustment
    // If Brier < 0.10: trust LLM more (W_NEWS = 0.5+)
    // If Brier < 0.15: moderate trust (W_NEWS = 0.4)
    // If Brier > 0.20: low trust (W_NEWS = 0.2)
    let recommendedWNews = 0.4; // default
    if (rolling20Brier < 0.10) recommendedWNews = 0.55;
    else if (rolling20Brier < 0.15) recommendedWNews = 0.45;
    else if (rolling20Brier > 0.20) recommendedWNews = 0.2;

    return {
      totalSignals: allRecords.length,
      resolvedSignals: resolvedRecords.length,
      brierScore: overallBrier,
      rollingBrier20: rolling20Brier,
      confidence,
      recommendedWNews,
    };
  } catch (e) {
    console.error(`[calibration] Failed to compute stats:`, e instanceof Error ? e.message : String(e));
    return {
      totalSignals: 0,
      resolvedSignals: 0,
      brierScore: 0.25,
      rollingBrier20: 0.25,
      confidence: 'low',
      recommendedWNews: 0.2,
    };
  }
}

/**
 * Check if Claude is well-calibrated (Brier < threshold)
 * Returns true if we should use higher W_NEWS
 */
export function isWellCalibrated(brierThreshold = 0.15): boolean {
  const stats = getCalibrationStats();
  if (stats.resolvedSignals < 10) return false; // need minimum sample size
  return stats.rollingBrier20 < brierThreshold;
}

/**
 * Get prediction history for a specific signal
 */
export function getSignalPredictionHistory(signalId: string): any {
  try {
    const record = db.select()
      .from(schema.calibrationRecords)
      .where(eq(schema.calibrationRecords.signalId, signalId))
      .get();
    
    return record || null;
  } catch (e) {
    console.error(`[calibration] Failed to fetch record:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Get recent predictions (for dashboard)
 */
export function getRecentPredictions(limit = 20): any[] {
  try {
    const records = db.select()
      .from(schema.calibrationRecords)
      .orderBy(desc(schema.calibrationRecords.createdAt))
      .limit(limit)
      .all();
    
    return records || [];
  } catch (e) {
    console.error(`[calibration] Failed to fetch recent predictions:`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Compute Brier score for a specific date range
 */
export function getBrierScoreForDateRange(startDate: Date, endDate: Date): number {
  try {
    const records = db.select()
      .from(schema.calibrationRecords)
      .where(
        and(
          gte(schema.calibrationRecords.resolvedAt, startDate.toISOString()),
          lte(schema.calibrationRecords.resolvedAt, endDate.toISOString()),
        ),
      )
      .all() || [];

    if (records.length === 0) return 0.25;

    return records.reduce((sum, r) => sum + (r.brierScore || 0), 0) / records.length;
  } catch (e) {
    console.error(`[calibration] Failed to compute date-range Brier:`, e instanceof Error ? e.message : String(e));
    return 0.25;
  }
}
