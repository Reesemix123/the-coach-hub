/**
 * API: /api/teams/[teamId]/ai-tagging/scoreboard-ocr
 * POST - Read scoreboard from the designated scoreboard camera via Gemini OCR
 *
 * Returns per-field readings with confidence scores. The client applies
 * threshold filtering before populating form fields.
 *
 * Error codes for client-side handling:
 *   - 404 with error "NO_SCOREBOARD_CAMERA" — no scoreboard camera designated
 *   - 400 — missing/invalid request parameters
 *   - 401/403 — auth failure
 *   - 500 — OCR processing failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { readScoreboard } from '@/lib/ai/film/scoreboard-ocr';

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ teamId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { teamId } = await context.params;
    const supabase = await createClient();

    // -------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify coach owns the team or is active staff
    const { data: team } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', teamId)
      .single();

    const isOwner = team?.user_id === user.id;

    if (!isOwner) {
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // -------------------------------------------------------------------
    // Parse request
    // -------------------------------------------------------------------
    const body = await request.json();
    const { gameId, timestampSeconds } = body;

    if (!gameId || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    if (timestampSeconds == null || typeof timestampSeconds !== 'number' || timestampSeconds < 0) {
      return NextResponse.json(
        { error: 'timestampSeconds is required and must be a non-negative number' },
        { status: 400 },
      );
    }

    // -------------------------------------------------------------------
    // Run OCR
    // -------------------------------------------------------------------
    const result = await readScoreboard(gameId, timestampSeconds);

    if (!result.success) {
      // Distinguish "no scoreboard camera" from other failures
      const isNoCameraError =
        result.error === 'No cameras found for this game' ||
        result.error === 'Scoreboard camera has no video file';

      if (isNoCameraError) {
        return NextResponse.json(
          {
            error: 'NO_SCOREBOARD_CAMERA',
            message: 'No scoreboard camera is designated for this game. Designate a camera with the "Scoreboard" role to enable OCR.',
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          error: 'OCR_FAILED',
          message: result.error || 'Scoreboard OCR failed',
          latencyMs: result.latencyMs,
        },
        { status: 500 },
      );
    }

    // -------------------------------------------------------------------
    // Return full reading with confidences — client applies thresholds
    // -------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      reading: result.reading,
      latencyMs: result.latencyMs,
      model: result.model,
      cameraUsed: result.cameraUsed,
    });
  } catch (error) {
    console.error('[scoreboard-ocr] Error:', error);
    return NextResponse.json(
      {
        error: 'OCR_FAILED',
        message: error instanceof Error ? error.message : 'Scoreboard OCR failed',
      },
      { status: 500 },
    );
  }
}
