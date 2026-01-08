/**
 * FilmContext Types
 *
 * Type definitions for the film tagging page state machine.
 * Organized into logical groupings as identified in FILM_STATE_MACHINE.md
 *
 * @module components/film/context/types
 * @since Phase 3 - Component Decomposition
 */

import type {
  Game,
  Video,
  PlaybookPlay,
  PlayInstance,
  PlayerRecord,
  Drive,
  VideoTimelineMarker,
} from '@/types/football';
import type { CameraLane } from '@/types/timeline';

// ============================================
// LOADING STATES
// ============================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingStates {
  game: LoadingState;
  videos: LoadingState;
  plays: LoadingState;
  players: LoadingState;
  formations: LoadingState;
  playInstances: LoadingState;
  drives: LoadingState;
  markers: LoadingState;
}

// ============================================
// CORE DATA STATE (Fetched from DB)
// ============================================

export interface CoreDataState {
  /** Current game being tagged */
  game: Game | null;
  /** All videos for this game */
  videos: Video[];
  /** Playbook plays for reference */
  plays: PlaybookPlay[];
  /** Tagged play instances on timeline */
  playInstances: PlayInstance[];
  /** Team roster */
  players: PlayerRecord[];
  /** Available formations */
  formations: string[];
  /** Drive records for game */
  drives: Drive[];
  /** Timeline markers (quarters, etc.) */
  markers: VideoTimelineMarker[];
  /** Loading states for each data type */
  loading: LoadingStates;
  /** Error message if any fetch failed */
  error: string | null;
}

// ============================================
// VIDEO PLAYBACK STATE
// ============================================

export interface VideoPlaybackState {
  /** Currently playing video */
  selectedVideo: Video | null;
  /** Signed URL for video element */
  videoUrl: string;
  /** Error message if video load fails */
  videoLoadError: string | null;
  /** Timestamp when URL was generated (for refresh) */
  urlGeneratedAt: number | null;
  /** Whether error retry has been attempted */
  urlRefreshAttempted: boolean;
  /** Current playback position (seconds) */
  currentTime: number;
  /** Total video length (seconds) */
  videoDuration: number;
  /** Play/pause state */
  isPlaying: boolean;
}

// ============================================
// CAMERA SYNC STATE
// ============================================

export interface CameraSyncState {
  /** Video position on game timeline (ms) */
  videoOffsetMs: number;
  /** Duration of current clip (ms) */
  clipDurationMs: number;
  /** Which video the offset data belongs to */
  offsetDataVideoId: string | null;
  /** Camera switch in progress */
  isSwitchingCamera: boolean;
  /** Target camera during switch */
  pendingCameraId: string | null;
  /** Seek position after switch */
  pendingSyncSeek: number | null;
  /** Auto-play after switch */
  shouldResumePlayback: boolean;
  /** Target time for coverage check */
  targetGameTimeMs: number | null;
  /** Current position on unified timeline (ms) */
  gameTimelinePositionMs: number;
  /** Total timeline duration (ms) */
  timelineDurationMs: number;
}

// ============================================
// MULTI-CAMERA TIMELINE STATE
// ============================================

export interface TimelineState {
  /** Timeline swimlanes with clips */
  timelineLanes: CameraLane[];
  /** Active camera lane number */
  currentLaneNumber: number;
  /** Playing through coverage gap */
  isVirtuallyPlaying: boolean;
}

// ============================================
// TAGGING FORM STATE
// ============================================

export type TaggingMode = 'offense' | 'defense' | 'specialTeams';
export type DriveAssignMode = 'new' | 'current' | 'select';

