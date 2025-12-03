import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * User Sessions API
 * Manages active sessions/devices for the authenticated user
 */

// Helper to parse user agent into device info
function parseUserAgent(userAgent: string | null): {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  deviceName: string;
} {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      osVersion: '',
      deviceType: 'unknown',
      deviceName: 'Unknown Device',
    };
  }

  // Browser detection
  let browser = 'Unknown';
  let browserVersion = '';

  if (userAgent.includes('Firefox/')) {
    browser = 'Firefox';
    browserVersion = userAgent.match(/Firefox\/(\d+\.?\d*)/)?.[1] || '';
  } else if (userAgent.includes('Edg/')) {
    browser = 'Edge';
    browserVersion = userAgent.match(/Edg\/(\d+\.?\d*)/)?.[1] || '';
  } else if (userAgent.includes('Chrome/')) {
    browser = 'Chrome';
    browserVersion = userAgent.match(/Chrome\/(\d+\.?\d*)/)?.[1] || '';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
    browserVersion = userAgent.match(/Version\/(\d+\.?\d*)/)?.[1] || '';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR/')) {
    browser = 'Opera';
    browserVersion = userAgent.match(/(?:Opera|OPR)\/(\d+\.?\d*)/)?.[1] || '';
  }

  // OS detection
  let os = 'Unknown';
  let osVersion = '';

  if (userAgent.includes('Windows NT')) {
    os = 'Windows';
    const ntVersion = userAgent.match(/Windows NT (\d+\.?\d*)/)?.[1];
    if (ntVersion === '10.0') osVersion = '10/11';
    else if (ntVersion === '6.3') osVersion = '8.1';
    else if (ntVersion === '6.2') osVersion = '8';
    else if (ntVersion === '6.1') osVersion = '7';
  } else if (userAgent.includes('Mac OS X')) {
    os = 'macOS';
    osVersion = userAgent.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    osVersion = userAgent.match(/Android (\d+\.?\d*)/)?.[1] || '';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = userAgent.includes('iPad') ? 'iPadOS' : 'iOS';
    osVersion = userAgent.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  }

  // Device type detection
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'desktop';
  if (userAgent.includes('Mobile') || userAgent.includes('Android') && !userAgent.includes('Tablet')) {
    if (userAgent.includes('iPhone')) {
      deviceType = 'mobile';
    } else if (userAgent.includes('Android')) {
      deviceType = userAgent.includes('Mobile') ? 'mobile' : 'tablet';
    } else {
      deviceType = 'mobile';
    }
  } else if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
    deviceType = 'tablet';
  }

  // Generate friendly device name
  const deviceName = `${browser} on ${os}${osVersion ? ' ' + osVersion : ''}`;

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
    deviceName,
  };
}

// Generate a simple device fingerprint from available info
function generateDeviceId(userAgent: string | null, ip: string | null): string {
  const data = `${userAgent || 'unknown'}-${ip || 'unknown'}`;
  // Simple hash - in production you might want a more robust fingerprint
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * GET /api/user/sessions
 * Get all active sessions for the current user
 */
export async function GET(request: NextRequest) {
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

    // Get current session token for marking current session
    const { data: { session } } = await supabase.auth.getSession();
    const currentToken = session?.access_token
      ? session.access_token.substring(0, 32) // Use first 32 chars as identifier
      : null;

    // Get user sessions using the database function
    const { data, error } = await supabase.rpc('get_user_sessions', {
      p_user_id: user.id,
      p_current_session_token: currentToken,
      p_include_revoked: false,
    });

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Sessions GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/sessions
 * Register a new session (called after login)
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

    // Get session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 400 }
      );
    }

    // Use first 32 chars of access token as session identifier
    const sessionToken = session.access_token.substring(0, 32);

    // Get device info from request
    const userAgent = request.headers.get('user-agent');
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';

    const deviceInfo = parseUserAgent(userAgent);
    const deviceId = generateDeviceId(userAgent, ip);

    // Optional: Get location from request body (if client provides it)
    let city = null;
    let country = null;
    try {
      const body = await request.json();
      city = body.city || null;
      country = body.country || null;
    } catch {
      // No body provided, that's fine
    }

    // Register the session
    const { data, error } = await supabase.rpc('register_user_session', {
      p_user_id: user.id,
      p_session_token: sessionToken,
      p_device_id: deviceId,
      p_device_name: deviceInfo.deviceName,
      p_browser: deviceInfo.browser,
      p_browser_version: deviceInfo.browserVersion,
      p_os: deviceInfo.os,
      p_os_version: deviceInfo.osVersion,
      p_device_type: deviceInfo.deviceType,
      p_ip_address: ip,
      p_city: city,
      p_country: country,
    });

    if (error) {
      console.error('Error registering session:', error);
      return NextResponse.json(
        { error: 'Failed to register session' },
        { status: 500 }
      );
    }

    // If sessions were revoked, the response will include that info
    return NextResponse.json(data);
  } catch (error) {
    console.error('Sessions POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/sessions
 * Revoke a specific session or all other sessions
 */
export async function DELETE(request: NextRequest) {
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

    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    const currentToken = session?.access_token
      ? session.access_token.substring(0, 32)
      : null;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const revokeAll = searchParams.get('revoke_all') === 'true';

    if (revokeAll && currentToken) {
      // Revoke all other sessions
      const { data, error } = await supabase.rpc('revoke_all_other_sessions', {
        p_user_id: user.id,
        p_current_session_token: currentToken,
      });

      if (error) {
        console.error('Error revoking all sessions:', error);
        return NextResponse.json(
          { error: 'Failed to revoke sessions' },
          { status: 500 }
        );
      }

      return NextResponse.json(data);
    } else if (sessionId) {
      // Revoke specific session
      const { data, error } = await supabase.rpc('revoke_user_session', {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_reason: 'user_logout',
      });

      if (error) {
        console.error('Error revoking session:', error);
        return NextResponse.json(
          { error: 'Failed to revoke session' },
          { status: 500 }
        );
      }

      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { error: 'Must provide session_id or revoke_all=true' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Sessions DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/sessions
 * Update session activity (heartbeat)
 */
export async function PATCH(request: NextRequest) {
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

    // Get session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 400 }
      );
    }

    const sessionToken = session.access_token.substring(0, 32);

    // Update activity
    const { data, error } = await supabase.rpc('update_session_activity', {
      p_user_id: user.id,
      p_session_token: sessionToken,
    });

    if (error) {
      console.error('Error updating session activity:', error);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: data });
  } catch (error) {
    console.error('Sessions PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
