import { NextRequest, NextResponse } from 'next/server';
import { getCalibrationStats, getRecentPredictions } from '@/intelligence/calibration';

/**
 * GET /api/calibration/stats — get overall calibration metrics
 * GET /api/calibration/recent — get recent predictions
 */

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get('sub') || 'stats';

    if (path === 'recent') {
      const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
      const predictions = getRecentPredictions(limit);

      return NextResponse.json({
        ok: true,
        predictions,
        count: predictions.length,
      });
    }

    // Default to stats
    const stats = getCalibrationStats();

    return NextResponse.json({
      ok: true,
      stats,
      message: `Claude calibration: Brier=${stats.brierScore.toFixed(3)}, confidence=${stats.confidence}`,
      recommendedAction: stats.confidence === 'high'
        ? `Increase W_NEWS to ${stats.recommendedWNews.toFixed(2)}`
        : `Keep W_NEWS conservative (currently recommended: ${stats.recommendedWNews.toFixed(2)})`,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
