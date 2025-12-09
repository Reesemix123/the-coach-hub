// /api/entitlements - Get team entitlements and capabilities
// Returns what the team can and cannot do based on their subscription tier

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { EntitlementsService } from '@/lib/entitlements/entitlements-service';

/**
 * GET /api/entitlements
 * Returns capabilities and limits for a team
 *
 * Query params:
 * - team_id: string (required) - Team ID to check entitlements for
 * - check: string (optional) - Specific check to perform:
 *   - 'create_game' - Can create a game (requires game_type param)
 *   - 'add_camera' - Can add camera (requires game_id param)
 *   - 'access_game' - Can access game (requires game_id param)
 * - game_type: 'team' | 'opponent' (for create_game check)
 * - game_id: string (for add_camera and access_game checks)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('team_id');
  const check = searchParams.get('check');
  const gameType = searchParams.get('game_type') as 'team' | 'opponent' | null;
  const gameId = searchParams.get('game_id');

  if (!teamId) {
    return NextResponse.json(
      { error: 'team_id is required' },
      { status: 400 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check if user owns the team or is a member
  const { data: membership } = await supabase
    .from('team_memberships')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (team.user_id !== user.id && !membership) {
    return NextResponse.json(
      { error: 'Access denied to this team' },
      { status: 403 }
    );
  }

  try {
    const entitlementsService = new EntitlementsService(supabase);

    // If a specific check is requested
    if (check) {
      switch (check) {
        case 'create_game':
          if (!gameType || !['team', 'opponent'].includes(gameType)) {
            return NextResponse.json(
              { error: 'game_type (team or opponent) is required for create_game check' },
              { status: 400 }
            );
          }
          const createResult = await entitlementsService.canCreateGame(teamId, gameType);
          return NextResponse.json(createResult);

        case 'add_camera':
          if (!gameId) {
            return NextResponse.json(
              { error: 'game_id is required for add_camera check' },
              { status: 400 }
            );
          }
          const cameraResult = await entitlementsService.canAddCamera(teamId, gameId);
          return NextResponse.json(cameraResult);

        case 'access_game':
          if (!gameId) {
            return NextResponse.json(
              { error: 'game_id is required for access_game check' },
              { status: 400 }
            );
          }
          const accessResult = await entitlementsService.canAccessGame(teamId, gameId);
          return NextResponse.json(accessResult);

        case 'ai_chat':
          const chatResult = await entitlementsService.canUseAiChat(teamId);
          return NextResponse.json(chatResult);

        case 'ai_film_tagging':
          const taggingResult = await entitlementsService.canUseAiFilmTagging(teamId);
          return NextResponse.json(taggingResult);

        default:
          return NextResponse.json(
            { error: `Unknown check type: ${check}` },
            { status: 400 }
          );
      }
    }

    // Return full entitlements summary
    const [tierInfo, gameLimits, tokenBalance, cameraLimit, videoRequirements] = await Promise.all([
      entitlementsService.getCurrentTier(teamId),
      entitlementsService.getGameLimits(teamId),
      entitlementsService.getTokenBalance(teamId),
      entitlementsService.getCameraLimit(teamId),
      entitlementsService.getVideoRequirements(teamId)
    ]);

    // Check common capabilities
    const [canChat, canAiTag] = await Promise.all([
      entitlementsService.canUseAiChat(teamId),
      entitlementsService.canUseAiFilmTagging(teamId)
    ]);

    return NextResponse.json({
      tier: tierInfo,
      gameLimits,
      tokenBalance,
      cameraLimit,
      videoRequirements,
      capabilities: {
        aiChat: canChat,
        aiFilmTagging: canAiTag
      }
    });

  } catch (error) {
    console.error('Error fetching entitlements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entitlements' },
      { status: 500 }
    );
  }
}
