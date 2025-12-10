import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logAuthEvent, getClientIp, getUserAgent } from '@/lib/services/logging.service';

/**
 * POST /api/auth/logout
 * Logs the logout event before the user signs out
 * Call this before calling supabase.auth.signOut()
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user before they sign out
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // Still return success - they may already be logged out
      return NextResponse.json({ success: true, message: 'No active session' });
    }

    // Log the logout event
    await logAuthEvent({
      userId: user.id,
      userEmail: user.email || null,
      action: 'logout',
      status: 'success',
      ipAddress: getClientIp(request.headers) || undefined,
      userAgent: getUserAgent(request.headers) || undefined,
      metadata: {
        auth_provider: user.app_metadata?.provider || 'email',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout logging error:', error);
    // Still return success - don't block logout
    return NextResponse.json({ success: true, error: 'Failed to log event' });
  }
}
