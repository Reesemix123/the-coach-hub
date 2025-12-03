// /api/admin/moderation - Video Content Moderation API
// List, filter, and manage video uploads for content moderation

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

interface ModerationFilters {
  status?: 'pending' | 'approved' | 'flagged' | 'removed' | 'all';
  team_id?: string;
  date_from?: string;
  date_to?: string;
  min_file_size?: number;
  max_file_size?: number;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * GET /api/admin/moderation
 * List videos with moderation status and filtering
 */
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);

  const filters: ModerationFilters = {
    status: (searchParams.get('status') as ModerationFilters['status']) || 'all',
    team_id: searchParams.get('team_id') || undefined,
    date_from: searchParams.get('date_from') || undefined,
    date_to: searchParams.get('date_to') || undefined,
    min_file_size: searchParams.get('min_file_size') ? parseInt(searchParams.get('min_file_size')!) : undefined,
    max_file_size: searchParams.get('max_file_size') ? parseInt(searchParams.get('max_file_size')!) : undefined,
    search: searchParams.get('search') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100),
  };

  try {
    // Build query
    let query = auth.serviceClient
      .from('videos')
      .select(`
        id,
        name,
        file_path,
        url,
        file_size_bytes,
        mime_type,
        duration_seconds,
        moderation_status,
        created_at,
        uploaded_by,
        upload_ip,
        moderated_at,
        moderated_by,
        moderation_notes,
        flagged_reason,
        game_id,
        games!inner (
          id,
          name,
          team_id,
          teams!inner (
            id,
            name
          )
        )
      `, { count: 'exact' })
      .eq('is_virtual', false)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      query = query.eq('moderation_status', filters.status);
    }

    if (filters.team_id) {
      query = query.eq('games.team_id', filters.team_id);
    }

    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    if (filters.min_file_size) {
      query = query.gte('file_size_bytes', filters.min_file_size);
    }

    if (filters.max_file_size) {
      query = query.lte('file_size_bytes', filters.max_file_size);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    // Pagination
    const offset = ((filters.page || 1) - 1) * (filters.limit || 50);
    query = query.range(offset, offset + (filters.limit || 50) - 1);

    const { data: videos, count, error } = await query;

    if (error) {
      console.error('Moderation query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 500 }
      );
    }

    // Get uploader info for each video
    const uploaderIds = [...new Set(videos?.map(v => v.uploaded_by).filter(Boolean))];
    const moderatorIds = [...new Set(videos?.map(v => v.moderated_by).filter(Boolean))];
    const allUserIds = [...new Set([...uploaderIds, ...moderatorIds])];

    let usersMap: Record<string, { email: string; full_name: string | null }> = {};

    if (allUserIds.length > 0) {
      const { data: users } = await auth.serviceClient
        .from('profiles')
        .select('id, email, full_name')
        .in('id', allUserIds);

      if (users) {
        usersMap = Object.fromEntries(
          users.map(u => [u.id, { email: u.email, full_name: u.full_name }])
        );
      }
    }

    // Transform response
    const transformedVideos = videos?.map(video => ({
      id: video.id,
      name: video.name,
      file_path: video.file_path,
      url: video.url,
      file_size_bytes: video.file_size_bytes,
      file_size_formatted: formatBytes(video.file_size_bytes),
      mime_type: video.mime_type,
      duration_seconds: video.duration_seconds,
      moderation_status: video.moderation_status,
      uploaded_at: video.created_at,
      uploaded_by: video.uploaded_by,
      uploader_email: video.uploaded_by ? usersMap[video.uploaded_by]?.email : null,
      uploader_name: video.uploaded_by ? usersMap[video.uploaded_by]?.full_name : null,
      upload_ip: video.upload_ip,
      moderated_at: video.moderated_at,
      moderated_by: video.moderated_by,
      moderator_email: video.moderated_by ? usersMap[video.moderated_by]?.email : null,
      moderation_notes: video.moderation_notes,
      flagged_reason: video.flagged_reason,
      game_id: video.game_id,
      game_name: video.games?.name,
      team_id: video.games?.team_id,
      team_name: video.games?.teams?.name,
    }));

    // Get summary stats
    const { data: stats } = await auth.serviceClient
      .from('videos')
      .select('moderation_status')
      .eq('is_virtual', false);

    const statusCounts = {
      pending: stats?.filter(s => s.moderation_status === 'pending').length || 0,
      approved: stats?.filter(s => s.moderation_status === 'approved').length || 0,
      flagged: stats?.filter(s => s.moderation_status === 'flagged').length || 0,
      removed: stats?.filter(s => s.moderation_status === 'removed').length || 0,
      total: stats?.length || 0,
    };

    return NextResponse.json({
      videos: transformedVideos,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 50,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / (filters.limit || 50)),
      },
      stats: statusCounts,
    });
  } catch (error) {
    console.error('Moderation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
