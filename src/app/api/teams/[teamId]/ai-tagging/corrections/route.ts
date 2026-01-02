// API Route: Track AI prediction corrections
// POST /api/teams/[teamId]/ai-tagging/corrections

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  trackCorrections,
  identifyCorrections,
  type Correction,
  type CorrectionContext,
} from '@/lib/ai/film';

interface CorrectionsRequest {
  predictionId: string;
  playInstanceId?: string;
  // Coach's corrected values
  coachValues: Record<string, string | number | boolean | null>;
  // Context for training data
  context: {
    videoId: string;
    clipStartSeconds: number;
    clipEndSeconds: number;
    filmQualityScore?: number;
    cameraAngle?: string;
    audioAvailable?: boolean;
    teamLevel?: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
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

    // Parse request body
    const body: CorrectionsRequest = await request.json();
    const { predictionId, playInstanceId, coachValues, context } = body;

    // Validate required fields
    if (!predictionId || !coachValues || !context?.videoId) {
      return NextResponse.json(
        { error: 'Missing required fields: predictionId, coachValues, context.videoId' },
        { status: 400 }
      );
    }

    // Get the original prediction
    const { data: prediction, error: predictionError } = await supabase
      .from('ai_tag_predictions')
      .select('predictions, team_id')
      .eq('id', predictionId)
      .single();

    if (predictionError || !prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }

    // Verify prediction belongs to this team
    if (prediction.team_id !== teamId) {
      return NextResponse.json(
        { error: 'Prediction does not belong to this team' },
        { status: 403 }
      );
    }

    // Identify corrections by comparing AI predictions with coach values
    const corrections = identifyCorrections(
      prediction.predictions as Record<string, { value: string | number | boolean; confidence: number }>,
      coachValues
    );

    // If no corrections needed, return early
    if (corrections.length === 0) {
      return NextResponse.json({
        success: true,
        correctionsCount: 0,
        message: 'AI predictions matched coach values - no corrections needed',
      });
    }

    // Build correction context
    const correctionContext: CorrectionContext = {
      videoId: context.videoId,
      clipStartSeconds: context.clipStartSeconds || 0,
      clipEndSeconds: context.clipEndSeconds || 0,
      filmQualityScore: context.filmQualityScore,
      cameraAngle: context.cameraAngle,
      audioAvailable: context.audioAvailable,
      teamId,
      teamLevel: context.teamLevel,
    };

    // Track all corrections
    const result = await trackCorrections(
      predictionId,
      corrections,
      correctionContext,
      playInstanceId
    );

    if ('error' in result) {
      return NextResponse.json(
        { error: 'Failed to save corrections', message: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      correctionsCount: corrections.length,
      correctionIds: result.ids,
      corrections: corrections.map((c) => ({
        field: c.field,
        aiValue: c.aiValue,
        aiConfidence: c.aiConfidence,
        coachValue: c.coachValue,
      })),
    });
  } catch (error) {
    console.error('AI tagging corrections error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/teams/[teamId]/ai-tagging/corrections
 * Get correction statistics for the team
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
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

    // Get correction statistics
    const { data: corrections } = await supabase
      .from('ai_tag_corrections')
      .select('field_name, ai_value, ai_confidence, coach_value')
      .eq('team_id', teamId);

    if (!corrections || corrections.length === 0) {
      return NextResponse.json({
        totalCorrections: 0,
        correctionsByField: {},
        avgAiConfidenceWhenWrong: 0,
        commonMistakes: [],
      });
    }

    // Calculate statistics
    const correctionsByField: Record<string, number> = {};
    const mistakeCounts: Record<string, number> = {};
    let totalConfidence = 0;

    for (const c of corrections) {
      correctionsByField[c.field_name] = (correctionsByField[c.field_name] || 0) + 1;
      totalConfidence += c.ai_confidence || 0;

      const key = `${c.field_name}|${c.ai_value}|${c.coach_value}`;
      mistakeCounts[key] = (mistakeCounts[key] || 0) + 1;
    }

    const commonMistakes = Object.entries(mistakeCounts)
      .map(([key, count]) => {
        const [field, aiValue, correctValue] = key.split('|');
        return { field, aiValue, correctValue, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      totalCorrections: corrections.length,
      correctionsByField,
      avgAiConfidenceWhenWrong: Math.round(totalConfidence / corrections.length),
      commonMistakes,
    });
  } catch (error) {
    console.error('AI tagging corrections stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
