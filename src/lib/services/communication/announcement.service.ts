/**
 * Announcement Service
 * Handles announcement creation, delivery, read tracking, and targeting
 */

import { createClient } from '@/utils/supabase/server';
import type {
  Announcement,
  AnnouncementRead,
  AnnouncementPriority,
  AnnouncementWithReadStatus,
  PositionGroup,
  NotificationChannel,
} from '@/types/communication';

// ======================
// ANNOUNCEMENT CREATION
// ======================

export interface CreateAnnouncementInput {
  teamId: string;
  senderId: string;
  senderRole: 'owner' | 'coach' | 'team_admin';
  title: string;
  body: string;
  priority: AnnouncementPriority;
  notificationChannel: NotificationChannel;
  targetPositionGroup?: PositionGroup | null;
  attachments?: Array<{ name: string; url: string; type: string }>;
  sharedVideoId?: string | null;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      team_id: input.teamId,
      sender_id: input.senderId,
      sender_role: input.senderRole,
      title: input.title.trim(),
      body: input.body.trim(),
      priority: input.priority,
      notification_channel: input.notificationChannel,
      target_position_group: input.targetPositionGroup || null,
      attachments: input.attachments || [],
      shared_video_id: input.sharedVideoId || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create announcement: ${error.message}`);
  }

  return data;
}

// ======================
// ANNOUNCEMENT RETRIEVAL
// ======================

export interface GetAnnouncementsOptions {
  limit?: number;
  offset?: number;
  priority?: AnnouncementPriority;
  positionGroup?: PositionGroup;
}

export async function getTeamAnnouncements(
  teamId: string,
  options: GetAnnouncementsOptions = {}
): Promise<Announcement[]> {
  const supabase = await createClient();

  let query = supabase
    .from('announcements')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (options.priority) {
    query = query.eq('priority', options.priority);
  }

  if (options.positionGroup) {
    query = query.eq('target_position_group', options.positionGroup);
  }

  // Apply pagination
  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch announcements: ${error.message}`);
  }

  return data || [];
}

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch announcement: ${error.message}`);
  }

  return data;
}

// ======================
// PARENT-FACING VIEWS
// ======================

/**
 * Get announcements for a parent, filtered by position group and with read status
 * Only shows announcements that:
 * 1. Have no target_position_group (broadcast to all), OR
 * 2. Target a position group that one of the parent's children plays
 */
export async function getAnnouncementsForParent(
  teamId: string,
  parentId: string
): Promise<AnnouncementWithReadStatus[]> {
  const supabase = await createClient();

  // First, get the parent's children's position groups
  const { data: childPositions, error: childError } = await supabase
    .from('player_parent_links')
    .select(`
      player_id,
      players!inner (
        position_group,
        team_id
      )
    `)
    .eq('parent_id', parentId)
    .eq('players.team_id', teamId);

  if (childError) {
    throw new Error(`Failed to fetch parent's children: ${childError.message}`);
  }

  // Extract unique position groups
  const positionGroups = new Set<PositionGroup>();
  (childPositions || []).forEach(link => {
    const player = link.players as unknown as { position_group: PositionGroup | null };
    if (player?.position_group) {
      positionGroups.add(player.position_group);
    }
  });

  // Get all announcements (broadcast + targeted to parent's position groups)
  const { data: announcements, error: announcementsError } = await supabase
    .from('announcements')
    .select('*')
    .eq('team_id', teamId)
    .or(`target_position_group.is.null,target_position_group.in.(${Array.from(positionGroups).join(',')})`)
    .order('created_at', { ascending: false });

  if (announcementsError) {
    throw new Error(`Failed to fetch announcements: ${announcementsError.message}`);
  }

  if (!announcements || announcements.length === 0) {
    return [];
  }

  // Get read status for these announcements
  const announcementIds = announcements.map(a => a.id);
  const { data: readRecords, error: readError } = await supabase
    .from('announcement_reads')
    .select('announcement_id, read_at')
    .eq('parent_id', parentId)
    .in('announcement_id', announcementIds);

  if (readError) {
    throw new Error(`Failed to fetch read status: ${readError.message}`);
  }

  // Create a map of announcement_id -> read_at
  const readMap = new Map<string, string>();
  (readRecords || []).forEach(record => {
    readMap.set(record.announcement_id, record.read_at);
  });

  // Combine announcements with read status
  return announcements.map(announcement => ({
    ...announcement,
    is_read: readMap.has(announcement.id),
    read_at: readMap.get(announcement.id) || null,
  }));
}

// ======================
// READ TRACKING
// ======================

/**
 * Mark an announcement as read by a parent
 * Uses upsert to prevent duplicate read entries
 */
