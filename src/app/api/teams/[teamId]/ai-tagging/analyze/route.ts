// API Route: Analyze play clip with AI
// POST /api/teams/[teamId]/ai-tagging/analyze
// Uses Server-Sent Events to stream progress updates

import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { TaggingTier } from '@/types/football';
import {
  getOrUploadVideo,
  getFilmQuality,
  getConfigForTier,
  getPromptForTier,
  getModelFallbackChain,
  isModelUnavailableError,
  buildPrompt,
  calculateCost,
  savePrediction,
  updateUsage,
  type PlayContext,
  type AnalysisResult,
  type PlayPrediction,
} from '@/lib/ai/film';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OFFENSIVE_FORMATIONS, DEFENSIVE_FORMATIONS } from '@/config/footballConfig';

// Get valid formation names for each mode
const VALID_OFFENSIVE_FORMATIONS = Object.keys(OFFENSIVE_FORMATIONS);
const VALID_DEFENSIVE_FORMATIONS = Object.keys(DEFENSIVE_FORMATIONS);

interface AnalyzeRequest {
  videoId: string;
  clipStartSeconds: number;
  clipEndSeconds: number;
  tier?: TaggingTier;
  playInstanceId?: string;
  context?: Partial<PlayContext>;
}

// Helper to send SSE event
function sendEvent(
  controller: ReadableStreamDefaultController,
  event: string,
  data: Record<string, unknown>
) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
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
    .select('user_id, level')
    .eq('id', teamId)
    .single();

  if (!teamAccess && teamOwner?.user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request body
  let body: AnalyzeRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    videoId,
    clipStartSeconds,
    clipEndSeconds,
    tier = 'quick',
    playInstanceId,
    context = {},
  } = body;

  // Validate required fields
  if (!videoId || clipStartSeconds === undefined || clipEndSeconds === undefined) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: videoId, clipStartSeconds, clipEndSeconds' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate clip duration - 2 to 60 seconds for meaningful analysis
  const clipDuration = clipEndSeconds - clipStartSeconds;
  if (clipDuration < 2 || clipDuration > 60) {
    return new Response(
      JSON.stringify({ error: 'Clip duration must be between 2 and 60 seconds' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate tier
  if (!['quick', 'standard', 'comprehensive'].includes(tier)) {
    return new Response(
      JSON.stringify({ error: 'Invalid tier. Must be quick, standard, or comprehensive' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get video details - first check if video exists
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select(`
      id,
      name,
      file_path,
      game_id
    `)
    .eq('id', videoId)
    .single();

  if (videoError || !video) {
    console.error('[AI Tagging] Video lookup error:', videoError, 'videoId:', videoId);
    return new Response(JSON.stringify({ error: 'Video not found', details: videoError?.message }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!video.game_id) {
    console.error('[AI Tagging] Video has no game_id:', videoId);
    return new Response(JSON.stringify({ error: 'Video is not associated with a game' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!video.file_path) {
    console.error('[AI Tagging] Video has no file_path:', videoId);
    return new Response(JSON.stringify({ error: 'Video file not found in storage' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get game details separately
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('team_id, tagging_tier')
    .eq('id', video.game_id)
    .single();

  if (gameError || !game) {
    console.error('[AI Tagging] Game lookup error:', gameError, 'game_id:', video.game_id);
    return new Response(JSON.stringify({ error: 'Game not found for this video' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify video belongs to this team
  if (game.team_id !== teamId) {
    return new Response(JSON.stringify({ error: 'Video does not belong to this team' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const effectiveTier = (tier || game.tagging_tier || 'quick') as TaggingTier;

  // Get video URL from Supabase Storage
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('game_videos')
    .createSignedUrl(video.file_path, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return new Response(JSON.stringify({ error: 'Failed to access video file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();

      try {
        // Phase 1: Prepare video (check cache or upload)
        sendEvent(controller, 'status', {
          phase: 'preparing',
          message: 'Preparing video for analysis...',
        });

        const uploadResult = await getOrUploadVideo(videoId, signedUrlData.signedUrl);

        if (uploadResult.cached) {
          sendEvent(controller, 'status', {
            phase: 'cached',
            message: 'Video ready (cached)',
          });
        } else {
          sendEvent(controller, 'status', {
            phase: 'uploaded',
            message: `Video uploaded (${Math.round((uploadResult.uploadTimeMs || 0) / 1000)}s)`,
            uploadTimeMs: uploadResult.uploadTimeMs,
          });
        }

        // Phase 2: Run AI analysis
        sendEvent(controller, 'status', {
          phase: 'analyzing',
          message: 'AI is analyzing the play...',
        });

        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
          throw new Error('GOOGLE_AI_API_KEY not configured');
        }

        // Get film quality and build context
        const filmQuality = await getFilmQuality(videoId);
        const tierConfig = getConfigForTier(effectiveTier);

        // Determine valid formations based on the mode
        // When tagging offense: we're tagging our offensive plays, use offensive formations
        // When tagging defense: we're analyzing opponent's offense, use offensive formations
        // When tagging special_teams: we skip formation field (handled separately)
        const mode = context.offenseOrDefense || 'offense';
        const validFormations = mode === 'special_teams'
          ? [] // Special teams don't use standard formations
          : mode === 'defense'
            ? VALID_OFFENSIVE_FORMATIONS // When we're on defense, opponent is on offense
            : VALID_OFFENSIVE_FORMATIONS; // When we're on offense, we use offensive formations

        const analysisContext: PlayContext = {
          teamLevel: teamOwner?.level || context.teamLevel,
          offenseOrDefense: mode,
          qualityScore: filmQuality?.qualityScore || context.qualityScore,
          audioAvailable: filmQuality?.audioAvailable || context.audioAvailable,
          previousPlayContext: context.previousPlayContext,
          playbookFormations: validFormations,
        };

        const prompt = buildPrompt(getPromptForTier(effectiveTier), {
          team_level: analysisContext.teamLevel,
          offense_or_defense: analysisContext.offenseOrDefense,
          quality_score: analysisContext.qualityScore,
          audio_available: analysisContext.audioAvailable,
          previous_play_context: analysisContext.previousPlayContext,
          playbook_formations: analysisContext.playbookFormations,
        });

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey);

        // Build video part (used for all model attempts)
        // Note: videoMetadata is supported by Gemini API but not yet in TypeScript SDK types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const videoPart: any = {
          fileData: {
            mimeType: 'video/mp4',
            fileUri: uploadResult.fileUri,
          },
          videoMetadata: {
            startOffset: { seconds: Math.floor(clipStartSeconds) },
            endOffset: { seconds: Math.ceil(clipEndSeconds) },
          },
        };

        // Try models in fallback chain until one works
        const modelChain = getModelFallbackChain(effectiveTier);
        let response;
        let usedModelId = tierConfig.modelId;
        let lastError: Error | null = null;

        for (const modelId of modelChain) {
          try {
            console.log(`[AI Tagging] Trying model: ${modelId}`);
            const model = genAI.getGenerativeModel({ model: modelId });
            const result = await model.generateContent([videoPart, { text: prompt }]);
            response = result.response;
            usedModelId = modelId;
            console.log(`[AI Tagging] Success with model: ${modelId}`);
            break; // Success - exit the loop
          } catch (modelError) {
            lastError = modelError instanceof Error ? modelError : new Error(String(modelError));
            console.warn(`[AI Tagging] Model ${modelId} failed:`, lastError.message);

            // Only try next model if this was a model availability error
            if (!isModelUnavailableError(modelError)) {
              // For other errors (rate limit, content policy, etc.), don't try fallback
              throw modelError;
            }
            // Continue to next model in chain
          }
        }

        if (!response) {
          throw lastError || new Error('All AI models failed - please try again later');
        }

        const text = response.text();

        // Parse JSON response
        let predictions: PlayPrediction;
        try {
          const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          predictions = JSON.parse(jsonStr);
        } catch {
          throw new Error(`Failed to parse AI response: ${text.substring(0, 200)}...`);
        }

        // Calculate metrics
        const usageMetadata = response.usageMetadata;
        const inputTokens = usageMetadata?.promptTokenCount || 0;
        const outputTokens = usageMetadata?.candidatesTokenCount || 0;
        const costUsd = calculateCost(usedModelId, inputTokens, outputTokens);
        const latencyMs = Date.now() - startTime;

        // Calculate confidence
        const fieldsAnalyzed = tierConfig.fields;
        const confidenceValues: number[] = [];
        const fieldsUncertain: string[] = [];

        for (const field of fieldsAnalyzed) {
          const prediction = predictions[field as keyof PlayPrediction] as { confidence: number } | undefined;
          if (prediction && typeof prediction === 'object' && 'confidence' in prediction) {
            confidenceValues.push(prediction.confidence);
            if (prediction.confidence < 50) {
              fieldsUncertain.push(field);
            }
          }
        }

        const overallConfidence = confidenceValues.length > 0
          ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
          : 0;

        // Build analysis result
        const analysisResult: AnalysisResult = {
          success: true,
          predictions,
          overallConfidence,
          fieldsAnalyzed,
          fieldsUncertain,
          inputTokens,
          outputTokens,
          costUsd,
          latencyMs,
        };

        // Save prediction to database
        const saveResult = await savePrediction(
          videoId,
          teamId,
          clipStartSeconds,
          clipEndSeconds,
          effectiveTier,
          analysisResult,
          playInstanceId
        );

        const predictionId = 'id' in saveResult ? saveResult.id : undefined;

        // Update usage tracking
        if (inputTokens && outputTokens && costUsd) {
          await updateUsage(teamId, effectiveTier, inputTokens, outputTokens, costUsd);
        }

        // Send final result
        sendEvent(controller, 'complete', {
          success: true,
          predictionId,
          predictions,
          overallConfidence,
          fieldsAnalyzed,
          fieldsUncertain,
          videoCached: uploadResult.cached,
          metrics: {
            inputTokens,
            outputTokens,
            costUsd,
            latencyMs,
            uploadTimeMs: uploadResult.uploadTimeMs,
          },
        });
      } catch (error) {
        console.error('AI tagging analyze error:', error);
        sendEvent(controller, 'error', {
          error: error instanceof Error ? error.message : 'Analysis failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
