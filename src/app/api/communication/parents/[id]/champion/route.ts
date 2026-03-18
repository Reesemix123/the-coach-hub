/**
 * API: /api/communication/parents/[id]/champion
 * PATCH - Toggle parent champion status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isChampion, teamId } = body;

    if (typeof isChampion !== 'boolean' || !teamId) {
      return NextResponse.json(
        { error: 'isChampion (boolean) and teamId are required' },
        { status: 400 }
      );
    }

    // Verify caller is team owner, coach, or team_admin
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
    const isStaff = ['owner', 'coach', 'team_admin'].includes(membership?.role || '');

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Verify parent has access to this team
    const { data: access } = await supabase
      .from('team_parent_access')
      .select('id')
      .eq('team_id', teamId)
      .eq('parent_id', parentId)
      .eq('status', 'active')
      .single();

    if (!access) {
      return NextResponse.json({ error: 'Parent not found on this team' }, { status: 404 });
    }

    // Update champion status
    const { data: updated, error: updateError } = await supabase
      .from('parent_profiles')
      .update({ is_champion: isChampion, updated_at: new Date().toISOString() })
      .eq('id', parentId)
      .select()
      .single();

    if (updateError) {
      console.error('Champion update error:', updateError);
      return NextResponse.json({ error: 'Failed to update champion status' }, { status: 500 });
    }

    return NextResponse.json({ parent: updated });
  } catch (error) {
    console.error('Error updating champion status:', error);
    return NextResponse.json(
      { error: 'Failed to update champion status' },
      { status: 500 }
    );
  }
}
