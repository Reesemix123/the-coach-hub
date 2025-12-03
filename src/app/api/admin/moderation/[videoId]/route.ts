// /api/admin/moderation/[videoId] - Moderate individual video
// Approve, flag, or remove videos

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';

type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'removed';

interface ModerateRequest {
  status: ModerationStatus;
  reason?: string;
}

/**
 * GET /api/admin/moderation/[videoId]
 * Get detailed info about a video including moderation history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return auth.response;

  const { videoId } = await params;

  try {
    // Get video details
    const { data: video, error: videoError } = await auth.serviceClient
      .from('videos')
      .select(`
        *,
        games (
          id,
          name,
          team_id,
          teams (
            id,
            name
          )
        )
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Get moderation history
    const { data: history } = await auth.serviceClient
      .from('video_moderation_log')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    // Get user info for history
    const userIds = [...new Set([
      video.uploaded_by,
      video.moderated_by,
      ...(history?.map(h => h.actor_id) || [])
    ].filter(Boolean))];

    let usersMap: Record<string, { email: string; full_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: users } = await auth.serviceClient
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (users) {
        usersMap = Object.fromEntries(
          users.map(u => [u.id, { email: u.email, full_name: u.full_name }])
        );
      }
    }

    // Transform history
    const transformedHistory = history?.map(h => ({
      id: h.id,
      action: h.action,
      previous_status: h.previous_status,
      new_status: h.new_status,
      actor_id: h.actor_id,
      actor_email: h.actor_id ? usersMap[h.actor_id]?.email : null,
      actor_name: h.actor_id ? usersMap[h.actor_id]?.full_name : null,
      actor_type: h.actor_type,
      reason: h.reason,
      ip_address: h.ip_address,
      created_at: h.created_at,
    }));

    return NextResponse.json({
      video: {
        ...video,
        uploader_email: video.uploaded_by ? usersMap[video.uploaded_by]?.email : null,
        uploader_name: video.uploaded_by ? usersMap[video.uploaded_by]?.full_name : null,
        moderator_email: video.moderated_by ? usersMap[video.moderated_by]?.email : null,
        game_name: video.games?.name,
        team_id: video.games?.team_id,
        team_name: video.games?.teams?.name,
      },
      history: transformedHistory,
    });
  } catch (error) {
    console.error('Get video error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/moderation/[videoId]
 * Update moderation status of a video
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return auth.response;

  const { videoId } = await params;

  try {
    const body: ModerateRequest = await request.json();
    const { status, reason } = body;

    // Validate status
    const validStatuses: ModerationStatus[] = ['pending', 'approved', 'flagged', 'removed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, approved, flagged, or removed' },
        { status: 400 }
      );
    }

    // Get current video status
    const { data: currentVideo, error: fetchError } = await auth.serviceClient
      .from('videos')
      .select('id, moderation_status')
      .eq('id', videoId)
      .single();

    if (fetchError || !currentVideo) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const previousStatus = currentVideo.moderation_status;

    // Update video
    const { error: updateError } = await auth.serviceClient
      .from('videos')
      .update({
        moderation_status: status,
        moderated_at: new Date().toISOString(),
        moderated_by: auth.admin.id,
        moderation_notes: reason || null,
        flagged_reason: status === 'flagged' ? reason : null,
      })
      .eq('id', videoId);

    if (updateError) {
      console.error('Update video error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update video' },
        { status: 500 }
      );
    }

    // Log the action
    const actionMap: Record<ModerationStatus, string> = {
      pending: 'reviewed',
      approved: 'approved',
      flagged: 'flagged',
      removed: 'removed',
    };

    const { error: logError } = await auth.serviceClient
      .from('video_moderation_log')
      .insert({
        video_id: videoId,
        action: actionMap[status],
        previous_status: previousStatus,
        new_status: status,
        actor_id: auth.admin.id,
        actor_type: 'admin',
        reason: reason || null,
      });

    if (logError) {
      console.error('Log moderation error:', logError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      video_id: videoId,
      previous_status: previousStatus,
      new_status: status,
    });
  } catch (error) {
    console.error('Moderate video error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/moderation/[videoId]
 * Permanently delete a video (use with caution)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return auth.response;

  const { videoId } = await params;

  try {
    // Get video info first
    const { data: video, error: fetchError } = await auth.serviceClient
      .from('videos')
      .select('id, name, file_path, moderation_status')
      .eq('id', videoId)
      .single();

    if (fetchError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Log the deletion before removing
    await auth.serviceClient
      .from('video_moderation_log')
      .insert({
        video_id: videoId,
        action: 'removed',
        previous_status: video.moderation_status,
        new_status: 'removed',
        actor_id: auth.admin.id,
        actor_type: 'admin',
        reason: 'Permanently deleted by admin',
        metadata: {
          video_name: video.name,
          file_path: video.file_path,
          deleted_at: new Date().toISOString(),
        },
      });

    // Delete from storage if file_path exists
    if (video.file_path) {
      const { error: storageError } = await auth.serviceClient.storage
        .from('game-film')
        .remove([video.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage fails
      }
    }

    // Delete from database
    const { error: deleteError } = await auth.serviceClient
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (deleteError) {
      console.error('Delete video error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete video' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Video permanently deleted',
    });
  } catch (error) {
    console.error('Delete video error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
