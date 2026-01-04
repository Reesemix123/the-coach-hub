// src/lib/ai/film/play-analyzer.ts
// Core AI analysis for play clips using Gemini

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';
import type { TaggingTier } from '@/types/football';
import { getOrUploadVideo } from './gemini-file-manager';
import { getConfigForTier, getPromptForTier, calculateCost } from './model-selector';
import { buildPrompt } from './film-prompts';

// Prediction result for a single field
export interface FieldPrediction {
  value: string | number | boolean;
  confidence: number; // 0-100
  notes?: string;
}

// Complete prediction result from AI analysis
export interface PlayPrediction {
  play_type?: FieldPrediction;
  direction?: FieldPrediction;
  result?: FieldPrediction;
  yards_gained?: FieldPrediction;
  formation?: FieldPrediction;
  personnel?: FieldPrediction;
  hash?: FieldPrediction;
  down?: FieldPrediction;
  distance?: FieldPrediction;
  field_zone?: FieldPrediction;
  quarter?: FieldPrediction;
  motion?: FieldPrediction;
  play_action?: FieldPrediction;
  run_concept?: FieldPrediction;
  pass_concept?: FieldPrediction;
  // Special Teams fields (only returned when play_type is special_teams)
  special_teams_unit?: FieldPrediction;
  kick_result?: FieldPrediction;
  kick_distance?: FieldPrediction;
  return_yards?: FieldPrediction;
  is_touchback?: FieldPrediction;
  is_fair_catch?: FieldPrediction;
  is_muffed?: FieldPrediction;
  punt_type?: FieldPrediction;
  kickoff_type?: FieldPrediction;
  audio_used?: boolean;
  fields_uncertain?: string[];
  reasoning?: string;
}

// Analysis result with metadata
export interface AnalysisResult {
  success: boolean;
  predictions?: PlayPrediction;
  overallConfidence?: number;
  fieldsAnalyzed?: string[];
  fieldsUncertain?: string[];
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  error?: string;
}

// Context for play analysis
export interface PlayContext {
  teamLevel?: string; // '8U', '10U', '12U', 'Middle School', 'High School'
  offenseOrDefense?: 'offense' | 'defense';
  qualityScore?: number; // 1-10 from film quality assessment
  audioAvailable?: boolean;
  previousPlayContext?: string;
  playbookFormations?: string[];
}

/**
 * Analyze a single play clip using Gemini
 */
