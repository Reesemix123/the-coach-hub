import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * PATCH /api/teams/[teamId]/videos/[videoId]/sync
 * Update the sync offset for a camera
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; videoId: string }> }
) {
  try {
    const { teamId, videoId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify team access
    const { data: teamAccess } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const { data: teamOwner } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    if (!teamAccess && teamOwner?.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { sync_offset_seconds } = body;

    if (typeof sync_offset_seconds !== 'number') {
      return NextResponse.json(
        { error: 'sync_offset_seconds must be a number' },
        { status: 400 }
      );
    }

    // Verify the video belongs to a game owned by this team
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, game_id, camera_order, games!inner(team_id)')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Type guard for games relationship
    const games = video.games as unknown as { team_id: string } | null;
    if (!games || games.team_id !== teamId) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Don't allow setting sync offset on primary camera
    if (video.camera_order === 1 && sync_offset_seconds !== 0) {
      return NextResponse.json(
        { error: 'Cannot set sync offset on primary camera' },
        { status: 400 }
      );
    }

    // Update the sync offset
    const { data: updatedVideo, error: updateError } = await supabase
      .from('videos')
      .update({ sync_offset_seconds })
      .eq('id', videoId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating sync offset:', updateError);
      return NextResponse.json(
        { error: 'Failed to update sync offset' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      video: updatedVideo,
    });
  } catch (error) {
    console.error('Sync update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
