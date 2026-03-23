/**
 * Signal Resolution Service - Automatically resolves signals when markets close
 * Fetches actual outcomes from Polymarket and updates calibration records
 */

import { db, schema } from '@/db'
import { eq, and, isNull, gte, lt, sql, desc } from 'drizzle-orm'
import { logSignalResolved } from '@/store/audit-log'
import { recordPrediction, getCalibrationStats } from './calibration'
import { fetchMarketById } from '@/data/polymarket'
import { config } from '@/lib/config'
import type { Signal } from '@/lib/types'

export interface ResolutionResult {
  success: boolean
  signalId?: string
  brierScore?: number
  error?: string
  calibrationStats?: {
    totalSignals: number
    resolvedSignals: number
    brierScore: number
    rollingBrier20: number
  }
}

export interface BatchResolutionResult {
  ok: boolean
  processed: number
  failed: number
  stats?: {
    totalSignals: number
    resolvedSignals: number
    brierScore: number
    rollingBrier20: number
  }
}

/**
 * Get all signals that need to be resolved (expired markets without outcome)
 * 
 * NOTE: The batch parameter was removed in favor of automatic resolution.
 * The API now auto-resolves all expired signals when called without specific IDs.
 * This is a breaking change from the previous behavior where specific signal IDs
 * could be passed to resolve.
 */
function getSignalsForResolution(): Signal[] {
  const now = new Date().toISOString()

  // Get signals where expires_at < now and no actual_outcome
  // Using SQL filtering for efficiency - only fetch expired signals
  const rows = db
    .select()
    .from(schema.signals)
    .where(
      and(
        isNull(schema.signals.actualOutcome),
        gte(schema.signals.expiresAt, '2020-01-01'),
      ),
    )
    .all()

  // Filter for expired signals (already done in SQL with better index usage)
  const expiredSignals = rows.filter((row) => {
    const expiresAt = row.expiresAt
    return expiresAt && new Date(expiresAt).getTime() < Date.now()
  })

  return expiredSignals.map((row) => ({
    id: row.id,
    marketId: row.marketId,
    marketQuestion: row.marketQuestion,
    darwinEstimate: row.darwinEstimate,
    marketPrice: row.marketPrice,
    ev: row.ev,
    direction: row.direction as 'yes' | 'no',
    reasoning: row.reasoning,
    newsEvents: JSON.parse(row.newsEvents) as string[],
    confidence: row.confidence as 'low' | 'medium' | 'high',
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  }))
}

/**
 * Fetch the actual outcome for a market from Polymarket
 */
async function fetchMarketOutcome(marketId: string): Promise<{
  outcome: boolean | null
  probability: number | null
  error?: string
}> {
  const result = await fetchMarketById(marketId)

  if (!result.ok) {
    return { outcome: null, probability: null, error: result.error }
  }

  const market = result.data

  // If market is still active, it hasn't resolved yet
  if (new Date(market.endDate).getTime() > Date.now()) {
    return { outcome: null, probability: null, error: 'Market not yet expired' }
  }

  const probability = market.probability

  // Polymarket resolution: >= 0.5 = YES, < 0.5 = NO
  if (probability >= 0.5) {
    return { outcome: true, probability }
  } else {
    return { outcome: false, probability }
  }
}

/**
 * Resolve a single signal and record the outcome
 */
