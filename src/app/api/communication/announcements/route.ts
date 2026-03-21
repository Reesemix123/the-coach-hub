/**
 * API: /api/communication/announcements
 * POST - Create announcement and send notifications
 * GET - List team announcements
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
  sendBulkNotification,
  getCommHubEmailTemplate,
  formatSmsBody,
  type BulkRecipient,
} from '@/lib/services/communication/notification.service';
import type {
  AnnouncementPriority,
  NotificationChannel,
  PositionGroup,
} from '@/types/communication';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      teamId,
      title,
      body: announcementBody,
      priority,
      notificationChannel,
      targetPositionGroup,
    } = body;

    // Validate required fields
    if (!teamId || !title || !announcementBody || !priority || !notificationChannel) {
      return NextResponse.json(
        { error: 'teamId, title, body, priority, and notificationChannel are required' },
        { status: 400 }
      );
    }

    // Verify user has permission (owner, coach, or team_admin)
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
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
    const canCreateAnnouncement = isOwner || ['owner', 'coach', 'team_admin'].includes(membership?.role || '');

    if (!canCreateAnnouncement) {
      return NextResponse.json(
        { error: 'Not authorized to create announcements' },
        { status: 403 }
      );
    }

    // Create the announcement
    const { data: announcement, error: insertError } = await supabase
      .from('announcements')
      .insert({
        team_id: teamId,
        sender_id: user.id,
        sender_role: isOwner ? 'owner' : membership?.role || 'coach',
        title,
        body: announcementBody,
        priority: priority as AnnouncementPriority,
        notification_channel: notificationChannel as NotificationChannel,
        target_position_group: targetPositionGroup || null,
        attachments: [],
        shared_video_id: null,
      })
      .select()
      .single();

    if (insertError || !announcement) {
      console.error('Failed to create announcement:', insertError);
      return NextResponse.json(
        { error: 'Failed to create announcement' },
        { status: 500 }
      );
    }

    // Get targeted parents based on position group
    const serviceClient = createServiceClient();
    let parentsQuery = serviceClient
      .from('team_parent_access')
      .select(`
        parent_id,
        parent_profiles!inner (
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          notification_preference
        )
      `)
      .eq('team_id', teamId)
      .eq('status', 'active');

    // If position group is specified, filter by players in that group
    if (targetPositionGroup) {
      const { data: playerLinks } = await serviceClient
        .from('player_parent_links')
        .select(`
          parent_id,
          players!inner (
            id,
            position_group
          )
        `)
        .eq('players.team_id', teamId)
        .eq('players.position_group', targetPositionGroup);

      if (playerLinks && playerLinks.length > 0) {
        const parentIds = [...new Set(playerLinks.map(link => link.parent_id))];
        parentsQuery = parentsQuery.in('parent_id', parentIds);
      } else {
        // No parents match this position group
        return NextResponse.json({
          announcement,
          notification_summary: { sent: 0, failed: 0 },
        });
      }
    }

    const { data: parentAccessRecords, error: parentsError } = await parentsQuery;

    if (parentsError) {
      console.error('Failed to fetch parents:', parentsError);
      return NextResponse.json(
        { error: 'Failed to fetch parent recipients' },
        { status: 500 }
      );
    }

    // Build recipient list
    const recipients: BulkRecipient[] = (parentAccessRecords || []).map((record: any) => ({
      id: record.parent_profiles.id,
      type: 'parent' as const,
      email: record.parent_profiles.email,
      phone: record.parent_profiles.phone || undefined,
      notificationPreference: record.parent_profiles.notification_preference,
    }));

    // Send notifications if there are recipients
    let notificationSummary = { sent: 0, failed: 0 };

    if (recipients.length > 0) {
      const emailBody = getCommHubEmailTemplate({
        title,
        body: `<p style="white-space: pre-wrap;">${announcementBody}</p>`,
        teamName: team.name,
      });

      const smsBody = formatSmsBody(team.name, `${title}\n\n${announcementBody}`);

      const result = await sendBulkNotification({
        teamId,
        recipients,
        notificationType: 'announcement',
        subject: `${team.name}: ${title}`,
        body: emailBody,
        smsBody,
        channel: notificationChannel as NotificationChannel,
        priority: priority as AnnouncementPriority,
      });

      notificationSummary = { sent: result.sent, failed: result.failed };
    }

    return NextResponse.json(
      {
        announcement,
        notification_summary: notificationSummary,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const priorityParam = searchParams.get('priority');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Check if user is a parent (maybeSingle since coaches won't have a parent profile)
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const isParent = !!parentProfile;

    // Verify user has access to this team
    const serviceClient = createServiceClient();
    if (isParent) {
      // Verify parent has access to this team (use service client to avoid RLS recursion)
      const { data: parentAccess } = await serviceClient
        .from('team_parent_access')
        .select('id')
        .eq('team_id', teamId)
        .eq('parent_id', parentProfile.id)
        .eq('status', 'active')
        .single();

      if (!parentAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      // Verify coach/staff has access
      const { data: team } = await supabase
        .from('teams')
        .select('user_id')
        .eq('id', teamId)
        .single();

      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const isOwner = team?.user_id === user.id;
      const hasAccess = isOwner || !!membership;

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Build the query
    let query = supabase
      .from('announcements')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (priorityParam) {
      query = query.eq('priority', priorityParam);
    }

    if (limitParam) {
      query = query.limit(parseInt(limitParam, 10));
    }

    if (offsetParam) {
      query = query.range(
        parseInt(offsetParam, 10),
        parseInt(offsetParam, 10) + parseInt(limitParam || '50', 10) - 1
      );
    }

    let { data: announcements, error: announcementsError } = await query;

    if (announcementsError) {
      console.error('Failed to fetch announcements:', announcementsError);
      return NextResponse.json(
        { error: 'Failed to fetch announcements' },
        { status: 500 }
      );
    }

    // For parents, filter out announcements targeting position groups their children don't belong to
    if (isParent && announcements && announcements.length > 0) {
      const targetedAnnouncements = announcements.filter(a => a.target_position_group !== null);

      if (targetedAnnouncements.length > 0) {
        // Get position groups of parent's children on this team
        const { data: childPositions } = await serviceClient
          .from('player_parent_links')
          .select(`
            player_id,
            players!inner (
              position_group,
              team_id
            )
          `)
          .eq('parent_id', parentProfile!.id)
          .eq('players.team_id', teamId);

        const parentPositionGroups = new Set<string>();
        (childPositions || []).forEach((link: any) => {
          if (link.players?.position_group) {
            parentPositionGroups.add(link.players.position_group);
          }
        });

        // Filter: keep broadcasts (null target) + announcements matching parent's children's groups
        announcements = announcements.filter(a =>
          a.target_position_group === null ||
          parentPositionGroups.has(a.target_position_group)
        );
      }
    }

    // For parents, include read status
    if (isParent && announcements && announcements.length > 0) {
      const announcementIds = announcements.map(a => a.id);
      const { data: readRecords } = await supabase
        .from('announcement_reads')
        .select('announcement_id, read_at')
        .eq('parent_id', parentProfile.id)
        .in('announcement_id', announcementIds);

      const readMap = new Map(
        (readRecords || []).map(r => [r.announcement_id, r.read_at])
      );

      const announcementsWithReadStatus = announcements.map(announcement => ({
        ...announcement,
        is_read: readMap.has(announcement.id),
        read_at: readMap.get(announcement.id) || null,
      }));

      return NextResponse.json({ announcements: announcementsWithReadStatus });
    }

    // For coaches, return announcements as-is
    return NextResponse.json({ announcements: announcements || [] });
  } catch (error) {
    console.error('Error fetching announcements:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : 'no stack');
    return NextResponse.json(
      { error: 'Failed to fetch announcements', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
