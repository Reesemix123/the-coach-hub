// /api/teams/[teamId]/addons - Manage team add-ons
// GET: Get current add-ons and pricing
// POST: Update add-ons (owners only)

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAddonPricing,
  getTeamAddons,
  getEffectiveLimits,
  calculateTotalAddonCost,
  updateTeamAddons
} from '@/lib/services/addon-pricing.service';

interface RouteContext {
  params: Promise<{ teamId: string }>;
}

// GET: Get current add-ons and pricing info
export async function GET(request: NextRequest, context: RouteContext) {
  const { teamId } = await context.params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check team access
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Check if user has access to team
  const isOwner = team.user_id === user.id;

  const { data: membership } = await supabase
    .from('team_memberships')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single();

  if (!isOwner && !membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    // Get pricing config
    const pricing = await getAddonPricing();

    // Get current add-ons
    const addons = await getTeamAddons(teamId);

    // Get effective limits
    const limits = await getEffectiveLimits(teamId);

    // Get subscription tier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('team_id', teamId)
      .single();

    return NextResponse.json({
      pricing,
      addons,
      limits,
      tier: subscription?.tier || 'basic',
      isOwner
    });
  } catch (error) {
    console.error('Error fetching add-ons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch add-ons' },
      { status: 500 }
    );
  }
}

// POST: Update add-ons (owners only)
export async function POST(request: NextRequest, context: RouteContext) {
  const { teamId } = await context.params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check team ownership (only owners can purchase add-ons)
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  if (team.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Only team owners can manage add-ons' },
      { status: 403 }
    );
  }

  // Parse request body
  let body: {
    additional_coaches?: number;
    additional_ai_credits?: number;
    additional_storage_gb?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    additional_coaches = 0,
    additional_ai_credits = 0,
    additional_storage_gb = 0
  } = body;

  // Validate values
  if (additional_coaches < 0 || additional_ai_credits < 0 || additional_storage_gb < 0) {
    return NextResponse.json(
      { error: 'Add-on quantities cannot be negative' },
      { status: 400 }
    );
  }

  try {
    // Calculate new costs
    const cost = await calculateTotalAddonCost(
      additional_coaches,
      additional_ai_credits,
      additional_storage_gb
    );

    // Update add-ons in database
    const result = await updateTeamAddons(
      teamId,
      additional_coaches,
      additional_ai_credits,
      additional_storage_gb
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update add-ons' },
        { status: 500 }
      );
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'team.addons_updated',
      target_type: 'team',
      target_id: teamId,
      target_name: team.name,
      metadata: {
        additional_coaches,
        additional_ai_credits,
        additional_storage_gb,
        monthly_cost_cents: cost.totalMonthly
      }
    });

    // Get updated limits
    const limits = await getEffectiveLimits(teamId);

    return NextResponse.json({
      success: true,
      addons: result.addons,
      cost,
      limits
    });
  } catch (error) {
    console.error('Error updating add-ons:', error);
    return NextResponse.json(
      { error: 'Failed to update add-ons' },
      { status: 500 }
    );
  }
}
