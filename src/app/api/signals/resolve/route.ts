import { NextRequest, NextResponse } from 'next/server';
import { resolveSignal, resolveBatch, calibrationSnapshot, getRecommendedWeights } from '@/intelligence/signal-resolution';
import { validate } from '@/lib/schemas';
import { ResolveSignalInputSchema, BatchResolutionInputSchema } from '@/lib/schemas';
import { logError, ErrorCode } from '@/lib/errors';
import { createRateLimitMiddleware, analysisLimiter } from '@/lib/rate-limit';

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

// Create rate limit middleware for this route
const rateLimitMiddleware = createRateLimitMiddleware(analysisLimiter);

export async function POST(request: NextRequest) {
  // Apply rate limiting - use IP as key
  const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimitResponse = rateLimitMiddleware(clientIp);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const body = await request.json();
    
    // Check if it's a batch request or single signal request
    if (body.batch !== undefined) {
      // Batch resolution - validate the batch request
      const validation = validate(BatchResolutionInputSchema, body, 'resolve-batch');
      if (!validation.ok) {
        return NextResponse.json({
          ok: false,
          error: validation.error,
          code: 'VALIDATION_FAILED',
        }, { status: 400 });
      }
      
      const result = await resolveBatch(body.batch);
      return NextResponse.json({
        ok: result.ok,
        processed: result.processed,
        failed: result.failed,
        stats: result.stats,
      });
    } else {
      // Single signal resolution - validate the input
      const validation = validate(ResolveSignalInputSchema, body, 'resolve-signal');
      if (!validation.ok) {
        return NextResponse.json({
          ok: false,
          error: validation.error,
          code: 'VALIDATION_FAILED',
        }, { status: 400 });
      }
      
      const { signalId, marketId, predictedProbability, actualOutcome } = validation.data;
      const result = await resolveSignal({
        signalId,
        marketId,
        predictedProbability,
        actualOutcome,
      });

      if (!result.success) {
        return NextResponse.json({
          ok: false,
          error: result.error,
          code: 'RESOLUTION_FAILED',
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
    const error = e instanceof Error ? e : new Error(String(e));
    logError('API:signals:resolve:POST', error, { body: 'parsed' });
    return NextResponse.json({
      ok: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}
