/**
 * API: /api/communication/parents
 * GET - List parents for a team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getTeamParents } from '@/lib/services/communication';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Verify user has access to this team
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const hasAccess = isOwner || membership?.role in ['owner', 'coach', 'team_admin'];

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const parents = await getTeamParents(teamId);

    return NextResponse.json({ parents });
  } catch (error) {
    console.error('Error fetching parents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parents' },
      { status: 500 }
    );
  }
}
