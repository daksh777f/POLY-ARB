import { NextRequest, NextResponse } from 'next/server';
import { acceptAllDisclaimers, getUserComplianceStatus, DISCLAIMERS } from '@/intelligence/compliance';

/**
 * GET /api/compliance/status — get user compliance status
 * POST /api/compliance/accept-terms — accept disclaimers
 */

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'anon';

    const status = getUserComplianceStatus(userId);

    if (!status) {
      return NextResponse.json({
        ok: false,
        status: null,
        disclaimers: DISCLAIMERS,
        message: 'User has not accepted disclaimers yet',
      }, { status: 200 });
    }

    return NextResponse.json({
      ok: true,
      status,
      message: 'User compliance status retrieved',
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
    const userId = request.headers.get('x-user-id') || 'anon';
    const geo = request.headers.get('cf-ipcountry') || request.headers.get('x-geo') || undefined;

    const body = await request.json();
    const { accepted } = body;

    if (!accepted) {
      return NextResponse.json({
        ok: false,
        error: 'Must explicitly accept all disclaimers',
      }, { status: 400 });
    }

    const result = acceptAllDisclaimers(userId, geo);

    if (result) {
      return NextResponse.json({
        ok: true,
        message: 'All disclaimers accepted',
      });
    } else {
      return NextResponse.json({
        ok: false,
        error: 'Failed to save acceptance',
      }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
