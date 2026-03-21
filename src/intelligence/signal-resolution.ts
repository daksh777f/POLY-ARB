/**
 * Signal Resolution Handler — resolves signals against market outcomes
 * Updates calibration records, computes Brier scores
 */

import { db } from '@/db';
import { schema } from '@/db';
import { recordPrediction, getCalibrationStats } from '@/intelligence/calibration';
import { logSignalResolved } from '@/store/audit-log';
import { config } from '@/lib/config';

export interface SignalResolutionInput {
  signalId: string;
  marketId: string;
  predictedProbability: number; // from signal.darwinEstimate
  actualOutcome: 0 | 1; // 0 = NO, 1 = YES
  resolutionMethod?: string; // 'polymarket_api', 'user_input', 'auto_detect'
}

/**
 * Resolve a signal against actual market outcome
 * Updates calibration and audit trail
 */
export function resolveSignal(input: SignalResolutionInput): {
  ok: boolean;
  brierScore?: number;
  calibrationStats?: any;
  error?: string;
} {
  try {
    const { signalId, marketId, predictedProbability, actualOutcome } = input;

    // Record the prediction (computes Brier score)
    const brierScore = recordPrediction(signalId, predictedProbability, actualOutcome);

    // Log to audit trail
    logSignalResolved(signalId, marketId, predictedProbability, actualOutcome);

    // Get updated calibration stats
    const stats = getCalibrationStats();

    // If calibration has changed materially, log it
    if (stats.confidence !== 'low') {
      console.log(
        `[resolution] Signal ${signalId} resolved. Brier: ${brierScore.toFixed(4)}, ` +
        `Rolling20: ${stats.rollingBrier20.toFixed(4)}, Recommended W_NEWS: ${stats.recommendedWNews.toFixed(2)}`,
      );
    }

    return {
      ok: true,
      brierScore,
      calibrationStats: stats,
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`[resolution] Failed to resolve signal:`, errorMsg);
    return {
      ok: false,
      error: errorMsg,
    };
  }
}

/**
 * Batch resolve signals (e.g., from Polymarket API)
 * Used to update multiple signals at once
 */
export function resolveBatch(resolutions: SignalResolutionInput[]): {
  ok: boolean;
  processed: number;
  failed: number;
  stats?: any;
} {
  let processed = 0;
  let failed = 0;

  for (const resolution of resolutions) {
    const result = resolveSignal(resolution);
    if (result.ok) {
      processed++;
    } else {
      failed++;
      console.error(`Failed to resolve ${resolution.signalId}:`, result.error);
    }
  }

  const finalStats = getCalibrationStats();

  return {
    ok: failed === 0,
    processed,
    failed,
    stats: finalStats,
  };
}

/**
 * Get current recommended W_NEWS based on calibration
 * Used to dynamically adjust signal generation weights
 */
export function getRecommendedWeights(): {
  w_news: number;
  w_time: number;
  reason: string;
} {
  const stats = getCalibrationStats();

  let w_news = config.ev.wNews; // use config default as fallback
  let reason = 'using config default';

  if (stats.resolvedSignals >= 10) {
    // Only adjust after 10+ resolved signals
    w_news = stats.recommendedWNews;
    reason = `calibration-based (${stats.confidence} confidence, Brier: ${stats.rollingBrier20.toFixed(3)})`;
  } else {
    reason = `insufficient data (${stats.resolvedSignals} resolved signals)`;
  }

  return {
    w_news,
    w_time: config.ev.wTime, // time weight stays constant
    reason,
  };
}

/**
 * Mark a signal as expired without resolution
 */
export function expireSignal(signalId: string, marketId: string): {
  ok: boolean;
  error?: string;
} {
  try {
    db.insert(schema.auditLog).values({
      id: `audit_${Date.now()}_${Math.random()}`,
      signalId,
      marketId,
      eventType: 'signal_expired',
      notes: 'Signal expired without market resolution',
      createdAt: new Date().toISOString(),
    }).run();

    return { ok: true };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Interactive query: what would calibration tell us now?
 */
export function calibrationSnapshot(): {
  totalSignals: number;
  resolvedSignals: number;
  brierScore: number;
  confidence: string;
  adjustedWNews: number;
  recommendation: string;
} {
  const stats = getCalibrationStats();
  const weights = getRecommendedWeights();

  let recommendation = '';
  if (stats.confidence === 'high') {
    recommendation = '✓ Claude is well-calibrated; can trust estimates more';
  } else if (stats.confidence === 'medium') {
    recommendation = '~ Claude is moderately calibrated; keep conservative weights';
  } else {
    recommendation = '⚠ Claude is poorly calibrated; reduce W_NEWS further';
  }

  return {
    totalSignals: stats.totalSignals,
    resolvedSignals: stats.resolvedSignals,
    brierScore: stats.brierScore,
    confidence: stats.confidence,
    adjustedWNews: weights.w_news,
    recommendation,
  };
}
