/**
 * API: POST /api/parent/athletes/[athleteId]/link-roster
 * Links an athlete profile to a roster player via 6-character join code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ athleteId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { athleteId } = await context.params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify parent owns this athlete
    const serviceClient = createServiceClient();
    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parent) return NextResponse.json({ error: 'Parent profile required' }, { status: 403 });

    const { data: athlete } = await serviceClient
      .from('athlete_profiles')
      .select('id')
      .eq('id', athleteId)
      .eq('created_by_parent_id', parent.id)
      .maybeSingle();

    if (!athlete) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    // Parse join code
    const body = await request.json() as { joinCode?: string };
    const code = body.joinCode?.trim().toUpperCase();

    if (!code || code.length < 4 || code.length > 8) {
      return NextResponse.json({ error: 'Invalid join code format' }, { status: 400 });
    }

    // Find player by join code (case-insensitive)
    const { data: player } = await serviceClient
      .from('players')
      .select('id, first_name, last_name, jersey_number, primary_position, team_id')
      .eq('join_code', code)
      .maybeSingle();

    if (!player) {
      return NextResponse.json(
        { error: 'Code not found. Check with your coach.' },
        { status: 404 }
      );
    }

    // Get team info
    const { data: team } = await serviceClient
      .from('teams')
      .select('id, name, sport')
      .eq('id', player.team_id)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Derive season year: if before August use current year, else current year (fall season)
    const now = new Date();
    const seasonYear = now.getFullYear();

    // Check for existing athlete_seasons entry
    const { data: existingSeason } = await serviceClient
      .from('athlete_seasons')
      .select('id')
      .eq('athlete_profile_id', athleteId)
      .eq('team_id', team.id)
      .eq('season_year', seasonYear)
      .eq('sport', team.sport ?? 'football')
      .maybeSingle();

    if (existingSeason) {
      return NextResponse.json(
        { error: 'Already linked to this team for this season' },
        { status: 409 }
      );
    }

    // Create athlete_seasons row
    const { data: season, error: seasonError } = await serviceClient
      .from('athlete_seasons')
      .insert({
        athlete_profile_id: athleteId,
        team_id: team.id,
        roster_id: player.id,
        sport: team.sport ?? 'football',
        season_year: seasonYear,
        position: player.primary_position,
        jersey_number: player.jersey_number,
      })
      .select('id')
      .single();

    if (seasonError) {
      console.error('[link-roster] Insert failed:', seasonError);
      return NextResponse.json({ error: 'Failed to link to team' }, { status: 500 });
    }

    // Also create player_parent_links if not already linked
    const { data: existingLink } = await serviceClient
      .from('player_parent_links')
      .select('id')
      .eq('player_id', player.id)
      .eq('parent_id', parent.id)
      .maybeSingle();

    if (!existingLink) {
      await serviceClient.from('player_parent_links').insert({
        player_id: player.id,
        parent_id: parent.id,
        relationship: 'parent',
        is_primary_contact: false,
      });
    }

    // Grant team_parent_access if not already granted
    const { data: existingAccess } = await serviceClient
      .from('team_parent_access')
      .select('id')
      .eq('team_id', team.id)
      .eq('parent_id', parent.id)
      .maybeSingle();

    if (!existingAccess) {
      await serviceClient.from('team_parent_access').insert({
        team_id: team.id,
        parent_id: parent.id,
        access_level: 'full',
        status: 'active',
      });
    }

    return NextResponse.json({
      athleteSeasonId: season.id,
      teamName: team.name,
      playerName: `${player.first_name} ${player.last_name}`,
    });
  } catch (error) {
    console.error('[link-roster] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
