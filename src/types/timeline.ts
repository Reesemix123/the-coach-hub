// Timeline types for multi-clip camera swim lane editor

/**
 * A single video clip on a camera lane
 */
export interface TimelineClip {
  id: string;                    // video_group_member id
  videoId: string;               // Reference to videos table
  videoName: string;
  videoUrl: string;
  cameraLane: number;            // 1-5
  lanePositionMs: number;        // Where clip starts on timeline
  durationMs: number;            // Clip length (from video metadata or trim)
  startOffsetMs: number;         // Trim start point
  endOffsetMs: number | null;    // Trim end point (null = full length)
  thumbnailUrl?: string;
}

/**
 * A camera lane with its clips
 */
export interface CameraLane {
  lane: number;                  // 1-5
  label: string;                 // "Sideline", "End Zone", etc.
  clips: TimelineClip[];
  syncOffsetMs: number;          // Lane-level sync offset
}

/**
 * Full timeline state for a game
 */
export interface GameTimeline {
  gameId: string;
  videoGroupId: string;          // Links to video_groups table
  totalDurationMs: number;
  lanes: CameraLane[];
  isTimelineMode: boolean;
}

/**
 * Timeline playback state (UI-only, not persisted)
 */
export interface TimelinePlaybackState {
  playheadPositionMs: number;
  isPlaying: boolean;
  playbackRate: number;          // 0.5, 1, 1.5, 2
  zoomLevel: number;             // 1 = full view, 2 = 2x zoom, etc.
  scrollPositionMs: number;      // For horizontal scrolling
  selectedClipId: string | null;
  activeLane: number;            // Which lane is currently selected for playback
}

/**
 * Result of finding which clip plays at a given time
 */
export interface ActiveClipInfo {
  clip: TimelineClip | null;
  clipTimeMs: number;            // Position within the clip
  isInGap: boolean;
  nextClipStartMs: number | null; // When next clip starts (for gap message)
}

/**
 * Database row types (matching Supabase schema)
 */
export interface VideoGroupMemberRow {
  id: string;
  video_group_id: string;
  video_id: string;
  sequence_order: number;
  start_offset_ms: number | null;
  end_offset_ms: number | null;
  include_audio: boolean;
  audio_volume: number;
  sync_point_ms: number | null;
  created_at: string;
  // New timeline fields
  camera_lane: number;
  lane_position_ms: number;
  camera_label: string | null;
}

export interface VideoGroupRow {
  id: string;
  name: string;
  team_id: string;
  group_type: 'sequence' | 'overlay' | 'multi_angle';
  primary_video_id: string | null;
  layout_preset: string | null;
  has_merged_video: boolean;
  merged_video_id: string | null;
  created_at: string;
  updated_at: string;
  // New timeline fields
  is_timeline_mode: boolean;
  total_duration_ms: number | null;
  game_id: string | null;
}

/**
 * Data for creating a new clip on the timeline
 */
export interface CreateClipData {
  videoId: string;
  cameraLane: number;
  positionMs: number;
  label?: string;
}

/**
 * Data for moving a clip
 */
export interface MoveClipData {
  clipId: string;
  newLane: number;
  newPositionMs: number;
  originalLane?: number;  // For validating lane changes
}

/**
 * Data for trimming a clip
 */
export interface TrimClipData {
  clipId: string;
  startOffsetMs: number;
  endOffsetMs: number | null;
}

/**
 * Default lane labels
 */
export const DEFAULT_LANE_LABELS: Record<number, string> = {
  1: 'Camera 1',
  2: 'Camera 2',
  3: 'Camera 3',
  4: 'Camera 4',
  5: 'Camera 5',
};

/**
 * Suggested lane labels (for dropdown)
 * These represent common camera positions/angles at youth football games
 */
export const SUGGESTED_LANE_LABELS = [
  'Sideline',
  'End Zone',
  'Press Box',
  'Aerial',
  'All-22',
  'Parent/Fan',
  'Game Broadcast',
  'Coaches Film',
];

/**
 * Timeline constants
 */
export const TIMELINE_CONSTANTS = {
  MAX_LANES: 5,
  MIN_CLIP_WIDTH_PX: 30,        // Minimum visual width for a clip (smaller = more accurate)
  SNAP_GRID_MS: 1000,           // Snap to 1 second grid
  ZOOM_LEVELS: [1, 2, 4, 8, 16], // Zoom levels (1x = fit 60min game in ~900px)
  DEFAULT_ZOOM: 1,              // Default zoom
  PIXELS_PER_SECOND_BASE: 0.25, // 60min game = ~900px at 1x zoom (fits single screen)
};

/**
 * Format milliseconds to display time
 */
export function formatTimeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse time string to milliseconds
 */
export function parseTimeToMs(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  } else if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  return 0;
}

/**
 * Snap time to grid
 */
export function snapToGrid(timeMs: number, gridMs: number = TIMELINE_CONSTANTS.SNAP_GRID_MS): number {
  return Math.round(timeMs / gridMs) * gridMs;
}

/**
 * Calculate pixels from time based on zoom level
 */
export function timeToPixels(timeMs: number, zoomLevel: number): number {
  return (timeMs / 1000) * TIMELINE_CONSTANTS.PIXELS_PER_SECOND_BASE * zoomLevel;
}

/**
 * Calculate time from pixels based on zoom level
 */
export function pixelsToTime(pixels: number, zoomLevel: number): number {
  return (pixels / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND_BASE * zoomLevel)) * 1000;
}

/**
 * Find which clip (if any) covers a given game timeline position on a specific lane.
 * Used for automatic clip switching when user drags timeline or video ends.
 */
export function findActiveClipForTime(
  lanes: CameraLane[],
  laneNumber: number,
  gameTimeMs: number
): ActiveClipInfo {
  const lane = lanes.find(l => l.lane === laneNumber);

  if (!lane || lane.clips.length === 0) {
    return {
      clip: null,
      clipTimeMs: 0,
      isInGap: true,
      nextClipStartMs: null,
    };
  }

  // Sort clips by position to ensure correct ordering
  const sortedClips = [...lane.clips].sort((a, b) => a.lanePositionMs - b.lanePositionMs);

  // Find clip that covers the target time
  for (const clip of sortedClips) {
    const clipStart = clip.lanePositionMs;
    const clipEnd = clip.lanePositionMs + clip.durationMs;

    if (gameTimeMs >= clipStart && gameTimeMs < clipEnd) {
      return {
        clip,
        clipTimeMs: gameTimeMs - clipStart, // Position within clip
        isInGap: false,
        nextClipStartMs: null,
      };
    }
  }

  // Not in any clip - find next clip start (if any)
  const futureClips = sortedClips.filter(c => c.lanePositionMs > gameTimeMs);
  const nextClipStartMs = futureClips.length > 0 ? futureClips[0].lanePositionMs : null;

  return {
    clip: null,
    clipTimeMs: 0,
    isInGap: true,
    nextClipStartMs,
  };
}

/**
 * Find the lane number that contains a specific video
 */
export function findLaneForVideo(
  lanes: CameraLane[],
  videoId: string
): number | null {
  for (const lane of lanes) {
    if (lane.clips.some(c => c.videoId === videoId)) {
      return lane.lane;
    }
  }
  return null;
}
