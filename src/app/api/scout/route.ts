import { NextRequest, NextResponse } from 'next/server';
import { getRecentScoutEvents, getLatestScoutEvent } from '@/store/scout-events';
import { getSignals } from '@/store/signals';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const safeLimit = isNaN(limit) ? 10 : limit;
  const liveEvents = getRecentScoutEvents(safeLimit);

  // If no live scout events are available yet, surface recent signals so the
  // panel still reflects active analysis/trading state.
  const events = liveEvents.length > 0
    ? liveEvents
    : getSignals({ limit: safeLimit }).map((signal) => ({
        id: `signal-${signal.id}`,
        article: {
          title: `Signal ${signal.direction.toUpperCase()} | EV ${signal.ev.toFixed(3)}`,
          url: '',
          source: 'signals',
          snippet: signal.reasoning.slice(0, 200),
        },
        matchedMarkets: [{
          marketId: signal.marketId,
          question: signal.marketQuestion,
          keywordOverlap: 1,
          capturedPrice: signal.marketPrice,
        }],
        timestamp: signal.createdAt,
      }));

  const latest = liveEvents.length > 0
    ? getLatestScoutEvent()
    : (events[0] ?? null);
  return NextResponse.json({
    events,
    latestAt: latest?.timestamp ?? null,
  });
}
