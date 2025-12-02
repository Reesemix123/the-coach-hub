// /api/admin/organizations/[id]/audit-log - Organization Audit Log API
// Returns paginated audit log for an organization
// Captures: usage patterns, cost-impacting events, support-helpful data
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { AuditLog } from '@/types/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Define audit action categories for filtering
const USAGE_PATTERN_ACTIONS = [
  'play_instance.created',
  'play_instance.updated',
  'game.created',
  'playbook_play.created',
  'video.uploaded',
  'ai_action.executed'
];

const COST_IMPACT_ACTIONS = [
  'ai_credits.used',
  'ai_credits.allocated',
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.waived',
  'billing.invoice.paid',
  'billing.invoice.failed'
];

const SUPPORT_ACTIONS = [
  'user.login',
  'user.logout',
  'user.invited',
  'user.removed',
  'user.role_changed',
  'impersonation.started',
  'impersonation.ended',
  'team.created',
  'team.updated',
  'team.deleted',
  'organization.updated',
  'error.encountered'
];

/**
 * GET /api/admin/organizations/[id]/audit-log
 * Returns paginated audit log for the organization
 *
 * Query params:
 * - category: Filter by category (usage, cost, support, all)
 * - action: Filter by specific action type
 * - actor_id: Filter by who performed the action
 * - start_date: Filter logs after this date
 * - end_date: Filter logs before this date
 * - page: Page number (1-indexed)
 * - page_size: Items per page (default 50, max 100)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { id: orgId } = await params;
  // Use the service client to bypass RLS for admin queries
  const supabase = auth.serviceClient;
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const category = searchParams.get('category') || 'all';
  const actionFilter = searchParams.get('action');
  const actorIdFilter = searchParams.get('actor_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50')));

  try {
    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get team IDs for this organization
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('organization_id', orgId);

    const teamIds = teams?.map(t => t.id) || [];

    // Get user IDs for this organization
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId);

    const userIds = users?.map(u => u.id) || [];

    // Determine which actions to include based on category
    let actionsList: string[] = [];
    if (category === 'usage') {
      actionsList = USAGE_PATTERN_ACTIONS;
    } else if (category === 'cost') {
      actionsList = COST_IMPACT_ACTIONS;
    } else if (category === 'support') {
      actionsList = SUPPORT_ACTIONS;
    }

    // Build query - we need to find logs related to this org through multiple paths:
    // 1. target_type = 'organization' AND target_id = orgId
    // 2. target_type = 'team' AND target_id IN teamIds
    // 3. target_type = 'user' AND target_id IN userIds
    // 4. actor_id IN userIds

    // Query for organization-related logs
    let orgLogsQuery = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('target_type', 'organization')
      .eq('target_id', orgId);

    // Query for team-related logs
    let teamLogsQuery = teamIds.length > 0
      ? supabase
          .from('audit_logs')
          .select('*')
          .eq('target_type', 'team')
          .in('target_id', teamIds)
      : null;

    // Query for user-related logs (actions by users in this org)
    let userLogsQuery = userIds.length > 0
      ? supabase
          .from('audit_logs')
          .select('*')
          .in('actor_id', userIds)
      : null;

    // Apply common filters
    if (startDate) {
      orgLogsQuery = orgLogsQuery.gte('timestamp', startDate);
      if (teamLogsQuery) teamLogsQuery = teamLogsQuery.gte('timestamp', startDate);
      if (userLogsQuery) userLogsQuery = userLogsQuery.gte('timestamp', startDate);
    }

    if (endDate) {
      orgLogsQuery = orgLogsQuery.lte('timestamp', endDate);
      if (teamLogsQuery) teamLogsQuery = teamLogsQuery.lte('timestamp', endDate);
      if (userLogsQuery) userLogsQuery = userLogsQuery.lte('timestamp', endDate);
    }

    if (actionFilter) {
      orgLogsQuery = orgLogsQuery.eq('action', actionFilter);
      if (teamLogsQuery) teamLogsQuery = teamLogsQuery.eq('action', actionFilter);
      if (userLogsQuery) userLogsQuery = userLogsQuery.eq('action', actionFilter);
    } else if (actionsList.length > 0) {
      orgLogsQuery = orgLogsQuery.in('action', actionsList);
      if (teamLogsQuery) teamLogsQuery = teamLogsQuery.in('action', actionsList);
      if (userLogsQuery) userLogsQuery = userLogsQuery.in('action', actionsList);
    }

    if (actorIdFilter) {
      orgLogsQuery = orgLogsQuery.eq('actor_id', actorIdFilter);
      if (teamLogsQuery) teamLogsQuery = teamLogsQuery.eq('actor_id', actorIdFilter);
      if (userLogsQuery) userLogsQuery = userLogsQuery.eq('actor_id', actorIdFilter);
    }

    // Execute queries
    const { data: orgLogs } = await orgLogsQuery.order('timestamp', { ascending: false });
    const teamLogsResult = teamLogsQuery ? await teamLogsQuery.order('timestamp', { ascending: false }) : null;
    const userLogsResult = userLogsQuery ? await userLogsQuery.order('timestamp', { ascending: false }) : null;

    // Merge and deduplicate logs
    const allLogsMap = new Map<string, AuditLog>();

    (orgLogs || []).forEach(log => allLogsMap.set(log.id, log));
    (teamLogsResult?.data || []).forEach(log => allLogsMap.set(log.id, log));
    (userLogsResult?.data || []).forEach(log => allLogsMap.set(log.id, log));

    // Convert to array and sort
    let allLogs = Array.from(allLogsMap.values());
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate pagination
    const total = allLogs.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // Slice for pagination
    const paginatedLogs = allLogs.slice(offset, offset + pageSize);

    const response: AuditLogResponse = {
      logs: paginatedLogs,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}
