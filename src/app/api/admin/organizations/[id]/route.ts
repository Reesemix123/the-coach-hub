// /api/admin/organizations/[id] - Organization detail API
// Returns detailed organization information with teams, users, billing, activity
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { getTierConfigs } from '@/lib/admin/config';
import {
  OrganizationDetail,
  OrganizationDerivedStatus,
  SubscriptionStatus,
  SubscriptionTier,
  TeamWithSubscription,
  ProfileWithAdmin,
  AuditLog
} from '@/types/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Derives organization status from subscription data
 */
function deriveOrganizationStatus(
  orgStatus: string,
  subscriptionStatuses: SubscriptionStatus[]
): OrganizationDerivedStatus {
  if (orgStatus === 'churned') return 'churned';
  if (!subscriptionStatuses.length) return 'inactive';
  if (subscriptionStatuses.includes('past_due')) return 'past_due';
  if (subscriptionStatuses.includes('active')) return 'active';
  if (subscriptionStatuses.includes('trialing')) return 'trialing';
  if (subscriptionStatuses.includes('waived')) return 'active';
  return 'inactive';
}

/**
 * GET /api/admin/organizations/[id]
 * Returns detailed information about a specific organization
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { id } = await params;
  // Use the service client to bypass RLS for admin queries
  const supabase = auth.serviceClient;

  try {
    // Fetch organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Fetch owner profile
    const { data: owner } = await supabase
      .from('profiles')
      .select('id, email, full_name, last_active_at')
      .eq('id', org.owner_user_id)
      .single();

    // Fetch teams with subscriptions
    const { data: teamsData } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        level,
        colors,
        user_id,
        organization_id,
        created_at,
        subscriptions (
          id,
          tier,
          status,
          billing_waived,
          billing_waived_reason,
          trial_ends_at,
          current_period_end,
          cancel_at_period_end
        )
      `)
      .eq('organization_id', id);

    // Build teams with subscription data
    const teams: TeamWithSubscription[] = (teamsData || []).map(team => ({
      id: team.id,
      name: team.name,
      level: team.level,
      colors: team.colors,
      user_id: team.user_id,
      organization_id: team.organization_id,
      created_at: team.created_at,
      subscription: Array.isArray(team.subscriptions) && team.subscriptions.length > 0
        ? {
            id: team.subscriptions[0].id,
            team_id: team.id,
            user_id: null,
            tier: team.subscriptions[0].tier,
            status: team.subscriptions[0].status,
            billing_waived: team.subscriptions[0].billing_waived,
            billing_waived_reason: team.subscriptions[0].billing_waived_reason,
            billing_waived_by: null,
            billing_waived_at: null,
            stripe_subscription_id: null,
            stripe_price_id: null,
            current_period_start: null,
            current_period_end: team.subscriptions[0].current_period_end,
            trial_ends_at: team.subscriptions[0].trial_ends_at,
            cancel_at_period_end: team.subscriptions[0].cancel_at_period_end,
            canceled_at: null,
            created_at: team.created_at,
            updated_at: team.created_at
          }
        : null
    }));

    // Fetch users in this organization
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, organization_id, is_platform_admin, last_active_at, created_at, updated_at')
      .eq('organization_id', id);

    const users: ProfileWithAdmin[] = usersData || [];

    // Get tier configs for MRR calculation
    const tierConfigs = await getTierConfigs();

    // Calculate totals
    let totalMRR = 0;
    const subscriptionStatuses: SubscriptionStatus[] = [];

    teams.forEach(team => {
      if (team.subscription) {
        subscriptionStatuses.push(team.subscription.status);

        if (team.subscription.status === 'active' || team.subscription.status === 'waived') {
          const tierConfig = tierConfigs?.[team.subscription.tier as SubscriptionTier];
          if (tierConfig) {
            totalMRR += tierConfig.price_monthly * 100; // cents
          }
        }
      }
    });

    // Fetch recent activity (audit logs for this organization)
    const { data: activityData } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('target_type', 'organization')
      .eq('target_id', id)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Also get activity related to teams in this org
    const { data: teamActivityData } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('target_type', 'team')
      .in('target_id', teamIds)
      .order('timestamp', { ascending: false })
      .limit(10);

    // Merge and sort activity
    const allActivity = [...(activityData || []), ...(teamActivityData || [])];
    allActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentActivity: AuditLog[] = allActivity.slice(0, 10);

    // Build response
    const response: OrganizationDetail = {
      ...org,
      owner: {
        id: owner?.id || org.owner_user_id,
        email: owner?.email || 'Unknown',
        full_name: owner?.full_name || null,
        last_active_at: owner?.last_active_at || null
      },
      derived_status: deriveOrganizationStatus(org.status, subscriptionStatuses),
      teams,
      users,
      total_mrr_cents: totalMRR,
      recent_activity: recentActivity
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]
 * Updates organization details (name, billing_email, status)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { id } = await params;
  // Use the service client to bypass RLS for admin queries
  const supabase = auth.serviceClient;

  try {
    const body = await request.json();
    const { name, billing_email, status } = body;

    // Validate status if provided
    if (status && !['active', 'suspended', 'churned'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Get current org for audit logging
    const { data: currentOrg, error: fetchError } = await supabase
      .from('organizations')
      .select('name, status')
      .eq('id', id)
      .single();

    if (fetchError || !currentOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (name !== undefined && name !== currentOrg.name) {
      updates.name = name;
      changes.name = { from: currentOrg.name, to: name };
    }
    if (billing_email !== undefined) {
      updates.billing_email = billing_email;
    }
    if (status !== undefined && status !== currentOrg.status) {
      updates.status = status;
      changes.status = { from: currentOrg.status, to: status };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No changes to apply' });
    }

    // Apply update
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log the admin action
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'organization.updated',
      'organization',
      id,
      currentOrg.name,
      { changes }
    );

    return NextResponse.json(updatedOrg);

  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}
