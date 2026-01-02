import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * DELETE /api/videos/[videoId]
 * Completely delete a video - removes storage file, video record, and related data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get video details including file_path for storage deletion
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, name, file_path, game_id, games!inner(team_id, teams!inner(user_id))')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify user owns this video's team
    const teamOwnerId = (video.games as any)?.teams?.user_id;
    if (teamOwnerId !== user.id) {
      // Check if user is a team member with appropriate role
      const teamId = (video.games as any)?.team_id;
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

      const allowedRoles = ['owner', 'coach'];
      if (!membership || !allowedRoles.includes(membership.role)) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    // Delete related data first (foreign key constraints)

    // 1. Delete video_group_members referencing this video
    await supabase
      .from('video_group_members')
      .delete()
      .eq('video_id', videoId);

    // 2. Delete video_timeline_markers for this video
    await supabase
      .from('video_timeline_markers')
      .delete()
      .eq('video_id', videoId);

    // 3. Delete play_instances for this video
    await supabase
      .from('play_instances')
      .delete()
      .eq('video_id', videoId);

    // 4. Delete gemini_file_cache entries if they exist
    await supabase
      .from('gemini_file_cache')
      .delete()
      .eq('video_id', videoId);

    // 5. Delete the storage file if file_path exists
    if (video.file_path) {
      const { error: storageError } = await supabase.storage
        .from('game-film')
        .remove([video.file_path]);

      if (storageError) {
        console.error('[VideoDelete] Storage deletion error:', storageError);
        // Continue anyway - record deletion is more important
      } else {
        console.log('[VideoDelete] Storage file deleted:', video.file_path);
      }
    }

    // 6. Finally delete the video record
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (deleteError) {
      console.error('[VideoDelete] Video record deletion error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete video record' },
        { status: 500 }
      );
    }

    console.log('[VideoDelete] Video fully deleted:', videoId, video.name);

    return NextResponse.json({
      success: true,
      message: 'Video and all related data deleted',
      deletedVideoId: videoId,
    });

  } catch (error) {
    console.error('[VideoDelete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
