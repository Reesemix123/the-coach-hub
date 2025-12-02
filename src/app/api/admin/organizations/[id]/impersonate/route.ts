// /api/admin/organizations/[id]/impersonate - Admin Impersonation API
// Creates an impersonation session for support purposes
// Uses token-based authentication (Option A)
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { CreateImpersonationRequest, ImpersonationResponse } from '@/types/admin';
import { randomBytes } from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/organizations/[id]/impersonate
 * Creates an impersonation session for the organization owner
 *
 * Body:
 * - target_user_id: (optional) Specific user to impersonate, defaults to org owner
 * - reason: Required reason for impersonation (for audit)
 * - duration_minutes: (optional) Session duration, default 60, max 240
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { id: orgId } = await params;
  // Use the service client to bypass RLS for admin queries
  const supabase = auth.serviceClient;

  try {
    const body: CreateImpersonationRequest = await request.json();
    const { target_user_id, reason, duration_minutes = 60 } = body;

    // Validate reason
    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Validate duration (max 4 hours)
    const validDuration = Math.min(240, Math.max(15, duration_minutes));

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, owner_user_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Determine target user (default to org owner)
    const targetUserId = target_user_id || org.owner_user_id;

    // Verify target user exists and belongs to this org
    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, organization_id')
      .eq('id', targetUserId)
      .single();

    if (profileError || !targetProfile) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Verify target belongs to this org (or is owner)
    if (targetProfile.organization_id !== orgId && targetUserId !== org.owner_user_id) {
      return NextResponse.json(
        { error: 'Target user does not belong to this organization' },
        { status: 400 }
      );
    }

    // Prevent impersonating another platform admin
    const { data: targetAdminCheck } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', targetUserId)
      .single();

    if (targetAdminCheck?.is_platform_admin) {
      return NextResponse.json(
        { error: 'Cannot impersonate another platform admin' },
        { status: 403 }
      );
    }

    // Check for existing active impersonation by this admin
    const { data: existingSessions } = await supabase
      .from('impersonation_sessions')
      .select('id')
      .eq('admin_user_id', auth.admin.id)
      .is('ended_at', null)
      .gt('expires_at', new Date().toISOString());

    if (existingSessions && existingSessions.length > 0) {
      return NextResponse.json(
        { error: 'You already have an active impersonation session. End it first.' },
        { status: 400 }
      );
    }

    // Generate secure session token
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + validDuration * 60 * 1000);

    // Create impersonation session
    const { data: session, error: sessionError } = await supabase
      .from('impersonation_sessions')
      .insert({
        session_token: sessionToken,
        admin_user_id: auth.admin.id,
        target_user_id: targetUserId,
        organization_id: orgId,
        reason: reason.trim(),
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating impersonation session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create impersonation session' },
        { status: 500 }
      );
    }

    // Log the impersonation start
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'impersonation.started',
      'user',
      targetUserId,
      targetProfile.email,
      {
        organization_id: orgId,
        organization_name: org.name,
        reason: reason.trim(),
        duration_minutes: validDuration,
        session_id: session.id
      }
    );

    // Build redirect URL with impersonation token
    // The frontend will use this token to establish the impersonation context
    const redirectUrl = `/impersonate?token=${sessionToken}`;

    const response: ImpersonationResponse = {
      session_token: sessionToken,
      expires_at: expiresAt.toISOString(),
      redirect_url: redirectUrl
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating impersonation session:', error);
    return NextResponse.json(
      { error: 'Failed to create impersonation session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]/impersonate
 * Ends an active impersonation session
 *
 * Query params:
 * - token: The session token to end
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  // Use the service client to bypass RLS for admin queries
  const supabase = auth.serviceClient;
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Session token is required' },
      { status: 400 }
    );
  }

  try {
    // Find the session
    const { data: session, error: findError } = await supabase
      .from('impersonation_sessions')
      .select('id, admin_user_id, target_user_id, organization_id')
      .eq('session_token', token)
      .is('ended_at', null)
      .single();

    if (findError || !session) {
      return NextResponse.json(
        { error: 'Session not found or already ended' },
        { status: 404 }
      );
    }

    // Only the admin who started the session can end it (or another admin can revoke)
    const endReason = session.admin_user_id === auth.admin.id ? 'manual_logout' : 'admin_revoked';

    // End the session
    const { error: updateError } = await supabase
      .from('impersonation_sessions')
      .update({
        ended_at: new Date().toISOString(),
        ended_reason: endReason
      })
      .eq('id', session.id);

    if (updateError) {
      throw updateError;
    }

    // Get target user info for logging
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', session.target_user_id)
      .single();

    // Log the impersonation end
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'impersonation.ended',
      'user',
      session.target_user_id,
      targetProfile?.email || null,
      {
        organization_id: session.organization_id,
        reason: endReason,
        session_id: session.id,
        original_admin_id: session.admin_user_id
      }
    );

    return NextResponse.json({ success: true, reason: endReason });

  } catch (error) {
    console.error('Error ending impersonation session:', error);
    return NextResponse.json(
      { error: 'Failed to end impersonation session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/organizations/[id]/impersonate
 * Lists active impersonation sessions for this organization
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { id: orgId } = await params;
  // Use the service client to bypass RLS for admin queries
  const supabase = auth.serviceClient;

  try {
    // Fetch active sessions for this organization
    const { data: sessions, error } = await supabase
      .from('impersonation_sessions')
      .select(`
        id,
        session_token,
        admin_user_id,
        target_user_id,
        organization_id,
        reason,
        created_at,
        expires_at,
        ended_at,
        ended_reason
      `)
      .eq('organization_id', orgId)
      .is('ended_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with user info
    const enrichedSessions = await Promise.all((sessions || []).map(async (session) => {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', session.admin_user_id)
        .single();

      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', session.target_user_id)
        .single();

      return {
        ...session,
        admin: adminProfile || { email: 'Unknown', full_name: null },
        target: targetProfile || { email: 'Unknown', full_name: null }
      };
    }));

    return NextResponse.json({ sessions: enrichedSessions });

  } catch (error) {
    console.error('Error fetching impersonation sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch impersonation sessions' },
      { status: 500 }
    );
  }
}
