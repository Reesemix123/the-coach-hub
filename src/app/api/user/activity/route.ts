import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/server';
import { logAuthEvent, getClientIp, getUserAgent } from '@/lib/services/logging.service';

/**
 * POST /api/user/activity
 * Updates the current user's last_active_at timestamp and login status
 * Call this after successful login
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use service client to bypass RLS for profile update
    const serviceClient = createServiceClient();
    const ipAddress = getClientIp(request.headers) || null;
    const userAgent = getUserAgent(request.headers) || null;

    // Update profiles.last_active_at
    const { error } = await serviceClient
      .from('profiles')
      .update({
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to update activity:', error);
      return NextResponse.json(
        { error: 'Failed to update activity' },
        { status: 500 }
      );
    }

    // Update user_status table (login count, first/last login)
    const { error: statusError } = await serviceClient.rpc('update_user_login_status', {
      p_user_id: user.id,
      p_ip_address: ipAddress,
      p_user_agent: userAgent
    });

    if (statusError) {
      console.error('Failed to update user_status:', statusError);
      // Don't fail the request - this is supplementary tracking
    }

    // Log successful login event
    await logAuthEvent({
      userId: user.id,
      userEmail: user.email || null,
      action: 'login',
      status: 'success',
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      metadata: {
        auth_provider: user.app_metadata?.provider || 'email',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Activity update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
