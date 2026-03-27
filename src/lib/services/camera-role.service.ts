/**
 * Camera Role Service
 *
 * Provides utilities for working with camera roles, primarily for the
 * upcoming Gemini OCR integration that will auto-populate play metadata
 * (quarter, clock, score, down & distance) from the scoreboard camera.
 *
 * This service is built ahead of the Gemini OCR phase so the interface
 * is clean and ready. It is not called by anything yet.
 */

import { createServiceClient } from '@/utils/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreboardCamera {
  videoId: string;
  filePath: string;
  cameraLabel: string | null;
  cameraOrder: number;
  cameraRole: string;
  syncOffsetSeconds: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find the best camera to use for scoreboard OCR for a given game.
 *
 * Selection priority:
 *   1. Camera with camera_role = 'scoreboard' (explicit designation)
 *   2. Any secondary camera (camera_order > 1) — likely a dedicated angle
 *   3. The primary camera as a last resort
 *
 * Returns null if no cameras exist for the game.
 *
 * Intended for use by the Gemini OCR integration (not yet built).
 *
 * @param gameId - The game to find a scoreboard camera for
 * @returns The best camera for scoreboard OCR, or null
 */
export async function getScoreboardCamera(
  gameId: string,
): Promise<ScoreboardCamera | null> {
  const supabase = createServiceClient();

  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, file_path, camera_label, camera_order, camera_role, sync_offset_seconds')
    .eq('game_id', gameId)
    .eq('is_virtual', false)
    .order('camera_order', { ascending: true });

  if (error || !videos || videos.length === 0) {
    return null;
  }

  // Priority 1: Explicit scoreboard camera
  const scoreboard = videos.find(v => v.camera_role === 'scoreboard');
  if (scoreboard) return mapToResult(scoreboard);

  // Priority 2: Any secondary camera (not primary)
  const secondary = videos.find(v => (v.camera_order ?? 1) > 1);
  if (secondary) return mapToResult(secondary);

  // Priority 3: Primary camera as last resort
  return mapToResult(videos[0]);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function mapToResult(video: {
  id: string;
  file_path: string | null;
  camera_label: string | null;
  camera_order: number | null;
  camera_role: string | null;
  sync_offset_seconds: number | null;
}): ScoreboardCamera {
  return {
    videoId: video.id,
    filePath: video.file_path ?? '',
    cameraLabel: video.camera_label,
    cameraOrder: video.camera_order ?? 1,
    cameraRole: video.camera_role ?? 'sideline',
    syncOffsetSeconds: video.sync_offset_seconds ?? 0,
  };
}
