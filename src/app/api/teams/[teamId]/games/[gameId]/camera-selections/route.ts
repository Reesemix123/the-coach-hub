import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface CameraSelection {
  id: string;
  game_id: string;
  camera_id: string;
  start_seconds: number;
  end_seconds: number | null;
  created_by: string | null;
  created_at: string;
}

/**
 * GET /api/teams/[teamId]/games/[gameId]/camera-selections
 * Get all camera selections for a game (for Director's Cut playback)
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
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('id', gameId)
      .eq('team_id', teamId)
      .single();

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Get camera selections ordered by start time
    const { data: selections, error: selectionsError } = await supabase
      .from('camera_selections')
      .select(`
        id,
        game_id,
        camera_id,
        start_seconds,
        end_seconds,
        created_by,
        created_at,
        videos (
          id,
          name,
          camera_label,
          camera_order,
          sync_offset_seconds
        )
      `)
      .eq('game_id', gameId)
      .order('start_seconds', { ascending: true });

    if (selectionsError) {
      console.error('Error fetching camera selections:', selectionsError);
      return NextResponse.json(
        { error: 'Failed to fetch camera selections' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      selections: selections || [],
      hasSelections: (selections?.length || 0) > 0,
    });
  } catch (error) {
    console.error('Get camera selections error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams/[teamId]/games/[gameId]/camera-selections
 * Add a new camera selection (when recording Director's Cut)
 */
export async function POST(
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

    // Get request body
    const body = await request.json();
    const { camera_id, start_seconds } = body;

    if (!camera_id || start_seconds === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: camera_id, start_seconds' },
        { status: 400 }
      );
    }

    // Verify camera belongs to this game
    const { data: camera } = await supabase
      .from('videos')
      .select('id, game_id')
      .eq('id', camera_id)
      .eq('game_id', gameId)
      .single();

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
    }

    // End the previous selection at this time (if any)
    const { error: updateError } = await supabase
      .from('camera_selections')
      .update({ end_seconds: start_seconds })
      .eq('game_id', gameId)
      .is('end_seconds', null);

    if (updateError) {
      console.error('Error updating previous selection:', updateError);
    }

    // Insert the new selection
    const { data: newSelection, error: insertError } = await supabase
      .from('camera_selections')
      .insert({
        game_id: gameId,
        camera_id,
        start_seconds,
        end_seconds: null, // Open-ended until next selection
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting camera selection:', insertError);
      return NextResponse.json(
        { error: 'Failed to save camera selection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      selection: newSelection,
    });
  } catch (error) {
    console.error('Create camera selection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[teamId]/games/[gameId]/camera-selections
 * Clear all camera selections for a game (reset Director's Cut)
 */
export async function DELETE(
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

    // Delete all camera selections for this game
    const { error: deleteError } = await supabase
      .from('camera_selections')
      .delete()
      .eq('game_id', gameId);

    if (deleteError) {
      console.error('Error deleting camera selections:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear camera selections' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete camera selections error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