export interface TaggingFormState {
  /** Start timestamp of current tag */
  tagStartTime: number;
  /** End timestamp (optional) */
  tagEndTime: number | null;
  /** Modal visibility */
  showTagModal: boolean;
  /** Play being edited (null for new) */
  editingInstance: PlayInstance | null;
  /** Current tagging mode */
  taggingMode: TaggingMode;
  /** Tagging opponent's play */
  isTaggingOpponent: boolean;
  /** Prevent double-submit */
  isSavingPlay: boolean;
  /** Drive assignment mode */
  driveAssignMode: DriveAssignMode;
  /** Active drive */
  currentDrive: Drive | null;
}

// ============================================
// UI STATE
// ============================================

export interface QuarterScore {
  quarter: number;
  teamScore: number;
  opponentScore: number;
}

export interface ScoreMismatch {
  field: 'team' | 'opponent';
  calculated: number;
  stored: number;
}

export interface UIState {
  /** Quarter marker menu visible */
  showPeriodMarkerMenu: boolean;
  /** Add marker menu visible */
  showAddMarkerMenu: boolean;
  /** Quarter-by-quarter scores */
  quarterScores: QuarterScore[];
  /** Score mismatch warning */
  scoreMismatch: ScoreMismatch | null;
  /** Tier for analytics features */
  analyticsTier: 'quick' | 'standard' | 'comprehensive';
  /** Camera limit based on subscription */
  cameraLimit: number;
}

// ============================================
// COMBINED FILM STATE
// ============================================

export interface FilmState {
  /** Core data from database */
  data: CoreDataState;
  /** Video playback controls */
  playback: VideoPlaybackState;
  /** Camera synchronization */
  camera: CameraSyncState;
  /** Timeline lanes and navigation */
  timeline: TimelineState;
  /** Play tagging form */
  tagging: TaggingFormState;
  /** General UI state */
  ui: UIState;
}

// ============================================
// INITIAL STATES
// ============================================

export const initialLoadingStates: LoadingStates = {
  game: 'idle',
  videos: 'idle',
  plays: 'idle',
  players: 'idle',
  formations: 'idle',
  playInstances: 'idle',
  drives: 'idle',
  markers: 'idle',
};

export const initialCoreDataState: CoreDataState = {
  game: null,
  videos: [],
  plays: [],
  playInstances: [],
  players: [],
  formations: [],
  drives: [],
  markers: [],
  loading: initialLoadingStates,
  error: null,
};

export const initialVideoPlaybackState: VideoPlaybackState = {
  selectedVideo: null,
  videoUrl: '',
  videoLoadError: null,
  urlGeneratedAt: null,
  urlRefreshAttempted: false,
  currentTime: 0,
  videoDuration: 0,
  isPlaying: false,
};

export const initialCameraSyncState: CameraSyncState = {
  videoOffsetMs: 0,
  clipDurationMs: 0,
  offsetDataVideoId: null,
  isSwitchingCamera: false,
  pendingCameraId: null,
  pendingSyncSeek: null,
  shouldResumePlayback: false,
  targetGameTimeMs: null,
  gameTimelinePositionMs: 0,
  timelineDurationMs: 0,
};

export const initialTimelineState: TimelineState = {
  timelineLanes: [],
  currentLaneNumber: 1,
  isVirtuallyPlaying: false,
};

export const initialTaggingFormState: TaggingFormState = {
  tagStartTime: 0,
  tagEndTime: null,
  showTagModal: false,
  editingInstance: null,
  taggingMode: 'offense',
  isTaggingOpponent: false,
  isSavingPlay: false,
  driveAssignMode: 'current',
  currentDrive: null,
};

export const initialUIState: UIState = {
  showPeriodMarkerMenu: false,
  showAddMarkerMenu: false,
  quarterScores: [],
  scoreMismatch: null,
  analyticsTier: 'standard',
  cameraLimit: 1,
};

export const initialFilmState: FilmState = {
  data: initialCoreDataState,
  playback: initialVideoPlaybackState,
  camera: initialCameraSyncState,
  timeline: initialTimelineState,
  tagging: initialTaggingFormState,
  ui: initialUIState,
};
