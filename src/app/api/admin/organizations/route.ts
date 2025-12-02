// /api/admin/organizations - Organizations list API
// Returns paginated, searchable list of organizations with derived status
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getTierConfigs } from '@/lib/admin/config';
import {
  OrganizationListItem,
  OrganizationListResponse,
  OrganizationDerivedStatus,
  SubscriptionTier,
  SubscriptionStatus
} from '@/types/admin';

/**
 * Derives organization status from subscription data
 * - active: Has at least one active subscription
 * - trialing: Has at least one trial subscription (no active)
 * - past_due: Has at least one past_due subscription
 * - churned: Organization marked as churned OR all subscriptions canceled
 * - inactive: No subscriptions or all subscriptions are 'none'
 */
function deriveOrganizationStatus(
  orgStatus: string,
  subscriptionStatuses: SubscriptionStatus[]
): OrganizationDerivedStatus {
  // If org is explicitly churned, that takes precedence
  if (orgStatus === 'churned') return 'churned';

  // No subscriptions = inactive
  if (!subscriptionStatuses.length) return 'inactive';

  // Check for past_due (billing issue - important to surface)
  if (subscriptionStatuses.includes('past_due')) return 'past_due';

  // Check for active subscriptions
  if (subscriptionStatuses.includes('active')) return 'active';

  // Check for trialing
  if (subscriptionStatuses.includes('trialing')) return 'trialing';

  // Check for waived (count as active)
  if (subscriptionStatuses.includes('waived')) return 'active';

  // All canceled or none
  return 'inactive';
}

/**
 * GET /api/admin/organizations
 * Returns paginated list of organizations with filters
 *
 * Query params:
 * - search: Search by org name or owner email
 * - status: Filter by derived status
 * - tier: Filter by subscription tier
 * - has_past_due: Filter to only show orgs with past_due subscriptions
 * - sort_by: Sort field (name, created_at, mrr, teams_count, last_activity)
 * - sort_order: asc or desc
 * - page: Page number (1-indexed)
 * - page_size: Items per page (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  // Verify admin access
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  // Use the service client to bypass RLS for admin queries
  const supabase = auth.serviceClient;
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') as OrganizationDerivedStatus | null;
  const tierFilter = searchParams.get('tier') as SubscriptionTier | null;
  const hasPastDue = searchParams.get('has_past_due') === 'true';
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20')));

  try {
    // Get tier configs for MRR calculation
    const tierConfigs = await getTierConfigs();

    // Fetch all organizations with owner info
    const { data: orgsData, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        status,
        created_at,
        owner_user_id
      `);

    if (orgsError) throw orgsError;

    // Fetch all teams with their subscriptions
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select(`
        id,
        organization_id,
        subscriptions (
          tier,
          status
        )
      `);

    if (teamsError) throw teamsError;

    // Fetch profiles for owner info and user counts
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, organization_id, last_active_at');

    if (profilesError) throw profilesError;

    // Build lookup maps
    const profilesById = new Map(profilesData?.map(p => [p.id, p]) || []);
    const teamsByOrg = new Map<string, typeof teamsData>();

    teamsData?.forEach(team => {
      if (team.organization_id) {
        const existing = teamsByOrg.get(team.organization_id) || [];
        existing.push(team);
        teamsByOrg.set(team.organization_id, existing);
      }
    });

    // Count users by organization
    const usersByOrg = new Map<string, number>();
    profilesData?.forEach(profile => {
      if (profile.organization_id) {
        usersByOrg.set(
          profile.organization_id,
          (usersByOrg.get(profile.organization_id) || 0) + 1
        );
      }
    });

    // Get last activity by organization (from profiles)
    const lastActivityByOrg = new Map<string, string>();
    profilesData?.forEach(profile => {
      if (profile.organization_id && profile.last_active_at) {
        const existing = lastActivityByOrg.get(profile.organization_id);
        if (!existing || profile.last_active_at > existing) {
          lastActivityByOrg.set(profile.organization_id, profile.last_active_at);
        }
      }
    });

    // Transform organizations to list items
    let organizations: OrganizationListItem[] = (orgsData || []).map(org => {
      const owner = profilesById.get(org.owner_user_id);
      const teams = teamsByOrg.get(org.id) || [];

      // Get subscription statuses for this org
      const subscriptionStatuses: SubscriptionStatus[] = [];
      const tiers: SubscriptionTier[] = [];

      teams.forEach(team => {
        const sub = team.subscriptions;
        if (Array.isArray(sub) && sub.length > 0) {
          subscriptionStatuses.push(sub[0].status);
          tiers.push(sub[0].tier);
        }
      });

      // Calculate MRR
      let mrr = 0;
      tiers.forEach((tier, index) => {
        const status = subscriptionStatuses[index];
        if (status === 'active' || status === 'waived') {
          const tierConfig = tierConfigs?.[tier];
          if (tierConfig) {
            mrr += tierConfig.price_monthly * 100; // Convert to cents
          }
        }
      });

      return {
        id: org.id,
        name: org.name,
        owner_email: owner?.email || 'Unknown',
        owner_name: owner?.full_name || null,
        derived_status: deriveOrganizationStatus(org.status, subscriptionStatuses),
        teams_count: teams.length,
        users_count: usersByOrg.get(org.id) || 0,
        mrr_cents: mrr,
        created_at: org.created_at,
        last_activity_at: lastActivityByOrg.get(org.id) || null,
        // Store tiers for filtering
        _tiers: tiers,
        _hasPastDue: subscriptionStatuses.includes('past_due')
      } as OrganizationListItem & { _tiers: SubscriptionTier[]; _hasPastDue: boolean };
    });

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      organizations = organizations.filter(org =>
        org.name.toLowerCase().includes(searchLower) ||
        org.owner_email.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter) {
      organizations = organizations.filter(org => org.derived_status === statusFilter);
    }

    if (tierFilter) {
      organizations = organizations.filter(org =>
        (org as unknown as { _tiers: SubscriptionTier[] })._tiers.includes(tierFilter)
      );
    }

    if (hasPastDue) {
      organizations = organizations.filter(org =>
        (org as unknown as { _hasPastDue: boolean })._hasPastDue
      );
    }

    // Remove internal fields before sorting
    organizations = organizations.map(org => {
      const { ...rest } = org;
      delete (rest as Record<string, unknown>)['_tiers'];
      delete (rest as Record<string, unknown>)['_hasPastDue'];
      return rest;
    });

    // Apply sorting
    organizations.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'mrr':
          aVal = a.mrr_cents;
          bVal = b.mrr_cents;
          break;
        case 'teams_count':
          aVal = a.teams_count;
          bVal = b.teams_count;
          break;
        case 'last_activity':
          aVal = a.last_activity_at || '';
          bVal = b.last_activity_at || '';
          break;
        case 'created_at':
        default:
          aVal = a.created_at;
          bVal = b.created_at;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Calculate pagination
    const total = organizations.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // Slice for pagination
    const paginatedOrgs = organizations.slice(offset, offset + pageSize);

    const response: OrganizationListResponse = {
      organizations: paginatedOrgs,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
