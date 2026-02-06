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
