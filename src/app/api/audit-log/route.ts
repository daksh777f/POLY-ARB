import { NextRequest, NextResponse } from 'next/server';
import { getRecentAuditEvents, getSignalAuditTrail } from '@/store/audit-log';

/**
 * GET /api/audit-log — get recent audit events
 * GET /api/audit-log?signalId=... — get audit trail for specific signal
 */

export async function GET(request: NextRequest) {
  try {
    const signalId = request.nextUrl.searchParams.get('signalId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    if (signalId) {
      // Get audit trail for specific signal
      const trail = getSignalAuditTrail(signalId);

      return NextResponse.json({
        ok: true,
        signalId,
        auditTrail: trail,
        eventCount: trail.length,
      });
    }

    // Get recent events
    const events = getRecentAuditEvents(limit);

    return NextResponse.json({
      ok: true,
      events,
      count: events.length,
      purpose: 'Compliance & regulatory audit trail - all signal-related decisions and resolutions',
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
