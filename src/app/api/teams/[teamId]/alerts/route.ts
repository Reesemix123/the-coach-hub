// /api/teams/:teamId/alerts - Get and manage alerts for a team
// Returns active alerts and allows dismissing them

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface Alert {
  id: string;
  team_id: string | null;
  user_id: string | null;
  organization_id: string | null;
  alert_type: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  action_url: string | null;
  action_label: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
}

interface AlertsResponse {
  alerts: Alert[];
  unread_count: number;
  total_count: number;
}

/**
 * GET /api/teams/:teamId/alerts
 * Returns active alerts for the team (not dismissed, not expired)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const includeRead = searchParams.get('include_read') === 'true';
  const includeDismissed = searchParams.get('include_dismissed') === 'true';
  const alertType = searchParams.get('type');

  // Build query for team alerts
  let query = supabase
    .from('alerts')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  // Filter out dismissed by default
  if (!includeDismissed) {
    query = query.eq('is_dismissed', false);
  }

  // Filter by type if specified
  if (alertType) {
    query = query.eq('alert_type', alertType);
  }

  // Filter expired alerts
  query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  const { data: alerts, error: alertsError } = await query;

  if (alertsError) {
    console.error('Error fetching alerts:', alertsError);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }

  // Count unread
  const unreadCount = (alerts || []).filter(a => !a.is_read).length;

  const response: AlertsResponse = {
    alerts: alerts || [],
    unread_count: unreadCount,
    total_count: (alerts || []).length
  };

  return NextResponse.json(response);
}

/**
 * PATCH /api/teams/:teamId/alerts
 * Update alert state (mark read, dismiss)
 *
 * Request body:
 * {
 *   alert_ids: string[],   // Alert IDs to update
 *   action: 'read' | 'dismiss' | 'unread'
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: { alert_ids: string[]; action: 'read' | 'dismiss' | 'unread' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { alert_ids, action } = body;

  if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
    return NextResponse.json(
      { error: 'alert_ids is required and must be a non-empty array' },
      { status: 400 }
    );
  }

  if (!['read', 'dismiss', 'unread'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be one of: read, dismiss, unread' },
      { status: 400 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
  }

  // Build update data based on action
  let updateData: Record<string, unknown>;
  switch (action) {
    case 'read':
      updateData = { is_read: true };
      break;
    case 'dismiss':
      updateData = {
        is_dismissed: true,
        dismissed_at: new Date().toISOString(),
        dismissed_by: user.id
      };
      break;
    case 'unread':
      updateData = { is_read: false };
      break;
    default:
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
  }

  // Update alerts
  const { data: updatedAlerts, error: updateError } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('team_id', teamId)
    .in('id', alert_ids)
    .select();

  if (updateError) {
    console.error('Error updating alerts:', updateError);
    return NextResponse.json(
      { error: 'Failed to update alerts' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    updated_count: updatedAlerts?.length || 0,
    alerts: updatedAlerts
  });
}
