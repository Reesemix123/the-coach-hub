/**
 * API: /api/communication/announcements/[id]/stats
 * GET - Get read receipt stats and details for an announcement
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const announcementId = params.id;

    // Get the announcement
    const { data: announcement, error: announcementError } = await supabase
      .from('announcements')
      .select('id, team_id, target_position_group')
      .eq('id', announcementId)
      .single();

    if (announcementError || !announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    // Verify user is a coach/owner for this team
    const { data: team } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', announcement.team_id)
      .single();

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', announcement.team_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team?.user_id === user.id;
    if (!isOwner && !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all targeted parents (respects position group)
    let targetedParentIds: string[] = [];

    if (announcement.target_position_group) {
      // Get parents of players in the target position group
      const { data: playerLinks } = await supabase
        .from('player_parent_links')
        .select(`
          parent_id,
          players!inner (
            team_id,
            position_group
          )
        `)
        .eq('players.team_id', announcement.team_id)
        .eq('players.position_group', announcement.target_position_group);

      const matchingParentIds = new Set((playerLinks || []).map(l => l.parent_id));

      const { data: accessRecords } = await supabase
        .from('team_parent_access')
        .select('parent_id')
        .eq('team_id', announcement.team_id)
        .eq('status', 'active')
        .in('parent_id', Array.from(matchingParentIds));

      targetedParentIds = (accessRecords || []).map(r => r.parent_id);
    } else {
      const { data: accessRecords } = await supabase
        .from('team_parent_access')
        .select('parent_id')
        .eq('team_id', announcement.team_id)
        .eq('status', 'active');

      targetedParentIds = (accessRecords || []).map(r => r.parent_id);
    }

    if (targetedParentIds.length === 0) {
      return NextResponse.json({
        total_recipients: 0,
        read_count: 0,
        unread_count: 0,
        read_receipts: [],
        unread_parents: [],
      });
    }

    // Get parent profiles
    const { data: parentProfiles } = await supabase
      .from('parent_profiles')
      .select('id, first_name, last_name, email')
      .in('id', targetedParentIds);

    // Get read receipts
    const { data: readRecords } = await supabase
      .from('announcement_reads')
      .select('parent_id, read_at')
      .eq('announcement_id', announcementId)
      .in('parent_id', targetedParentIds)
      .order('read_at', { ascending: false });

    const readParentIds = new Set((readRecords || []).map(r => r.parent_id));
    const readMap = new Map((readRecords || []).map(r => [r.parent_id, r.read_at]));

    // Build read receipts list
    const readReceipts = (parentProfiles || [])
      .filter(p => readParentIds.has(p.id))
      .map(p => ({
        parent_id: p.id,
        parent_name: `${p.first_name} ${p.last_name}`,
        email: p.email,
        read_at: readMap.get(p.id),
      }))
      .sort((a, b) => {
        const aTime = a.read_at ? new Date(a.read_at).getTime() : 0;
        const bTime = b.read_at ? new Date(b.read_at).getTime() : 0;
        return bTime - aTime;
      });

    // Build unread parents list
    const unreadParents = (parentProfiles || [])
      .filter(p => !readParentIds.has(p.id))
      .map(p => ({
        parent_id: p.id,
        parent_name: `${p.first_name} ${p.last_name}`,
        email: p.email,
      }));

    return NextResponse.json({
      total_recipients: targetedParentIds.length,
      read_count: readReceipts.length,
      unread_count: unreadParents.length,
      read_receipts: readReceipts,
      unread_parents: unreadParents,
    });
  } catch (error) {
    console.error('Error fetching announcement stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
