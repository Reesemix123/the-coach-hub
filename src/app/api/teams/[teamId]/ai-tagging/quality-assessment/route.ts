// API Route: Assess video quality for AI tagging
// POST /api/teams/[teamId]/ai-tagging/quality-assessment

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';
import { getOrUploadVideo, GEMINI_MODELS, QUALITY_ASSESSMENT_PROMPT } from '@/lib/ai/film';

interface QualityAssessmentRequest {
  videoId: string;
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
    const body: QualityAssessmentRequest = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'Missing required field: videoId' }, { status: 400 });
    }

    // Check if assessment already exists
    const { data: existingAssessment } = await supabase
      .from('film_quality_assessments')
      .select('*')
      .eq('video_id', videoId)
      .single();

    if (existingAssessment) {
      return NextResponse.json({
        success: true,
        cached: true,
        assessment: {
          cameraAngle: existingAssessment.camera_angle,
          stability: existingAssessment.stability,
          fieldVisibility: existingAssessment.field_visibility,
          qualityScore: existingAssessment.quality_score,
          audio: {
            available: existingAssessment.audio_available,
            quality: existingAssessment.audio_quality,
            canHearWhistle: existingAssessment.can_hear_whistle,
            canHearCadence: existingAssessment.can_hear_cadence,
          },
          aiCapabilities: existingAssessment.ai_capabilities,
          improvementTips: existingAssessment.improvement_tips,
          assessedAt: existingAssessment.assessed_at,
        },
      });
    }

    // Get video details
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        id,
        file_path,
        games!inner(team_id)
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify video belongs to this team
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gameData = video.games as any;
    const game = Array.isArray(gameData) ? gameData[0] : gameData;
    if (!game || game.team_id !== teamId) {
      return NextResponse.json({ error: 'Video does not belong to this team' }, { status: 403 });
    }

    // Get video URL from Supabase Storage
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('game-videos')
      .createSignedUrl(video.file_path, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: 'Failed to access video file' }, { status: 500 });
    }

    // Upload video to Gemini
    const { fileUri } = await getOrUploadVideo(videoId, signedUrlData.signedUrl);

    // Get API key
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    // Initialize Gemini with Flash model (faster for assessment)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.FLASH });

    // Analyze first 30 seconds of video
    // Note: videoMetadata is supported by Gemini API but not yet in TypeScript SDK types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoPart: any = {
      fileData: {
        mimeType: 'video/mp4',
        fileUri: fileUri,
      },
      videoMetadata: {
        startOffset: { seconds: 0 },
        endOffset: { seconds: 30 },
      },
    };
    const result = await model.generateContent([videoPart, { text: QUALITY_ASSESSMENT_PROMPT }]);

    const text = result.response.text();

    // Parse JSON response
    let assessment;
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      assessment = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse quality assessment', rawResponse: text.substring(0, 500) },
        { status: 500 }
      );
    }

    // Save assessment to database
    const { error: insertError } = await supabase.from('film_quality_assessments').insert({
      video_id: videoId,
      team_id: teamId,
      camera_angle: assessment.camera_angle || 'unknown',
      stability: assessment.stability || 'unknown',
      field_visibility: assessment.field_visibility || 'unknown',
      quality_score: assessment.quality_score || 5,
      audio_available: assessment.audio?.available || false,
      audio_quality: assessment.audio?.quality || 'none',
      can_hear_whistle: assessment.audio?.can_hear_whistle || false,
      can_hear_cadence: assessment.audio?.can_hear_cadence || false,
      ai_capabilities: assessment.ai_capabilities || {},
      improvement_tips: assessment.improvement_tips || [],
      model_used: GEMINI_MODELS.FLASH,
    });

    if (insertError) {
      console.error('Failed to save quality assessment:', insertError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      cached: false,
      assessment: {
        cameraAngle: assessment.camera_angle,
        stability: assessment.stability,
        fieldVisibility: assessment.field_visibility,
        qualityScore: assessment.quality_score,
        audio: {
          available: assessment.audio?.available,
          quality: assessment.audio?.quality,
          canHearWhistle: assessment.audio?.can_hear_whistle,
          canHearCadence: assessment.audio?.can_hear_cadence,
        },
        aiCapabilities: assessment.ai_capabilities,
        improvementTips: assessment.improvement_tips,
      },
    });
  } catch (error) {
    console.error('Quality assessment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/teams/[teamId]/ai-tagging/quality-assessment
 * Get existing quality assessment for a video
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

    // Get videoId from query params
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId query parameter' }, { status: 400 });
    }

    // Get assessment
    const { data: assessment, error } = await supabase
      .from('film_quality_assessments')
      .select('*')
      .eq('video_id', videoId)
      .single();

    if (error || !assessment) {
      return NextResponse.json({ exists: false });
    }

    // Verify belongs to team
    if (assessment.team_id !== teamId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      exists: true,
      assessment: {
        cameraAngle: assessment.camera_angle,
        stability: assessment.stability,
        fieldVisibility: assessment.field_visibility,
        qualityScore: assessment.quality_score,
        audio: {
          available: assessment.audio_available,
          quality: assessment.audio_quality,
          canHearWhistle: assessment.can_hear_whistle,
          canHearCadence: assessment.can_hear_cadence,
        },
        aiCapabilities: assessment.ai_capabilities,
        improvementTips: assessment.improvement_tips,
        assessedAt: assessment.assessed_at,
      },
    });
  } catch (error) {
    console.error('Get quality assessment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
