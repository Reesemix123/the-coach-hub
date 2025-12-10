import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { EntitlementsService } from '@/lib/entitlements/entitlements-service';

/**
 * GET /api/teams/[teamId]/games/[gameId]/cameras
 * Get all cameras for a game with limit information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; gameId: string }> }
) {
  try {
    const { teamId, gameId } = await params;
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

    // Verify game belongs to team
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, name')
      .eq('id', gameId)
      .eq('team_id', teamId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Get cameras for this game
    const { data: cameras, error: camerasError } = await supabase
      .from('videos')
      .select(`
        id,
        name,
        camera_label,
        camera_order,
        sync_offset_seconds,
        thumbnail_url,
        upload_status,
        duration_seconds,
        file_path,
        created_at
      `)
      .eq('game_id', gameId)
      .order('camera_order', { ascending: true });

    if (camerasError) {
      console.error('Error fetching cameras:', camerasError);
      return NextResponse.json(
        { error: 'Failed to fetch cameras' },
        { status: 500 }
      );
    }

    // Get camera limit from entitlements
    const entitlements = new EntitlementsService(supabase);
    const cameraLimit = await entitlements.getCameraLimit(teamId);
    const canAddMore = await entitlements.canAddCamera(teamId, gameId);

    return NextResponse.json({
      cameras: cameras || [],
      cameraLimit,
      currentCount: cameras?.length || 0,
      canAddMore: canAddMore.allowed,
      upgradeOption: canAddMore.upgradeOption,
    });
  } catch (error) {
    console.error('Get cameras error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
