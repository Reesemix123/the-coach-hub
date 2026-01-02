// src/lib/ai/film/correction-tracker.ts
// Tracks coach corrections to AI predictions for training data

import { createClient } from '@/utils/supabase/server';
import type { FieldPrediction } from './play-analyzer';

// Correction record
export interface Correction {
  field: string;
  aiValue: string | number | boolean | null;
  aiConfidence: number;
  coachValue: string | number | boolean;
}

// Context for a correction (denormalized for analysis)
export interface CorrectionContext {
  videoId: string;
  clipStartSeconds: number;
  clipEndSeconds: number;
  filmQualityScore?: number;
  cameraAngle?: string;
  audioAvailable?: boolean;
  teamId: string;
  teamLevel?: string;
}

/**
 * Track a single field correction
 */
export async function trackCorrection(
  predictionId: string,
  correction: Correction,
  context: CorrectionContext,
  playInstanceId?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'User not authenticated' };
  }

  const { data, error } = await supabase
    .from('ai_tag_corrections')
    .insert({
      prediction_id: predictionId,
      play_instance_id: playInstanceId,
      field_name: correction.field,
      ai_value: String(correction.aiValue),
      ai_confidence: correction.aiConfidence,
      coach_value: String(correction.coachValue),
      video_id: context.videoId,
      clip_start_seconds: context.clipStartSeconds,
      clip_end_seconds: context.clipEndSeconds,
      film_quality_score: context.filmQualityScore,
      camera_angle: context.cameraAngle,
      audio_available: context.audioAvailable,
      team_id: context.teamId,
      team_level: context.teamLevel,
      corrected_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    return { error: error.message };
  }

  // Update correction rate in usage table
  await updateCorrectionRate(context.teamId);

  return { id: data.id };
}

/**
 * Track multiple corrections at once
 * Useful when coach saves a play with several field changes
 */
export async function trackCorrections(
  predictionId: string,
  corrections: Correction[],
  context: CorrectionContext,
  playInstanceId?: string
): Promise<{ ids: string[] } | { error: string }> {
  const ids: string[] = [];

  for (const correction of corrections) {
    const result = await trackCorrection(predictionId, correction, context, playInstanceId);

    if ('error' in result) {
      return result;
    }

    ids.push(result.id);
  }

  return { ids };
}

/**
 * Compare AI predictions with coach values and identify corrections
 */
export function identifyCorrections(
  predictions: Record<string, FieldPrediction | undefined>,
  coachValues: Record<string, string | number | boolean | null | undefined>
): Correction[] {
  const corrections: Correction[] = [];

  for (const [field, prediction] of Object.entries(predictions)) {
    // Skip non-prediction fields
    if (!prediction || typeof prediction !== 'object' || !('value' in prediction)) {
      continue;
    }

    const coachValue = coachValues[field];

    // Skip if coach didn't set a value
    if (coachValue === null || coachValue === undefined) {
      continue;
    }

    // Compare values (normalize for comparison)
    const aiValue = prediction.value;
    const aiNormalized = String(aiValue).toLowerCase().trim();
    const coachNormalized = String(coachValue).toLowerCase().trim();

    // If values differ, record correction
    if (aiNormalized !== coachNormalized) {
      corrections.push({
        field,
        aiValue,
        aiConfidence: prediction.confidence,
        coachValue,
      });
    }
  }

  return corrections;
}

/**
 * Update correction rate in usage table
 */