export async function analyzePlayClip(
  videoId: string,
  videoUrl: string,
  clipStartSeconds: number,
  clipEndSeconds: number,
  tier: TaggingTier,
  context: PlayContext = {}
): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'GOOGLE_AI_API_KEY environment variable not set',
      };
    }

    // Get or upload video to Gemini
    const { fileUri } = await getOrUploadVideo(videoId, videoUrl);

    // Get tier configuration
    const tierConfig = getConfigForTier(tier);

    // Build the prompt with context
    const prompt = buildPrompt(getPromptForTier(tier), {
      team_level: context.teamLevel,
      offense_or_defense: context.offenseOrDefense,
      quality_score: context.qualityScore,
      audio_available: context.audioAvailable,
      previous_play_context: context.previousPlayContext,
      playbook_formations: context.playbookFormations,
    });

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: tierConfig.modelId });

    // Call Gemini with video clip
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: 'video/mp4',
          fileUri: fileUri,
        },
        // Note: Video metadata with start/end offsets
        // @ts-expect-error - videoMetadata is supported but not in types yet
        videoMetadata: {
          startOffset: { seconds: Math.floor(clipStartSeconds) },
          endOffset: { seconds: Math.ceil(clipEndSeconds) },
        },
      },
      { text: prompt },
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON response
    let predictions: PlayPrediction;
    try {
      // Clean the response - sometimes AI includes markdown code blocks
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      predictions = JSON.parse(jsonStr);
    } catch {
      return {
        success: false,
        error: `Failed to parse AI response as JSON: ${text.substring(0, 200)}...`,
        latencyMs: Date.now() - startTime,
      };
    }

    // Calculate metrics
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    const costUsd = calculateCost(tierConfig.modelId, inputTokens, outputTokens);

    // Calculate overall confidence
    const fieldsAnalyzed = tierConfig.fields;
    const confidenceValues: number[] = [];
    const fieldsUncertain: string[] = [];

    for (const field of fieldsAnalyzed) {
      const prediction = predictions[field as keyof PlayPrediction] as FieldPrediction | undefined;
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

    return {
      success: true,
      predictions,
      overallConfidence,
      fieldsAnalyzed,
      fieldsUncertain,
      inputTokens,
      outputTokens,
      costUsd,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during analysis',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Save AI prediction to database
 */
export async function savePrediction(
  videoId: string,
  teamId: string,
  clipStartSeconds: number,
  clipEndSeconds: number,
  tier: TaggingTier,
  result: AnalysisResult,
  playInstanceId?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const tierConfig = getConfigForTier(tier);

  const { data, error } = await supabase
    .from('ai_tag_predictions')
    .insert({
      video_id: videoId,
      team_id: teamId,
      play_instance_id: playInstanceId,
      tagging_tier: tier,
      model_used: tierConfig.modelId,
      clip_start_seconds: clipStartSeconds,
      clip_end_seconds: clipEndSeconds,
      predictions: result.predictions || {},
      overall_confidence: result.overallConfidence,
      fields_analyzed: result.fieldsAnalyzed,
      fields_uncertain: result.fieldsUncertain,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      latency_ms: result.latencyMs,
      status: result.success ? 'completed' : 'failed',
      error_message: result.error,
    })
    .select('id')
    .single();

  if (error) {
    return { error: error.message };
  }

  return { id: data.id };
}

/**
 * Get film quality assessment for a video
 * Returns cached assessment if available
 */
export async function getFilmQuality(
  videoId: string
): Promise<{
  qualityScore: number;
  audioAvailable: boolean;
  aiCapabilities: Record<string, { expected_confidence: string; notes?: string }>;
} | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('film_quality_assessments')
    .select('quality_score, audio_available, ai_capabilities')
    .eq('video_id', videoId)
    .single();

  if (!data) return null;

  return {
    qualityScore: data.quality_score,
    audioAvailable: data.audio_available,
    aiCapabilities: data.ai_capabilities,
  };
}

/**
 * Update AI tagging usage for billing/tracking
 */
export async function updateUsage(
  teamId: string,
  tier: TaggingTier,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
): Promise<void> {
  const supabase = await createClient();

  // Get current month period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Upsert usage record
  const tierColumn = `${tier}_tier_count`;

  // First, try to get existing record
  const { data: existing } = await supabase
    .from('ai_tagging_usage')
    .select('*')
    .eq('team_id', teamId)
    .eq('period_start', periodStart)
    .single();

  if (existing) {
    // Update existing record
    await supabase
      .from('ai_tagging_usage')
      .update({
        plays_analyzed: existing.plays_analyzed + 1,
        [tierColumn]: (existing[tierColumn] || 0) + 1,
        total_input_tokens: existing.total_input_tokens + inputTokens,
        total_output_tokens: existing.total_output_tokens + outputTokens,
        total_cost_usd: parseFloat(existing.total_cost_usd) + costUsd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Create new record
    await supabase.from('ai_tagging_usage').insert({
      team_id: teamId,
      period_start: periodStart,
      period_end: periodEnd,
      plays_analyzed: 1,
      [tierColumn]: 1,
      total_input_tokens: inputTokens,
      total_output_tokens: outputTokens,
      total_cost_usd: costUsd,
    });
  }
}

/**
 * Analyze a play and save results
 * Combines analyze + save + usage tracking
 */
export async function analyzeAndSavePlay(
  videoId: string,
  videoUrl: string,
  teamId: string,
  clipStartSeconds: number,
  clipEndSeconds: number,
  tier: TaggingTier,
  context: PlayContext = {},
  playInstanceId?: string
): Promise<AnalysisResult & { predictionId?: string }> {
  // Run analysis
  const result = await analyzePlayClip(
    videoId,
    videoUrl,
    clipStartSeconds,
    clipEndSeconds,
    tier,
    context
  );

  // Save prediction
  const saveResult = await savePrediction(
    videoId,
    teamId,
    clipStartSeconds,
    clipEndSeconds,
    tier,
    result,
    playInstanceId
  );

  // Update usage if successful
  if (result.success && result.inputTokens && result.outputTokens && result.costUsd) {
    await updateUsage(
      teamId,
      tier,
      result.inputTokens,
      result.outputTokens,
      result.costUsd
    );
  }

  return {
    ...result,
    predictionId: 'id' in saveResult ? saveResult.id : undefined,
  };
}