export async function markAnnouncementRead(
  announcementId: string,
  parentId: string
): Promise<AnnouncementRead> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('announcement_reads')
    .upsert(
      {
        announcement_id: announcementId,
        parent_id: parentId,
      },
      {
        onConflict: 'announcement_id,parent_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark announcement as read: ${error.message}`);
  }

  return data;
}

// ======================
// READ RECEIPTS (COACH VIEW)
// ======================

export interface ReadReceipt {
  parentId: string;
  parentName: string;
  readAt: string;
}

/**
 * Get list of parents who have read an announcement
 * For coach dashboard to see engagement
 */
export async function getAnnouncementReadReceipts(announcementId: string): Promise<ReadReceipt[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('announcement_reads')
    .select(`
      parent_id,
      read_at,
      parent_profiles!inner (
        first_name,
        last_name
      )
    `)
    .eq('announcement_id', announcementId)
    .order('read_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch read receipts: ${error.message}`);
  }

  return (data || []).map(record => {
    const parent = record.parent_profiles as unknown as { first_name: string; last_name: string };
    return {
      parentId: record.parent_id,
      parentName: `${parent.first_name} ${parent.last_name}`,
      readAt: record.read_at,
    };
  });
}

// ======================
// READ STATISTICS
// ======================

export interface AnnouncementReadStats {
  totalParents: number;
  readCount: number;
  unreadCount: number;
}

/**
 * Get summary statistics for an announcement's read status
 * Used for coach dashboard analytics
 */
export async function getAnnouncementReadStats(
  announcementId: string,
  teamId: string
): Promise<AnnouncementReadStats> {
  const supabase = await createClient();

  // Get the announcement to check target position group
  const announcement = await getAnnouncementById(announcementId);
  if (!announcement) {
    throw new Error('Announcement not found');
  }

  // Get targeted parents (respects position group filtering)
  const targetedParents = await getTargetedParents(teamId, announcement.target_position_group);
  const totalParents = targetedParents.length;

  // Get read count
  const { count: readCount, error: countError } = await supabase
    .from('announcement_reads')
    .select('*', { count: 'exact', head: true })
    .eq('announcement_id', announcementId);

  if (countError) {
    throw new Error(`Failed to count reads: ${countError.message}`);
  }

  return {
    totalParents,
    readCount: readCount || 0,
    unreadCount: totalParents - (readCount || 0),
  };
}

// ======================
// PARENT TARGETING
// ======================

export interface TargetedParent {
  parentId: string;
  email: string;
  phone: string | null;
  notificationPreference: NotificationChannel;
}

/**
 * Get list of parents who should receive an announcement
 * Filters by position group if specified
 * Used by notification service to dispatch messages
 */
export async function getTargetedParents(
  teamId: string,
  positionGroup?: PositionGroup | null
): Promise<TargetedParent[]> {
  const supabase = await createClient();

  // If no position group, return all active parents
  if (!positionGroup) {
    const { data, error } = await supabase
      .from('team_parent_access')
      .select(`
        parent_id,
        parent_profiles!inner (
          id,
          email,
          phone,
          notification_preference
        )
      `)
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to fetch parents: ${error.message}`);
    }

    return (data || []).map(record => {
      const parent = record.parent_profiles as unknown as {
        id: string;
        email: string;
        phone: string | null;
        notification_preference: NotificationChannel;
      };
      return {
        parentId: parent.id,
        email: parent.email,
        phone: parent.phone,
        notificationPreference: parent.notification_preference,
      };
    });
  }

  // If position group specified, filter by children's positions
  const { data, error } = await supabase
    .from('team_parent_access')
    .select(`
      parent_id,
      parent_profiles!inner (
        id,
        email,
        phone,
        notification_preference
      )
    `)
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to fetch parents: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get parent IDs
  const parentIds = data.map(record => {
    const parent = record.parent_profiles as unknown as { id: string };
    return parent.id;
  });

  // Find parents whose children play the target position group
  const { data: playerLinks, error: linksError } = await supabase
    .from('player_parent_links')
    .select(`
      parent_id,
      players!inner (
        team_id,
        position_group
      )
    `)
    .in('parent_id', parentIds)
    .eq('players.team_id', teamId)
    .eq('players.position_group', positionGroup);

  if (linksError) {
    throw new Error(`Failed to fetch player links: ${linksError.message}`);
  }

  // Get unique parent IDs that match the position group
  const matchingParentIds = new Set((playerLinks || []).map(link => link.parent_id));

  // Filter original parents to only those with matching children
  return data
    .filter(record => {
      const parent = record.parent_profiles as unknown as { id: string };
      return matchingParentIds.has(parent.id);
    })
    .map(record => {
      const parent = record.parent_profiles as unknown as {
        id: string;
        email: string;
        phone: string | null;
        notification_preference: NotificationChannel;
      };
      return {
        parentId: parent.id,
        email: parent.email,
        phone: parent.phone,
        notificationPreference: parent.notification_preference,
      };
    });
}
