// /api/admin/costs/by-organization - Costs by Organization API
// Returns AI costs and margins broken down by organization
// Includes AI Film Tagging and AI Chat costs
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getAllTierConfigsFromTable } from '@/lib/admin/config';
import { AI_CHAT_COST } from '@/lib/admin/ai-costs';

// Use centralized cost constant
const COST_PER_TEXT_ACTION = AI_CHAT_COST.COST_PER_ACTION;

interface OrganizationCost {
  id: string;
  name: string;
  // AI Film Tagging
  plays_analyzed: number;
  film_tagging_cost: number;
  // AI Chat
  chat_actions: number;
  chat_cost: number;
  // Combined
  total_ai_cost: number;
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
    // Get tier config from tier_config TABLE (single source of truth)
    const tierConfigsArray = await getAllTierConfigsFromTable();
    if (!tierConfigsArray || tierConfigsArray.length === 0) {
      return NextResponse.json(
        { error: 'Tier configuration not found' },
        { status: 500 }
      );
    }

    // Build tier prices from database config
    // tier_config table uses price_monthly_cents (already in cents)
    const tierPrices: Record<string, number> = {};
    for (const config of tierConfigsArray) {
      tierPrices[config.tier_key] = config.price_monthly_cents || 0;
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

    // Build team -> organization mapping
    const teamToOrg: Record<string, string> = {};
    for (const team of teams || []) {
      if (team.organization_id) {
        teamToOrg[team.id] = team.organization_id;
      }
    }

    // ============================================
    // AI Film Tagging costs (from ai_tag_predictions)
    // ============================================
    const { data: filmTaggingData, error: filmError } = await supabase
      .from('ai_tag_predictions')
      .select('team_id, cost_usd')
      .gte('created_at', monthStart.toISOString())
      .eq('status', 'completed');

    if (filmError) throw filmError;

    // Calculate film tagging by organization
    const orgFilmCosts: Record<string, { plays: number; cost: number }> = {};
    for (const row of filmTaggingData || []) {
      const orgId = teamToOrg[row.team_id];
      if (orgId) {
        if (!orgFilmCosts[orgId]) {
          orgFilmCosts[orgId] = { plays: 0, cost: 0 };
        }
        orgFilmCosts[orgId].plays++;
        orgFilmCosts[orgId].cost += Number(row.cost_usd) || 0;
      }
    }

    // ============================================
    // AI Chat costs (from ai_usage table)
    // ============================================
    const { data: chatUsage, error: chatError } = await supabase
      .from('ai_usage')
      .select('team_id')
      .gte('created_at', monthStart.toISOString())
      .eq('usage_type', 'text_action');

    if (chatError) throw chatError;

    // Calculate chat costs by organization
    const orgChatCounts: Record<string, number> = {};
    for (const row of chatUsage || []) {
      const orgId = teamToOrg[row.team_id];
      if (orgId) {
        orgChatCounts[orgId] = (orgChatCounts[orgId] || 0) + 1;
      }
    }

    // Calculate revenue per organization (from team subscriptions)
    const orgRevenue: Record<string, number> = {};
    for (const sub of subscriptions || []) {
      if (sub.billing_waived) continue;
      const orgId = teamToOrg[sub.team_id];
      if (orgId) {
        const tierPrice = tierPrices[sub.tier] || 0;
        orgRevenue[orgId] = (orgRevenue[orgId] || 0) + tierPrice;
      }
    }

    // Build results
    const results: OrganizationCost[] = [];
    for (const org of organizations || []) {
      const filmData = orgFilmCosts[org.id] || { plays: 0, cost: 0 };
      const chatCount = orgChatCounts[org.id] || 0;
      const chatCost = chatCount * COST_PER_TEXT_ACTION;
      const totalAiCost = filmData.cost + chatCost;
      const revenue = Math.round((orgRevenue[org.id] || 0) / 100); // Convert cents to dollars
      const margin = revenue - totalAiCost;
      const marginPercentage = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

      results.push({
        id: org.id,
        name: org.name,
        plays_analyzed: filmData.plays,
        film_tagging_cost: Math.round(filmData.cost * 1000) / 1000,
        chat_actions: chatCount,
        chat_cost: Math.round(chatCost * 100) / 100,
        total_ai_cost: Math.round(totalAiCost * 100) / 100,
        revenue,
        margin: Math.round(margin * 100) / 100,
        margin_percentage: marginPercentage
      });
    }

    // Sort by AI cost descending (top users first)
    results.sort((a, b) => b.total_ai_cost - a.total_ai_cost);

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
