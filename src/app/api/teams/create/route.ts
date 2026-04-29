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
import {
  SCHEME_TEMPLATES,
  defaultSchemeKey,
  ageGroupFromLevel,
  type SchemeUnit,
} from '@/config/footballPositions';

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

    // -------------------------------------------------------------------------
    // 6. Auto-create default schemes (offense, defense, special teams)
    //    Best-effort: failures here are logged but don't block team creation.
    //    A coach can recreate defaults later from the schemes UI.
    // -------------------------------------------------------------------------

    try {
      const ageGroup = ageGroupFromLevel(team.level);

      // Fetch the 12 position categories once so we can map slot.category → UUID
      const { data: categories } = await supabase
        .from('position_categories')
        .select('id, code')
        .eq('sport', 'football');

      const categoryByCode = new Map(
        (categories ?? []).map((c) => [c.code as string, c.id as string]),
      );

      const units: SchemeUnit[] = ['offense', 'defense', 'special_teams'];
      for (const unit of units) {
        const templateKey = defaultSchemeKey(unit, ageGroup);
        const template = SCHEME_TEMPLATES.find((t) => t.key === templateKey);
        if (!template) continue;

        const { data: scheme, error: schemeErr } = await supabase
          .from('team_schemes')
          .insert({
            team_id: team.id,
            sport: 'football',
            template_key: template.key,
            name: template.name,
            unit,
            is_default: true,
            is_active: true,
            sort_order: 0,
          })
          .select('id')
          .single();

        if (schemeErr || !scheme) {
          console.error(`[teams/create] Default ${unit} scheme failed:`, schemeErr);
          continue;
        }

        const slotRows = template.slots
          .map((slot, idx) => {
            const categoryId = categoryByCode.get(slot.category);
            if (!categoryId) return null;
            return {
              scheme_id: scheme.id,
              position_category_id: categoryId,
              slot_code: slot.slotCode,
              display_label: slot.label,
              diagram_x: slot.diagramX ?? null,
              diagram_y: slot.diagramY ?? null,
              sort_order: idx,
              is_optional: slot.optional ?? false,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (slotRows.length > 0) {
          const { error: posErr } = await supabase
            .from('scheme_positions')
            .insert(slotRows);
          if (posErr) {
            console.error(`[teams/create] Default ${unit} positions failed:`, posErr);
          }
        }
      }
    } catch (err) {
      console.error('[teams/create] Default scheme creation failed:', err);
      // Non-blocking — team is created, schemes can be added later
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