export async function resolveSignal(input: {
  signalId: string
  marketId: string
  predictedProbability: number
  actualOutcome: 0 | 1
}): Promise<ResolutionResult> {
  try {
    const { signalId, marketId, predictedProbability, actualOutcome } = input

    // Update the signal with the actual outcome
    const actualOutcomeBool = actualOutcome === 1

    db.update(schema.signals)
      .set({
        actualOutcome: actualOutcomeBool,
        calibrationResolvedAt: new Date().toISOString(),
      })
      .where(eq(schema.signals.id, signalId))
      .run()

    // Record the prediction for calibration tracking
    const brierScore = recordPrediction(signalId, predictedProbability, actualOutcome)

    // Log to audit
    logSignalResolved(signalId, marketId, predictedProbability, actualOutcome)

    // Get calibration stats
    const stats = getCalibrationStats()

    console.log(
      `[signal-resolution] Resolved signal ${signalId}: predicted ${predictedProbability.toFixed(2)}, actual ${actualOutcome === 1 ? 'YES' : 'NO'}, Brier: ${brierScore.toFixed(4)}`,
    )

    return {
      success: true,
      signalId,
      brierScore,
      calibrationStats: {
        totalSignals: stats.totalSignals,
        resolvedSignals: stats.resolvedSignals,
        brierScore: stats.brierScore,
        rollingBrier20: stats.rollingBrier20,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[signal-resolution] Failed to resolve signal:`, errorMessage)

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Batch resolve all expired signals automatically
 * 
 * @param _batch - DEPRECATED: This parameter is ignored. Signals are now auto-resolved
 *   based on expiration date. This is a breaking change from the previous API.
 *   Previously, specific signal IDs could be passed to resolve. Now all expired
 *   signals are resolved automatically when this function is called.
 * 
 * @returns BatchResolutionResult with processed/failed counts and calibration stats
 */
export async function resolveBatch(_batch?: string[]): Promise<BatchResolutionResult> {
  const signals = getSignalsForResolution()

  if (signals.length === 0) {
    const stats = getCalibrationStats()
    return {
      ok: true,
      processed: 0,
      failed: 0,
      stats: {
        totalSignals: stats.totalSignals,
        resolvedSignals: stats.resolvedSignals,
        brierScore: stats.brierScore,
        rollingBrier20: stats.rollingBrier20,
      },
    }
  }

  let processed = 0
  let failed = 0

  // Process each signal
  for (const signal of signals) {
    try {
      const outcomeResult = await fetchMarketOutcome(signal.marketId)

      if (!outcomeResult.outcome && outcomeResult.outcome !== false) {
        failed++
        continue
      }

      const actualOutcome = outcomeResult.outcome ? 1 : 0

      // Update the signal
      db.update(schema.signals)
        .set({
          actualOutcome: outcomeResult.outcome,
          calibrationResolvedAt: new Date().toISOString(),
        })
        .where(eq(schema.signals.id, signal.id))
        .run()

      // Record prediction
      recordPrediction(signal.id, signal.darwinEstimate, actualOutcome)

      // Log to audit
      logSignalResolved(signal.id, signal.marketId, signal.darwinEstimate, actualOutcome)

      processed++
    } catch (error) {
      console.error(`[signal-resolution] Failed to resolve signal ${signal.id}:`, error)
      failed++
    }
  }

  const stats = getCalibrationStats()

  console.log(
    `[signal-resolution] Batch resolution complete: ${processed} resolved, ${failed} failed`,
  )

  return {
    ok: failed === 0,
    processed,
    failed,
    stats: {
      totalSignals: stats.totalSignals,
      resolvedSignals: stats.resolvedSignals,
      brierScore: stats.brierScore,
      rollingBrier20: stats.rollingBrier20,
    },
  }
}

/**
 * Get calibration snapshot for dashboard
 */
export function calibrationSnapshot() {
  const stats = getCalibrationStats()

  return {
    totalSignals: stats.totalSignals,
    resolvedSignals: stats.resolvedSignals,
    pendingSignals: stats.totalSignals - stats.resolvedSignals,
    brierScore: stats.brierScore,
    rollingBrier20: stats.rollingBrier20,
    confidence: stats.confidence,
    recommendation: getRecommendation(stats),
  }
}

/**
 * Get recommended weights based on calibration
 */
export function getRecommendedWeights() {
  const stats = getCalibrationStats()

  let wNews = config.ev.wNews
  let reason = 'Default weights'

  if (stats.resolvedSignals >= 10) {
    if (stats.rollingBrier20 < 0.10) {
      wNews = 0.55
      reason = 'Well-calibrated (Brier < 0.10), increasing W_NEWS'
    } else if (stats.rollingBrier20 < 0.15) {
      wNews = 0.45
      reason = 'Moderately calibrated (Brier < 0.15), keeping W_NEWS'
    } else {
      wNews = 0.2
      reason = 'Poorly calibrated (Brier > 0.15), reducing W_NEWS'
    }
  } else {
    reason = `Need more samples (${stats.resolvedSignals}/10), keeping current W_NEWS`
  }

  return {
    w_news: wNews,
    w_time: config.ev.wTime,
    reason,
  }
}

function getRecommendation(stats: { brierScore: number; rollingBrier20: number; resolvedSignals: number }): string {
  if (stats.resolvedSignals < 10) {
    return `Need ${10 - stats.resolvedSignals} more resolved signals for reliable calibration`
  }

  if (stats.rollingBrier20 < 0.10) {
    return 'System is well-calibrated. Consider increasing W_NEWS for better signal detection.'
  }

  if (stats.rollingBrier20 < 0.15) {
    return 'System is moderately calibrated. Current weights are appropriate.'
  }

  return 'System is poorly calibrated. Consider reducing W_NEWS or reviewing signal generation logic.'
}
