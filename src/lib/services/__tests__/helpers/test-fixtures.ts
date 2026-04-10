import type { TimelineClip, CameraLane, GameTimeline } from '@/types/timeline';

/**
 * Create a TimelineClip with sensible defaults
 */
export function makeClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'clip-1',
    videoId: 'video-1',
    videoName: 'Test Video',
    videoUrl: 'https://example.com/video.mp4',
    cameraLane: 1,
    lanePositionMs: 0,
    durationMs: 60000,
    startOffsetMs: 0,
    endOffsetMs: null,
    ...overrides,
  };
}

/**
 * Create a CameraLane with clips
 */
export function makeLane(
  lane: number,
  clips: TimelineClip[],
  overrides: Partial<Omit<CameraLane, 'lane' | 'clips'>> = {}
): CameraLane {
  return {
    lane,
    label: `Camera ${lane}`,
    clips,
    syncOffsetMs: 0,
    ...overrides,
  };
}

/**
 * Create a GameTimeline
 */
export function makeTimeline(
  lanes: CameraLane[],
  overrides: Partial<Omit<GameTimeline, 'lanes'>> = {}
): GameTimeline {
  // Calculate totalDurationMs from clips
  let maxEnd = 0;
  for (const lane of lanes) {
    for (const clip of lane.clips) {
      const clipEnd = clip.lanePositionMs + clip.durationMs;
      if (clipEnd > maxEnd) maxEnd = clipEnd;
    }
  }

  return {
    gameId: 'game-1',
    videoGroupId: 'vg-1',
    totalDurationMs: maxEnd,
    lanes,
    isTimelineMode: true,
    ...overrides,
  };
}

/**
 * Mock Gemini play analysis response — realistic JSON string matching PlayPrediction shape.
 * All 21+ fields populated with realistic football values and varied confidence scores.
 */
export const mockGeminiPlayResponse = JSON.stringify({
  play_type: { value: 'pass', confidence: 92, notes: 'Clear dropback' },
  direction: { value: 'right', confidence: 78 },
  result: { value: 'pass_complete', confidence: 88 },
  yards_gained: { value: 12, confidence: 85 },
  formation: { value: 'shotgun_spread', confidence: 72 },
  personnel: { value: '11', confidence: 65 },
  hash: { value: 'middle', confidence: 55 },
  down: { value: 2, confidence: 95 },
  distance: { value: 8, confidence: 90 },
  field_zone: { value: 'midfield', confidence: 60 },
  quarter: { value: 3, confidence: 98 },
  motion: { value: false, confidence: 45 },  // Below 50 — should be uncertain
  play_action: { value: false, confidence: 82 },
  run_concept: { value: null, confidence: 0 },
  pass_concept: { value: 'slant', confidence: 68 },
  is_screen: { value: false, confidence: 75 },
  is_rpo: { value: false, confidence: 70 },
  special_teams_type: { value: null, confidence: 0 },
  kick_result: { value: null, confidence: 0 },
  return_yards: { value: null, confidence: 0 },
  penalty: { value: false, confidence: 40 },  // Below 50 — should be uncertain
  audio_used: true,
  fields_uncertain: ['motion', 'penalty'],
  reasoning: 'QB in shotgun, clear pass action, ball caught on the right side for 12 yards',
});

/**
 * Mock Gemini response with code fences (common Gemini output format)
 */
export const mockGeminiPlayResponseWithFences = '```json\n' + mockGeminiPlayResponse + '\n```';

/**
 * Minimal mock response with only quick-tier fields
 */
export const mockGeminiQuickResponse = JSON.stringify({
  play_type: { value: 'run', confidence: 88 },
  direction: { value: 'left', confidence: 70 },
  result: { value: 'rush', confidence: 82 },
  yards_gained: { value: 5, confidence: 76 },
});
