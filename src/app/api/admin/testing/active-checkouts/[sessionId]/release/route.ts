// /api/admin/testing/active-checkouts/[sessionId]/release - Force-Release Session API
// Allows a platform admin to force-release a stuck active test session.
// Sets status to 'released', closes any open time logs, and records the action.
// Requires platform admin authentication.

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/admin/testing/active-checkouts/[sessionId]/release
 * Force-releases an active test session.
 *
 * 1. Auth check
 * 2. Sets status = 'released' on the matching active session
 * 3. Closes any open time logs (ended_at = now, is_active = false)
 * 4. Logs the admin action to audit_logs
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { admin, serviceClient } = auth;

  try {
    const { sessionId } = await params;

    // Update the session to 'released' only if it is currently active
    const { data: updatedSessions, error: updateError } = await serviceClient
      .from('test_sessions')
      .update({ status: 'released' })
      .eq('id', sessionId)
      .eq('status', 'active')
      .select('id');

    if (updateError) {
      console.error('Failed to release test session:', updateError);
      return NextResponse.json(
        { error: 'Failed to release session' },
        { status: 500 }
      );
    }

    // No rows updated means the session does not exist or is not active
    if (!updatedSessions || updatedSessions.length === 0) {
      return NextResponse.json(
        { error: 'Session not found or is not currently active' },
        { status: 404 }
      );
    }

    // Close any open time logs for this session
    const { error: timeLogError } = await serviceClient
      .from('time_logs')
      .update({
        ended_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('session_id', sessionId)
      .eq('is_active', true);

    if (timeLogError) {
      // Non-fatal: the session was already released; log the issue but proceed
      console.error('Failed to close time logs for released session:', timeLogError);
    }

    await logAdminAction(
      admin.id,
      admin.email,
      'testing.session_released',
      'test_session',
      sessionId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error releasing test session:', error);
    return NextResponse.json(
      { error: 'Server error while releasing session' },
      { status: 500 }
    );
  }
}