async function updateCorrectionRate(teamId: string): Promise<void> {
  const supabase = await createClient();

  // Get current month period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  // Get current usage record
  const { data: usage } = await supabase
    .from('ai_tagging_usage')
    .select('id, plays_analyzed, total_corrections')
    .eq('team_id', teamId)
    .eq('period_start', periodStart)
    .single();

  if (!usage) return;

  // Increment corrections and recalculate rate
  const newTotalCorrections = (usage.total_corrections || 0) + 1;
  const correctionRate = usage.plays_analyzed > 0
    ? newTotalCorrections / usage.plays_analyzed
    : 0;

  await supabase
    .from('ai_tagging_usage')
    .update({
      total_corrections: newTotalCorrections,
      correction_rate: correctionRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', usage.id);
}

/**
 * Get correction statistics for a team
 */
export async function getCorrectionStats(teamId: string): Promise<{
  totalCorrections: number;
  correctionsByField: Record<string, number>;
  avgAiConfidenceWhenWrong: number;
  commonMistakes: { field: string; aiValue: string; correctValue: string; count: number }[];
} | null> {
  const supabase = await createClient();

  const { data: corrections } = await supabase
    .from('ai_tag_corrections')
    .select('field_name, ai_value, ai_confidence, coach_value')
    .eq('team_id', teamId);

  if (!corrections || corrections.length === 0) {
    return null;
  }

  // Calculate statistics
  const correctionsByField: Record<string, number> = {};
  const mistakeCounts: Record<string, number> = {};
  let totalConfidence = 0;

  for (const c of corrections) {
    // Count by field
    correctionsByField[c.field_name] = (correctionsByField[c.field_name] || 0) + 1;

    // Track confidence
    totalConfidence += c.ai_confidence || 0;

    // Track specific mistakes
    const key = `${c.field_name}|${c.ai_value}|${c.coach_value}`;
    mistakeCounts[key] = (mistakeCounts[key] || 0) + 1;
  }

  // Find common mistakes
  const commonMistakes = Object.entries(mistakeCounts)
    .map(([key, count]) => {
      const [field, aiValue, correctValue] = key.split('|');
      return { field, aiValue, correctValue, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCorrections: corrections.length,
    correctionsByField,
    avgAiConfidenceWhenWrong: Math.round(totalConfidence / corrections.length),
    commonMistakes,
  };
}

/**
 * Get accuracy rate by field for a team
 * Compares predictions to corrections to estimate accuracy
 */
export async function getAccuracyByField(
  teamId: string
): Promise<Record<string, { accuracy: number; sampleSize: number }> | null> {
  const supabase = await createClient();

  // Get total predictions per field
  const { data: predictions } = await supabase
    .from('ai_tag_predictions')
    .select('fields_analyzed')
    .eq('team_id', teamId)
    .eq('status', 'completed');

  if (!predictions || predictions.length === 0) {
    return null;
  }

  // Count predictions per field
  const fieldPredictionCounts: Record<string, number> = {};
  for (const p of predictions) {
    for (const field of p.fields_analyzed || []) {
      fieldPredictionCounts[field] = (fieldPredictionCounts[field] || 0) + 1;
    }
  }

  // Get corrections per field
  const { data: corrections } = await supabase
    .from('ai_tag_corrections')
    .select('field_name')
    .eq('team_id', teamId);

  const fieldCorrectionCounts: Record<string, number> = {};
  for (const c of corrections || []) {
    fieldCorrectionCounts[c.field_name] = (fieldCorrectionCounts[c.field_name] || 0) + 1;
  }

  // Calculate accuracy per field
  const result: Record<string, { accuracy: number; sampleSize: number }> = {};

  for (const [field, totalPredictions] of Object.entries(fieldPredictionCounts)) {
    const corrections = fieldCorrectionCounts[field] || 0;
    const accuracy = totalPredictions > 0
      ? Math.round(((totalPredictions - corrections) / totalPredictions) * 100)
      : 100;

    result[field] = {
      accuracy,
      sampleSize: totalPredictions,
    };
  }

  return result;
}

/**
 * Export corrections for training data
 * Returns data formatted for fine-tuning
 */
export async function exportTrainingData(
  teamId?: string,
  limit: number = 1000
): Promise<{
  field: string;
  context: {
    filmQuality: number;
    cameraAngle: string;
    audioAvailable: boolean;
    teamLevel: string;
  };
  aiPrediction: string;
  aiConfidence: number;
  correctValue: string;
}[]> {
  const supabase = await createClient();

  let query = supabase
    .from('ai_tag_corrections')
    .select(`
      field_name,
      ai_value,
      ai_confidence,
      coach_value,
      film_quality_score,
      camera_angle,
      audio_available,
      team_level
    `)
    .limit(limit);

  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data } = await query;

  if (!data) return [];

  return data.map((c) => ({
    field: c.field_name,
    context: {
      filmQuality: c.film_quality_score || 7,
      cameraAngle: c.camera_angle || 'unknown',
      audioAvailable: c.audio_available || false,
      teamLevel: c.team_level || 'High School',
    },
    aiPrediction: c.ai_value || '',
    aiConfidence: c.ai_confidence || 0,
    correctValue: c.coach_value,
  }));
}
