import { NextRequest, NextResponse } from 'next/server';
import { resolveSignal, resolveBatch, calibrationSnapshot, getRecommendedWeights } from '@/intelligence/signal-resolution';

/**
 * POST /api/signals/resolve — manually resolve a signal
 * GET /api/signals/calibration-snapshot — get calibration state
 */

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get('sub') || 'snapshot';

    if (path === 'weights') {
      const weights = getRecommendedWeights();
      return NextResponse.json({
        ok: true,
        weights,
        message: `Current recommended W_NEWS=${weights.w_news.toFixed(2)} (${weights.reason})`,
      });
    }

    // Default: snapshot
    const snapshot = calibrationSnapshot();

    return NextResponse.json({
      ok: true,
      snapshot,
      recommendation: snapshot.recommendation,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signalId, marketId, predictedProbability, actualOutcome, batch } = body;

    if (batch) {
      // Batch resolution
      const result = resolveBatch(batch);

      return NextResponse.json({
        ok: result.ok,
        processed: result.processed,
        failed: result.failed,
        stats: result.stats,
      });
    } else {
      // Single signal
      const result = resolveSignal({
        signalId,
        marketId,
        predictedProbability,
        actualOutcome: actualOutcome === 1 ? 1 : 0,
      });

      if (!result.ok) {
        return NextResponse.json({
          ok: false,
          error: result.error,
        }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        brierScore: result.brierScore,
        stats: result.calibrationStats,
        message: `Signal resolved. Brier: ${result.brierScore?.toFixed(4)}`,
      });
    }
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
