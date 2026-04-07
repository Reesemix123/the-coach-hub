/**
 * API: POST /api/teams/create
 * Server-side team creation with per-user team limit enforcement.
 *
 * Determines the user's "effective tier" by finding their highest active
 * paid subscription, then compares their current team count against
 * max_teams from tier_config.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Tier priority for determining effective tier (highest wins)
const TIER_PRIORITY: Record<string, number> = {
  basic: 0,
  plus: 1,
  premium: 2,
};

interface CreateTeamBody {
  name: string;
  sport?: string;
  level?: string;
  colors?: Record<string, string>;
  default_tier?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateTeamBody = await request.json();
    const { name, sport, level, colors, default_tier } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // 1. Count all teams currently owned by this user
    // -------------------------------------------------------------------------

    const { count: teamCount, error: countError } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Failed to count user teams:', countError);
      return NextResponse.json({ error: 'Failed to check team count' }, { status: 500 });
    }

    const currentCount = teamCount ?? 0;

    // -------------------------------------------------------------------------
    // 2. Determine the user's effective tier
    //
    //    Find their highest active paid subscription across all their teams.
    //    Query: subscriptions WHERE team_id IN (user's teams)
    //           AND status = 'active' AND billing_waived = false
    //    Order by tier priority (premium > plus > basic), take highest.
    //    If none found, default to 'basic'.
    // -------------------------------------------------------------------------

    // Get all team IDs owned by this user
    const { data: userTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', user.id);

    const userTeamIds = (userTeams ?? []).map(t => t.id);

    let effectiveTier = 'basic';

    if (userTeamIds.length > 0) {
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('tier')
        .in('team_id', userTeamIds)
        .eq('status', 'active')
        .eq('billing_waived', false);

      if (subscriptions && subscriptions.length > 0) {
        // Find the highest priority tier
        let highestPriority = -1;
        for (const sub of subscriptions) {
          const priority = TIER_PRIORITY[sub.tier] ?? 0;
          if (priority > highestPriority) {
            highestPriority = priority;
            effectiveTier = sub.tier;
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. Look up max_teams for the effective tier from tier_config
    // -------------------------------------------------------------------------

    const { data: tierConfig } = await supabase
      .from('tier_config')
      .select('max_teams')
      .eq('tier_key', effectiveTier)
      .single();

    // Fallback: if tier_config doesn't have max_teams yet (pre-migration), default to 1
    const maxTeams = tierConfig?.max_teams ?? 1;

    // -------------------------------------------------------------------------
    // 4. Enforce the limit
    // -------------------------------------------------------------------------

    if (currentCount >= maxTeams) {
      const tierDisplayNames: Record<string, string> = {
        basic: 'Basic',
        plus: 'Plus',
        premium: 'Premium',
      };

      return NextResponse.json(
        {
          error: 'Team limit reached for your current plan',
          code: 'TEAM_LIMIT_REACHED',
          current_count: currentCount,
          max_teams: maxTeams,
          current_tier: effectiveTier,
          tier_display_name: tierDisplayNames[effectiveTier] ?? effectiveTier,
          upgrade_required: true,
        },
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------------
    // 5. Create the team
    //    The DB trigger (trigger_auto_init_team_subscription) will
    //    auto-create the subscription + token_balance rows.
    // -------------------------------------------------------------------------

    const { data: team, error: insertError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        sport: sport || 'football',
        level: level?.trim() || 'High School',
        colors: colors || { primary: 'Blue', secondary: 'White' },
        user_id: user.id,
        default_tier: default_tier || 'basic',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create team:', insertError);
      return NextResponse.json(
        { error: 'Failed to create team: ' + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}
