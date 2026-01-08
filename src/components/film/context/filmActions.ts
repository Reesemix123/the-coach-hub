/**
 * Film Context Actions
 *
 * Typed action definitions for the film state reducer.
 * Actions are grouped by state category for organization.
 *
 * @module components/film/context/filmActions
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
import type {
  LoadingState,
  TaggingMode,
  DriveAssignMode,
  QuarterScore,
  ScoreMismatch,
} from './types';

// ============================================
// ACTION TYPES
// ============================================

// Data Loading Actions
export const SET_LOADING = 'SET_LOADING' as const;
export const SET_ERROR = 'SET_ERROR' as const;
export const CLEAR_ERROR = 'CLEAR_ERROR' as const;

// Core Data Actions
export const SET_GAME = 'SET_GAME' as const;
export const SET_VIDEOS = 'SET_VIDEOS' as const;
export const SET_PLAYS = 'SET_PLAYS' as const;
export const SET_PLAY_INSTANCES = 'SET_PLAY_INSTANCES' as const;
export const ADD_PLAY_INSTANCE = 'ADD_PLAY_INSTANCE' as const;
export const UPDATE_PLAY_INSTANCE = 'UPDATE_PLAY_INSTANCE' as const;
export const DELETE_PLAY_INSTANCE = 'DELETE_PLAY_INSTANCE' as const;
export const SET_PLAYERS = 'SET_PLAYERS' as const;
export const SET_FORMATIONS = 'SET_FORMATIONS' as const;
export const SET_DRIVES = 'SET_DRIVES' as const;
export const ADD_DRIVE = 'ADD_DRIVE' as const;
export const UPDATE_DRIVE = 'UPDATE_DRIVE' as const;
export const SET_MARKERS = 'SET_MARKERS' as const;
export const ADD_MARKER = 'ADD_MARKER' as const;
export const DELETE_MARKER = 'DELETE_MARKER' as const;

// Video Playback Actions
export const SET_SELECTED_VIDEO = 'SET_SELECTED_VIDEO' as const;
export const SET_VIDEO_URL = 'SET_VIDEO_URL' as const;
export const SET_VIDEO_LOAD_ERROR = 'SET_VIDEO_LOAD_ERROR' as const;
export const SET_URL_GENERATED_AT = 'SET_URL_GENERATED_AT' as const;
export const SET_URL_REFRESH_ATTEMPTED = 'SET_URL_REFRESH_ATTEMPTED' as const;
export const SET_CURRENT_TIME = 'SET_CURRENT_TIME' as const;
export const SET_VIDEO_DURATION = 'SET_VIDEO_DURATION' as const;
export const SET_IS_PLAYING = 'SET_IS_PLAYING' as const;
export const LOAD_VIDEO = 'LOAD_VIDEO' as const;

// Camera Sync Actions
export const SET_VIDEO_OFFSET = 'SET_VIDEO_OFFSET' as const;
export const SET_CLIP_DURATION = 'SET_CLIP_DURATION' as const;
export const SET_OFFSET_DATA_VIDEO_ID = 'SET_OFFSET_DATA_VIDEO_ID' as const;
export const SET_IS_SWITCHING_CAMERA = 'SET_IS_SWITCHING_CAMERA' as const;
export const SET_PENDING_CAMERA_ID = 'SET_PENDING_CAMERA_ID' as const;
export const SET_PENDING_SYNC_SEEK = 'SET_PENDING_SYNC_SEEK' as const;
export const SET_SHOULD_RESUME_PLAYBACK = 'SET_SHOULD_RESUME_PLAYBACK' as const;
export const SET_TARGET_GAME_TIME = 'SET_TARGET_GAME_TIME' as const;
export const SET_GAME_TIMELINE_POSITION = 'SET_GAME_TIMELINE_POSITION' as const;
export const SET_TIMELINE_DURATION = 'SET_TIMELINE_DURATION' as const;
export const START_CAMERA_SWITCH = 'START_CAMERA_SWITCH' as const;
export const COMPLETE_CAMERA_SWITCH = 'COMPLETE_CAMERA_SWITCH' as const;

// Timeline Actions
export const SET_TIMELINE_LANES = 'SET_TIMELINE_LANES' as const;
export const SET_CURRENT_LANE_NUMBER = 'SET_CURRENT_LANE_NUMBER' as const;
export const SET_IS_VIRTUALLY_PLAYING = 'SET_IS_VIRTUALLY_PLAYING' as const;

// Tagging Form Actions
export const SET_TAG_START_TIME = 'SET_TAG_START_TIME' as const;
export const SET_TAG_END_TIME = 'SET_TAG_END_TIME' as const;
export const SET_SHOW_TAG_MODAL = 'SET_SHOW_TAG_MODAL' as const;
export const SET_EDITING_INSTANCE = 'SET_EDITING_INSTANCE' as const;
export const SET_TAGGING_MODE = 'SET_TAGGING_MODE' as const;
export const SET_IS_TAGGING_OPPONENT = 'SET_IS_TAGGING_OPPONENT' as const;
export const SET_IS_SAVING_PLAY = 'SET_IS_SAVING_PLAY' as const;
export const SET_DRIVE_ASSIGN_MODE = 'SET_DRIVE_ASSIGN_MODE' as const;
export const SET_CURRENT_DRIVE = 'SET_CURRENT_DRIVE' as const;
export const OPEN_TAG_MODAL = 'OPEN_TAG_MODAL' as const;
export const CLOSE_TAG_MODAL = 'CLOSE_TAG_MODAL' as const;

// UI Actions
export const SET_SHOW_PERIOD_MARKER_MENU = 'SET_SHOW_PERIOD_MARKER_MENU' as const;
export const SET_SHOW_ADD_MARKER_MENU = 'SET_SHOW_ADD_MARKER_MENU' as const;
export const SET_QUARTER_SCORES = 'SET_QUARTER_SCORES' as const;
export const SET_SCORE_MISMATCH = 'SET_SCORE_MISMATCH' as const;
export const SET_ANALYTICS_TIER = 'SET_ANALYTICS_TIER' as const;
export const SET_CAMERA_LIMIT = 'SET_CAMERA_LIMIT' as const;

// Batch/Reset Actions
export const RESET_STATE = 'RESET_STATE' as const;
export const INITIALIZE_FROM_DATA = 'INITIALIZE_FROM_DATA' as const;

// ============================================
// ACTION INTERFACES
// ============================================

type DataKey = 'game' | 'videos' | 'plays' | 'players' | 'formations' | 'playInstances' | 'drives' | 'markers';

// Data Loading
interface SetLoadingAction {
  type: typeof SET_LOADING;
  payload: { key: DataKey; state: LoadingState };
}

interface SetErrorAction {
  type: typeof SET_ERROR;
  payload: string;
}

interface ClearErrorAction {
  type: typeof CLEAR_ERROR;
}

// Core Data
interface SetGameAction {
  type: typeof SET_GAME;
  payload: Game | null;
}

interface SetVideosAction {
  type: typeof SET_VIDEOS;
  payload: Video[];
}

interface SetPlaysAction {
  type: typeof SET_PLAYS;
  payload: PlaybookPlay[];
}

interface SetPlayInstancesAction {
  type: typeof SET_PLAY_INSTANCES;
  payload: PlayInstance[];
}

interface AddPlayInstanceAction {
  type: typeof ADD_PLAY_INSTANCE;
  payload: PlayInstance;
}

interface UpdatePlayInstanceAction {
  type: typeof UPDATE_PLAY_INSTANCE;
  payload: PlayInstance;
}

interface DeletePlayInstanceAction {
  type: typeof DELETE_PLAY_INSTANCE;
  payload: string; // playId
}

interface SetPlayersAction {
  type: typeof SET_PLAYERS;
  payload: PlayerRecord[];
}

interface SetFormationsAction {
  type: typeof SET_FORMATIONS;
  payload: string[];
}

interface SetDrivesAction {
  type: typeof SET_DRIVES;
  payload: Drive[];
}

interface AddDriveAction {
  type: typeof ADD_DRIVE;
  payload: Drive;
}

interface UpdateDriveAction {
  type: typeof UPDATE_DRIVE;
  payload: Drive;
}

interface SetMarkersAction {
  type: typeof SET_MARKERS;
  payload: VideoTimelineMarker[];
}

interface AddMarkerAction {
  type: typeof ADD_MARKER;
  payload: VideoTimelineMarker;
}

interface DeleteMarkerAction {
  type: typeof DELETE_MARKER;
  payload: string; // markerId
}

// Video Playback
interface SetSelectedVideoAction {
  type: typeof SET_SELECTED_VIDEO;
  payload: Video | null;
}

interface SetVideoUrlAction {
  type: typeof SET_VIDEO_URL;
  payload: string;
}

interface SetVideoLoadErrorAction {
  type: typeof SET_VIDEO_LOAD_ERROR;
  payload: string | null;
}

interface SetUrlGeneratedAtAction {
  type: typeof SET_URL_GENERATED_AT;
  payload: number | null;
}

interface SetUrlRefreshAttemptedAction {
  type: typeof SET_URL_REFRESH_ATTEMPTED;
  payload: boolean;
}

interface SetCurrentTimeAction {
  type: typeof SET_CURRENT_TIME;
  payload: number;
}

interface SetVideoDurationAction {
  type: typeof SET_VIDEO_DURATION;
  payload: number;
}

interface SetIsPlayingAction {
  type: typeof SET_IS_PLAYING;
  payload: boolean;
}

interface LoadVideoAction {
  type: typeof LOAD_VIDEO;
  payload: {
    video: Video;
    url: string;
    generatedAt: number;
  };
}

// Camera Sync
interface SetVideoOffsetAction {
  type: typeof SET_VIDEO_OFFSET;
  payload: number;
}

interface SetClipDurationAction {
  type: typeof SET_CLIP_DURATION;
  payload: number;
}

interface SetOffsetDataVideoIdAction {
  type: typeof SET_OFFSET_DATA_VIDEO_ID;
  payload: string | null;
}

interface SetIsSwitchingCameraAction {
  type: typeof SET_IS_SWITCHING_CAMERA;
  payload: boolean;
}

interface SetPendingCameraIdAction {
  type: typeof SET_PENDING_CAMERA_ID;
  payload: string | null;
}

interface SetPendingSyncSeekAction {
  type: typeof SET_PENDING_SYNC_SEEK;
  payload: number | null;
}

interface SetShouldResumePlaybackAction {
  type: typeof SET_SHOULD_RESUME_PLAYBACK;
  payload: boolean;
}

interface SetTargetGameTimeAction {
  type: typeof SET_TARGET_GAME_TIME;
  payload: number | null;
}

interface SetGameTimelinePositionAction {
  type: typeof SET_GAME_TIMELINE_POSITION;
  payload: number;
}

interface SetTimelineDurationAction {
  type: typeof SET_TIMELINE_DURATION;
  payload: number;
}

interface StartCameraSwitchAction {
  type: typeof START_CAMERA_SWITCH;
  payload: {
    targetCameraId: string;
    targetGameTimeMs: number;
    shouldResumePlayback: boolean;
  };
}

interface CompleteCameraSwitchAction {
  type: typeof COMPLETE_CAMERA_SWITCH;
  payload: {
    videoOffsetMs: number;
    clipDurationMs: number;
  };
}

// Timeline
interface SetTimelineLanesAction {
  type: typeof SET_TIMELINE_LANES;
  payload: CameraLane[];
}

interface SetCurrentLaneNumberAction {
  type: typeof SET_CURRENT_LANE_NUMBER;
  payload: number;
}

interface SetIsVirtuallyPlayingAction {
  type: typeof SET_IS_VIRTUALLY_PLAYING;
  payload: boolean;
}

// Tagging Form
interface SetTagStartTimeAction {
  type: typeof SET_TAG_START_TIME;
  payload: number;
}

interface SetTagEndTimeAction {
  type: typeof SET_TAG_END_TIME;
  payload: number | null;
}

interface SetShowTagModalAction {
  type: typeof SET_SHOW_TAG_MODAL;
  payload: boolean;
}

interface SetEditingInstanceAction {
  type: typeof SET_EDITING_INSTANCE;
  payload: PlayInstance | null;
}

interface SetTaggingModeAction {
  type: typeof SET_TAGGING_MODE;
  payload: TaggingMode;
}

interface SetIsTaggingOpponentAction {
  type: typeof SET_IS_TAGGING_OPPONENT;
  payload: boolean;
}

interface SetIsSavingPlayAction {
  type: typeof SET_IS_SAVING_PLAY;
  payload: boolean;
}

interface SetDriveAssignModeAction {
  type: typeof SET_DRIVE_ASSIGN_MODE;
  payload: DriveAssignMode;
}

interface SetCurrentDriveAction {
  type: typeof SET_CURRENT_DRIVE;
  payload: Drive | null;
}

interface OpenTagModalAction {
  type: typeof OPEN_TAG_MODAL;
  payload: {
    startTime: number;
    endTime?: number | null;
    editingInstance?: PlayInstance | null;
  };
}

interface CloseTagModalAction {
  type: typeof CLOSE_TAG_MODAL;
}

// UI
interface SetShowPeriodMarkerMenuAction {
  type: typeof SET_SHOW_PERIOD_MARKER_MENU;
  payload: boolean;
}

interface SetShowAddMarkerMenuAction {
  type: typeof SET_SHOW_ADD_MARKER_MENU;
  payload: boolean;
}

interface SetQuarterScoresAction {
  type: typeof SET_QUARTER_SCORES;
  payload: QuarterScore[];
}

interface SetScoreMismatchAction {
  type: typeof SET_SCORE_MISMATCH;
  payload: ScoreMismatch | null;
}

interface SetAnalyticsTierAction {
  type: typeof SET_ANALYTICS_TIER;
  payload: 'quick' | 'standard' | 'comprehensive';
}

interface SetCameraLimitAction {
  type: typeof SET_CAMERA_LIMIT;
  payload: number;
}

// Batch/Reset
interface ResetStateAction {
  type: typeof RESET_STATE;
}

interface InitializeFromDataAction {
  type: typeof INITIALIZE_FROM_DATA;
  payload: {
    game: Game;
    videos: Video[];
    drives: Drive[];
    cameraLimit: number;
  };
}

// ============================================
// UNION TYPE
// ============================================

export type FilmAction =
  // Loading
  | SetLoadingAction
  | SetErrorAction
  | ClearErrorAction
  // Core Data
  | SetGameAction
  | SetVideosAction
  | SetPlaysAction
  | SetPlayInstancesAction
  | AddPlayInstanceAction
  | UpdatePlayInstanceAction
  | DeletePlayInstanceAction
  | SetPlayersAction
  | SetFormationsAction
  | SetDrivesAction
  | AddDriveAction
  | UpdateDriveAction
  | SetMarkersAction
  | AddMarkerAction
  | DeleteMarkerAction
  // Video Playback
  | SetSelectedVideoAction
  | SetVideoUrlAction
  | SetVideoLoadErrorAction
  | SetUrlGeneratedAtAction
  | SetUrlRefreshAttemptedAction
  | SetCurrentTimeAction
  | SetVideoDurationAction
  | SetIsPlayingAction
  | LoadVideoAction
  // Camera Sync
  | SetVideoOffsetAction
  | SetClipDurationAction
  | SetOffsetDataVideoIdAction
  | SetIsSwitchingCameraAction
  | SetPendingCameraIdAction
  | SetPendingSyncSeekAction
  | SetShouldResumePlaybackAction
  | SetTargetGameTimeAction
  | SetGameTimelinePositionAction
  | SetTimelineDurationAction
  | StartCameraSwitchAction
  | CompleteCameraSwitchAction
  // Timeline
  | SetTimelineLanesAction
  | SetCurrentLaneNumberAction
  | SetIsVirtuallyPlayingAction
  // Tagging Form
  | SetTagStartTimeAction
  | SetTagEndTimeAction
  | SetShowTagModalAction
  | SetEditingInstanceAction
  | SetTaggingModeAction
  | SetIsTaggingOpponentAction
  | SetIsSavingPlayAction
  | SetDriveAssignModeAction
  | SetCurrentDriveAction
  | OpenTagModalAction
  | CloseTagModalAction
  // UI
  | SetShowPeriodMarkerMenuAction
  | SetShowAddMarkerMenuAction
  | SetQuarterScoresAction
  | SetScoreMismatchAction
  | SetAnalyticsTierAction
  | SetCameraLimitAction
  // Batch/Reset
  | ResetStateAction
  | InitializeFromDataAction;

// ============================================
// ACTION CREATORS
// ============================================

// Data Loading
export const setLoading = (key: DataKey, state: LoadingState): SetLoadingAction => ({
  type: SET_LOADING,
  payload: { key, state },
});

export const setError = (error: string): SetErrorAction => ({
  type: SET_ERROR,
  payload: error,
});

export const clearError = (): ClearErrorAction => ({
  type: CLEAR_ERROR,
});

// Core Data
export const setGame = (game: Game | null): SetGameAction => ({
  type: SET_GAME,
  payload: game,
});

export const setVideos = (videos: Video[]): SetVideosAction => ({
  type: SET_VIDEOS,
  payload: videos,
});

export const setPlays = (plays: PlaybookPlay[]): SetPlaysAction => ({
  type: SET_PLAYS,
  payload: plays,
});

export const setPlayInstances = (instances: PlayInstance[]): SetPlayInstancesAction => ({
  type: SET_PLAY_INSTANCES,
  payload: instances,
});

export const addPlayInstance = (instance: PlayInstance): AddPlayInstanceAction => ({
  type: ADD_PLAY_INSTANCE,
  payload: instance,
});

export const updatePlayInstance = (instance: PlayInstance): UpdatePlayInstanceAction => ({
  type: UPDATE_PLAY_INSTANCE,
  payload: instance,
});

export const deletePlayInstance = (playId: string): DeletePlayInstanceAction => ({
  type: DELETE_PLAY_INSTANCE,
  payload: playId,
});

export const setPlayers = (players: PlayerRecord[]): SetPlayersAction => ({
  type: SET_PLAYERS,
  payload: players,
});

export const setFormations = (formations: string[]): SetFormationsAction => ({
  type: SET_FORMATIONS,
  payload: formations,
});

export const setDrives = (drives: Drive[]): SetDrivesAction => ({
  type: SET_DRIVES,
  payload: drives,
});

export const addDrive = (drive: Drive): AddDriveAction => ({
  type: ADD_DRIVE,
  payload: drive,
});

export const updateDrive = (drive: Drive): UpdateDriveAction => ({
  type: UPDATE_DRIVE,
  payload: drive,
});

export const setMarkers = (markers: VideoTimelineMarker[]): SetMarkersAction => ({
  type: SET_MARKERS,
  payload: markers,
});

export const addMarker = (marker: VideoTimelineMarker): AddMarkerAction => ({
  type: ADD_MARKER,
  payload: marker,
});

export const deleteMarker = (markerId: string): DeleteMarkerAction => ({
  type: DELETE_MARKER,
  payload: markerId,
});

// Video Playback
export const setSelectedVideo = (video: Video | null): SetSelectedVideoAction => ({
  type: SET_SELECTED_VIDEO,
  payload: video,
});

export const setVideoUrl = (url: string): SetVideoUrlAction => ({
  type: SET_VIDEO_URL,
  payload: url,
});

export const setVideoLoadError = (error: string | null): SetVideoLoadErrorAction => ({
  type: SET_VIDEO_LOAD_ERROR,
  payload: error,
});

export const setUrlGeneratedAt = (timestamp: number | null): SetUrlGeneratedAtAction => ({
  type: SET_URL_GENERATED_AT,
  payload: timestamp,
});

export const setUrlRefreshAttempted = (attempted: boolean): SetUrlRefreshAttemptedAction => ({
  type: SET_URL_REFRESH_ATTEMPTED,
  payload: attempted,
});

export const setCurrentTime = (time: number): SetCurrentTimeAction => ({
  type: SET_CURRENT_TIME,
  payload: time,
});

export const setVideoDuration = (duration: number): SetVideoDurationAction => ({
  type: SET_VIDEO_DURATION,
  payload: duration,
});

export const setIsPlaying = (playing: boolean): SetIsPlayingAction => ({
  type: SET_IS_PLAYING,
  payload: playing,
});

export const loadVideo = (
  video: Video,
  url: string,
  generatedAt: number
): LoadVideoAction => ({
  type: LOAD_VIDEO,
  payload: { video, url, generatedAt },
});

// Camera Sync
export const setVideoOffset = (offsetMs: number): SetVideoOffsetAction => ({
  type: SET_VIDEO_OFFSET,
  payload: offsetMs,
});

export const setClipDuration = (durationMs: number): SetClipDurationAction => ({
  type: SET_CLIP_DURATION,
  payload: durationMs,
});

export const setOffsetDataVideoId = (videoId: string | null): SetOffsetDataVideoIdAction => ({
  type: SET_OFFSET_DATA_VIDEO_ID,
  payload: videoId,
});

export const setIsSwitchingCamera = (switching: boolean): SetIsSwitchingCameraAction => ({
  type: SET_IS_SWITCHING_CAMERA,
  payload: switching,
});

export const setPendingCameraId = (cameraId: string | null): SetPendingCameraIdAction => ({
  type: SET_PENDING_CAMERA_ID,
  payload: cameraId,
});

export const setPendingSyncSeek = (seekTime: number | null): SetPendingSyncSeekAction => ({
  type: SET_PENDING_SYNC_SEEK,
  payload: seekTime,
});

export const setShouldResumePlayback = (resume: boolean): SetShouldResumePlaybackAction => ({
  type: SET_SHOULD_RESUME_PLAYBACK,
  payload: resume,
});

export const setTargetGameTime = (timeMs: number | null): SetTargetGameTimeAction => ({
  type: SET_TARGET_GAME_TIME,
  payload: timeMs,
});

export const setGameTimelinePosition = (positionMs: number): SetGameTimelinePositionAction => ({
  type: SET_GAME_TIMELINE_POSITION,
  payload: positionMs,
});

export const setTimelineDuration = (durationMs: number): SetTimelineDurationAction => ({
  type: SET_TIMELINE_DURATION,
  payload: durationMs,
});

export const startCameraSwitch = (
  targetCameraId: string,
  targetGameTimeMs: number,
  shouldResumePlayback: boolean
): StartCameraSwitchAction => ({
  type: START_CAMERA_SWITCH,
  payload: { targetCameraId, targetGameTimeMs, shouldResumePlayback },
});

export const completeCameraSwitch = (
  videoOffsetMs: number,
  clipDurationMs: number
): CompleteCameraSwitchAction => ({
  type: COMPLETE_CAMERA_SWITCH,
  payload: { videoOffsetMs, clipDurationMs },
});

// Timeline
export const setTimelineLanes = (lanes: CameraLane[]): SetTimelineLanesAction => ({
  type: SET_TIMELINE_LANES,
  payload: lanes,
});

export const setCurrentLaneNumber = (lane: number): SetCurrentLaneNumberAction => ({
  type: SET_CURRENT_LANE_NUMBER,
  payload: lane,
});

export const setIsVirtuallyPlaying = (playing: boolean): SetIsVirtuallyPlayingAction => ({
  type: SET_IS_VIRTUALLY_PLAYING,
  payload: playing,
});

// Tagging Form
export const setTagStartTime = (time: number): SetTagStartTimeAction => ({
  type: SET_TAG_START_TIME,
  payload: time,
});

export const setTagEndTime = (time: number | null): SetTagEndTimeAction => ({
  type: SET_TAG_END_TIME,
  payload: time,
});

export const setShowTagModal = (show: boolean): SetShowTagModalAction => ({
  type: SET_SHOW_TAG_MODAL,
  payload: show,
});

export const setEditingInstance = (instance: PlayInstance | null): SetEditingInstanceAction => ({
  type: SET_EDITING_INSTANCE,
  payload: instance,
});

export const setTaggingMode = (mode: TaggingMode): SetTaggingModeAction => ({
  type: SET_TAGGING_MODE,
  payload: mode,
});

export const setIsTaggingOpponent = (isOpponent: boolean): SetIsTaggingOpponentAction => ({
  type: SET_IS_TAGGING_OPPONENT,
  payload: isOpponent,
});

export const setIsSavingPlay = (saving: boolean): SetIsSavingPlayAction => ({
  type: SET_IS_SAVING_PLAY,
  payload: saving,
});

export const setDriveAssignMode = (mode: DriveAssignMode): SetDriveAssignModeAction => ({
  type: SET_DRIVE_ASSIGN_MODE,
  payload: mode,
});

export const setCurrentDrive = (drive: Drive | null): SetCurrentDriveAction => ({
  type: SET_CURRENT_DRIVE,
  payload: drive,
});

export const openTagModal = (
  startTime: number,
  endTime?: number | null,
  editingInstance?: PlayInstance | null
): OpenTagModalAction => ({
  type: OPEN_TAG_MODAL,
  payload: { startTime, endTime, editingInstance },
});

export const closeTagModal = (): CloseTagModalAction => ({
  type: CLOSE_TAG_MODAL,
});

// UI
export const setShowPeriodMarkerMenu = (show: boolean): SetShowPeriodMarkerMenuAction => ({
  type: SET_SHOW_PERIOD_MARKER_MENU,
  payload: show,
});

export const setShowAddMarkerMenu = (show: boolean): SetShowAddMarkerMenuAction => ({
  type: SET_SHOW_ADD_MARKER_MENU,
  payload: show,
});

export const setQuarterScores = (scores: QuarterScore[]): SetQuarterScoresAction => ({
  type: SET_QUARTER_SCORES,
  payload: scores,
});

export const setScoreMismatch = (mismatch: ScoreMismatch | null): SetScoreMismatchAction => ({
  type: SET_SCORE_MISMATCH,
  payload: mismatch,
});

export const setAnalyticsTier = (tier: 'quick' | 'standard' | 'comprehensive'): SetAnalyticsTierAction => ({
  type: SET_ANALYTICS_TIER,
  payload: tier,
});

export const setCameraLimit = (limit: number): SetCameraLimitAction => ({
  type: SET_CAMERA_LIMIT,
  payload: limit,
});

// Batch/Reset
export const resetState = (): ResetStateAction => ({
  type: RESET_STATE,
});

export const initializeFromData = (
  game: Game,
  videos: Video[],
  drives: Drive[],
  cameraLimit: number
): InitializeFromDataAction => ({
  type: INITIALIZE_FROM_DATA,
  payload: { game, videos, drives, cameraLimit },
});
