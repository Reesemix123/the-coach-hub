import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { EntitlementsService } from '@/lib/entitlements/entitlements-service';
import { TokenService } from '@/lib/entitlements/token-service';

/**
 * DELETE /api/teams/[teamId]/games/[gameId]
 * Delete a game with optional token refund
 *
 * Refund eligibility:
 * - If no plays have been tagged (no play_instances) → refund 1 token
 * - If plays have been tagged → no refund (work has been done)
 *
 * Always deletes: play_instances → videos (+ storage) → game
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; gameId: string }> }
) {
  try {
    const { teamId, gameId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns this team or is a member with appropriate role
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check ownership or membership
    let hasPermission = team.user_id === user.id;
    if (!hasPermission) {
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

      hasPermission = membership && ['owner', 'coach'].includes(membership.role);
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Verify game exists and belongs to this team
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, name, team_id')
      .eq('id', gameId)
      .eq('team_id', teamId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check refund eligibility
    const entitlements = new EntitlementsService(supabase);
    const refundCheck = await entitlements.canRefundGame(teamId, gameId);

    // Process refund FIRST if eligible (before any deletions)
    let refunded = false;
    if (refundCheck.eligible) {
      const tokenService = new TokenService(supabase);
      refunded = await tokenService.refundToken(
        teamId,
        gameId,
        `Token refunded - game "${game.name}" deleted before any plays were tagged`,
        user.id
      );

      if (!refunded) {
        console.error('[GameDelete] Token refund failed for game:', gameId);
        // Continue with deletion anyway - better to delete than leave orphaned
      }
    }

    // Get videos for this game (need file_paths for storage cleanup)
    const { data: videos } = await supabase
      .from('videos')
      .select('id, file_path')
      .eq('game_id', gameId);

    const videoIds = videos?.map(v => v.id) || [];

    // Delete in order: play_instances → video_group_members → videos → game

    // 1. Delete play_instances for all videos
    if (videoIds.length > 0) {
      await supabase
        .from('play_instances')
        .delete()
        .in('video_id', videoIds);

      // 2. Delete video_group_members
      await supabase
        .from('video_group_members')
        .delete()
        .in('video_id', videoIds);

      // 3. Delete video_timeline_markers
      await supabase
        .from('video_timeline_markers')
        .delete()
        .in('video_id', videoIds);

      // 4. Delete storage files
      const filePaths = videos?.filter(v => v.file_path).map(v => v.file_path) || [];
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('game-film')
          .remove(filePaths);

        if (storageError) {
          console.error('[GameDelete] Storage deletion error:', storageError);
          // Continue anyway
        }
      }

      // 5. Delete video records
      await supabase
        .from('videos')
        .delete()
        .eq('game_id', gameId);
    }

    // 6. Delete video_groups for this game
    await supabase
      .from('video_groups')
      .delete()
      .eq('game_id', gameId);

    // 7. Finally delete the game
    const { error: deleteError } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (deleteError) {
      console.error('[GameDelete] Game deletion error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete game' },
        { status: 500 }
      );
    }

    console.log('[GameDelete] Game deleted:', {
      gameId,
      gameName: game.name,
      refunded,
      videosDeleted: videoIds.length,
      tagsDeleted: refundCheck.tagCount
    });

    return NextResponse.json({
      success: true,
      message: refunded
        ? 'Game deleted and 1 token refunded'
        : 'Game deleted',
      refunded,
      deletedGameId: gameId,
      deletedVideoCount: videoIds.length,
      deletedTagCount: refundCheck.tagCount
    });

  } catch (error) {
    console.error('[GameDelete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teams/[teamId]/games/[gameId]
 * Get game details including refund eligibility
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; gameId: string }> }
) {
  try {
    const { teamId, gameId } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get game with refund eligibility
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .eq('team_id', teamId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check refund eligibility
    const entitlements = new EntitlementsService(supabase);
    const refundCheck = await entitlements.canRefundGame(teamId, gameId);

    return NextResponse.json({
      game,
      refundEligibility: {
        eligible: refundCheck.eligible,
        reason: refundCheck.reason,
        tagCount: refundCheck.tagCount
      }
    });

  } catch (error) {
    console.error('[GameGet] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
