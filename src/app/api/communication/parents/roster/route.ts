/**
 * API: /api/communication/parents/roster
 * GET - Get parent roster (active parents + pending invitations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    // Verify user has access
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get active parents with their children
    const { data: parentAccess } = await supabase
      .from('team_parent_access')
      .select(`
        parent_id,
        access_level,
        status,
        joined_at,
        parent_profiles!inner (
          id,
          first_name,
          last_name,
          email,
          phone,
          notification_preference,
          is_champion,
          created_at
        )
      `)
      .eq('team_id', teamId)
      .eq('status', 'active');

    // Get player-parent links for this team's players
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name, jersey_number, position_group')
      .eq('team_id', teamId);

    const playerIds = (players || []).map(p => p.id);

    const { data: parentLinks } = await supabase
      .from('player_parent_links')
      .select('player_id, parent_id, relationship, is_primary_contact')
      .in('player_id', playerIds.length > 0 ? playerIds : ['00000000-0000-0000-0000-000000000000']);

    // Build parent roster with children
    const parents = (parentAccess || []).map((access: Record<string, unknown>) => {
      const profile = access.parent_profiles as Record<string, unknown>;
      const parentId = profile.id as string;

      const children = (parentLinks || [])
        .filter(link => link.parent_id === parentId)
        .map(link => {
          const player = (players || []).find(p => p.id === link.player_id);
          return {
            player_id: link.player_id,
            player_name: player ? `${player.first_name} ${player.last_name}` : 'Unknown',
            jersey_number: player?.jersey_number,
            position_group: player?.position_group,
            relationship: link.relationship,
            is_primary_contact: link.is_primary_contact,
          };
        });

      return {
        id: parentId,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        phone: profile.phone,
        notification_preference: profile.notification_preference,
        is_champion: profile.is_champion,
        access_level: access.access_level,
        joined_at: access.joined_at,
        children,
      };
    });

    // Get pending invitations
    const { data: invitations } = await supabase
      .from('parent_invitations')
      .select(`
        id,
        parent_email,
        parent_name,
        relationship,
        status,
        created_at,
        token_expires_at,
        auto_resend_sent,
        player_id
      `)
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Enrich invitations with player names
    const enrichedInvitations = (invitations || []).map(inv => {
      const player = (players || []).find(p => p.id === inv.player_id);
      return {
        ...inv,
        player_name: player ? `${player.first_name} ${player.last_name}` : 'Unknown',
      };
    });

    // Only include players who have an active parent that can be contacted
    const activeParentIds = new Set(parents.map((p: { id: string }) => p.id));
    const contactablePlayers = (players || []).filter(player =>
      (parentLinks || []).some(
        link => link.player_id === player.id && activeParentIds.has(link.parent_id)
      )
    );

    return NextResponse.json({
      parents,
      players: contactablePlayers,
      invitations: enrichedInvitations,
      total_parents: parents.length,
    });
  } catch (error) {
    console.error('Error fetching parent roster:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parent roster' },
      { status: 500 }
    );
  }
}
