// /api/admin/costs/by-organization - Costs by Organization API
// Returns AI costs and margins broken down by organization
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getTierConfigs } from '@/lib/admin/config';
import { SubscriptionTier } from '@/types/admin';

// Cost per AI credit
const COST_PER_AI_CREDIT = 0.02; // $0.02 per credit

interface OrganizationCost {
  id: string;
  name: string;
  ai_credits_used: number;
  ai_cost: number;
  revenue: number;
  margin: number;
  margin_percentage: number;
}

interface CostsByOrganizationResponse {
  organizations: OrganizationCost[];
}

/**
 * GET /api/admin/costs/by-organization
 * Returns costs and margins for each organization
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = auth.serviceClient;

  try {
    // Get tier config from database (single source of truth)
    const tierConfigs = await getTierConfigs();
    if (!tierConfigs) {
      return NextResponse.json(
        { error: 'Tier configuration not found' },
        { status: 500 }
      );
    }

    // Build tier prices from database config (price_monthly is in dollars, convert to cents)
    const tierPrices: Record<string, number> = {};
    for (const [tierId, config] of Object.entries(tierConfigs)) {
      tierPrices[tierId] = (config.price_monthly || 0) * 100;
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Get all organizations
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('status', 'active');

    if (orgError) throw orgError;

    // Get teams by organization
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('id, organization_id');

    if (teamError) throw teamError;

    // Get subscriptions for teams
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('team_id, tier, status, billing_waived')
      .in('status', ['active', 'trialing']);

    if (subError) throw subError;

    // Get AI usage this month grouped by team
    const { data: aiUsage, error: usageError } = await supabase
      .from('ai_usage_logs')
      .select('team_id, credits_used')
      .gte('created_at', monthStart.toISOString());

    if (usageError) throw usageError;

    // Build team -> organization mapping
    const teamToOrg: Record<string, string> = {};
    for (const team of teams || []) {
      if (team.organization_id) {
        teamToOrg[team.id] = team.organization_id;
      }
    }

    // Calculate AI usage per organization
    const orgAiCredits: Record<string, number> = {};
    for (const usage of aiUsage || []) {
      const orgId = teamToOrg[usage.team_id];
      if (orgId) {
        orgAiCredits[orgId] = (orgAiCredits[orgId] || 0) + (usage.credits_used || 0);
      }
    }

    // Calculate revenue per organization (from team subscriptions)
    const orgRevenue: Record<string, number> = {};
    for (const sub of subscriptions || []) {
      if (sub.billing_waived) continue;
      const orgId = teamToOrg[sub.team_id];
      if (orgId) {
        const tierPrice = tierPrices[sub.tier as SubscriptionTier] || 0;
        orgRevenue[orgId] = (orgRevenue[orgId] || 0) + tierPrice;
      }
    }

    // Build results
    const results: OrganizationCost[] = [];
    for (const org of organizations || []) {
      const aiCreditsUsed = orgAiCredits[org.id] || 0;
      const aiCost = aiCreditsUsed * COST_PER_AI_CREDIT;
      const revenue = Math.round((orgRevenue[org.id] || 0) / 100); // Convert cents to dollars
      const margin = revenue - aiCost;
      const marginPercentage = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

      results.push({
        id: org.id,
        name: org.name,
        ai_credits_used: aiCreditsUsed,
        ai_cost: Math.round(aiCost * 100) / 100,
        revenue,
        margin: Math.round(margin * 100) / 100,
        margin_percentage: marginPercentage
      });
    }

    // Sort by AI cost descending (top users first)
    results.sort((a, b) => b.ai_cost - a.ai_cost);

    const response: CostsByOrganizationResponse = {
      organizations: results
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching costs by organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs by organization' },
      { status: 500 }
    );
  }
}
