'use client';

/**
 * useFilmStateBridge
 *
 * Bridge hook for gradual migration from useState to FilmContext.
 * This hook synchronizes local state with context state, allowing
 * incremental adoption of the new state management.
 *
 * Usage:
 * 1. Wrap page with FilmProvider
 * 2. Replace useState calls with useBridgedState from this hook
 * 3. As migration progresses, switch to direct context usage
 *
 * @module components/film/context/useFilmStateBridge
 * @since Phase 4 - Integration
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useFilmDispatch, useFilmState } from './FilmContext';
import type { FilmState, TaggingMode, DriveAssignMode } from './types';
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
// TYPES
// ============================================

export interface BridgedPlaybackState {
  selectedVideo: Video | null;
  videoUrl: string;
  videoLoadError: string | null;
  currentTime: number;
  videoDuration: number;
  isPlaying: boolean;
  urlGeneratedAt: number | null;
  urlRefreshAttempted: boolean;
}

export interface BridgedCameraState {
  isSwitchingCamera: boolean;
  pendingCameraId: string | null;
  pendingSyncSeek: number | null;
  shouldResumePlayback: boolean;
  targetGameTimeMs: number | null;
  gameTimelinePositionMs: number;
  videoOffsetMs: number;
  clipDurationMs: number;
  timelineDurationMs: number;
  offsetDataVideoId: string | null;
}

export interface BridgedTimelineState {
  timelineLanes: CameraLane[];
  currentLaneNumber: number;
  isVirtuallyPlaying: boolean;
}

export interface BridgedTaggingState {
  showTagModal: boolean;
  editingInstance: PlayInstance | null;
  tagStartTime: number;
  tagEndTime: number | null;
  taggingMode: TaggingMode;
  isTaggingOpponent: boolean;
  isSavingPlay: boolean;
  driveAssignMode: DriveAssignMode;
  currentDrive: Drive | null;
}

export interface BridgedDataState {
  game: Game | null;
  videos: Video[];
  plays: PlaybookPlay[];
  playInstances: PlayInstance[];
  players: PlayerRecord[];
  formations: string[];
  drives: Drive[];
  markers: VideoTimelineMarker[];
}

// ============================================
// BRIDGE HOOK
// ============================================

/**
 * useFilmStateBridge - Sync local state with context
 *
 * This hook provides setters that update both local state (for backward compat)
 * and context state (for new components using context).
 */
export function useFilmStateBridge() {
  const dispatch = useFilmDispatch();
  const contextState = useFilmState();

  // ============================================
  // DATA ACTIONS
  // ============================================

  const setGame = useCallback(
    (game: Game | null) => {
      dispatch({ type: 'SET_GAME', payload: game as FilmState['data']['game'] });
    },
    [dispatch]
  );

  const setVideos = useCallback(
    (videos: Video[]) => {
      dispatch({ type: 'SET_VIDEOS', payload: videos as FilmState['data']['videos'] });
    },
    [dispatch]
  );

  const setPlays = useCallback(
    (plays: PlaybookPlay[]) => {
      dispatch({ type: 'SET_PLAYS', payload: plays });
    },
    [dispatch]
  );

  const setPlayInstances = useCallback(
    (instances: PlayInstance[]) => {
      dispatch({ type: 'SET_PLAY_INSTANCES', payload: instances });
    },
    [dispatch]
  );

  const addPlayInstance = useCallback(
    (instance: PlayInstance) => {
      dispatch({ type: 'ADD_PLAY_INSTANCE', payload: instance });
    },
    [dispatch]
  );

  const updatePlayInstance = useCallback(
    (instance: PlayInstance) => {
      dispatch({ type: 'UPDATE_PLAY_INSTANCE', payload: instance });
    },
    [dispatch]
  );

  const deletePlayInstance = useCallback(
    (playId: string) => {
      dispatch({ type: 'DELETE_PLAY_INSTANCE', payload: playId });
    },
    [dispatch]
  );

  const setPlayers = useCallback(
    (players: PlayerRecord[]) => {
      dispatch({ type: 'SET_PLAYERS', payload: players });
    },
    [dispatch]
  );

  const setFormations = useCallback(
    (formations: string[]) => {
      dispatch({ type: 'SET_FORMATIONS', payload: formations });
    },
    [dispatch]
  );

  const setDrives = useCallback(
    (drives: Drive[]) => {
      dispatch({ type: 'SET_DRIVES', payload: drives });
    },
    [dispatch]
  );

  const addDrive = useCallback(
    (drive: Drive) => {
      dispatch({ type: 'ADD_DRIVE', payload: drive });
    },
    [dispatch]
  );

  const setMarkers = useCallback(
    (markers: VideoTimelineMarker[]) => {
      dispatch({ type: 'SET_MARKERS', payload: markers });
    },
    [dispatch]
  );

  // ============================================
  // PLAYBACK ACTIONS
  // ============================================

  const setSelectedVideo = useCallback(
    (video: Video | null) => {
      dispatch({ type: 'SET_SELECTED_VIDEO', payload: video as FilmState['playback']['selectedVideo'] });
    },
    [dispatch]
  );

  const setVideoUrl = useCallback(
    (url: string) => {
      dispatch({ type: 'SET_VIDEO_URL', payload: url });
    },
    [dispatch]
  );

  const setVideoLoadError = useCallback(
    (error: string | null) => {
      dispatch({ type: 'SET_VIDEO_LOAD_ERROR', payload: error });
    },
    [dispatch]
  );

  const setCurrentTime = useCallback(
    (time: number) => {
      dispatch({ type: 'SET_CURRENT_TIME', payload: time });
    },
    [dispatch]
  );

  const setVideoDuration = useCallback(
    (duration: number) => {
      dispatch({ type: 'SET_VIDEO_DURATION', payload: duration });
    },
    [dispatch]
  );

  const setIsPlaying = useCallback(
    (playing: boolean) => {
      dispatch({ type: 'SET_IS_PLAYING', payload: playing });
    },
    [dispatch]
  );

  const setUrlGeneratedAt = useCallback(
    (timestamp: number | null) => {
      dispatch({ type: 'SET_URL_GENERATED_AT', payload: timestamp });
    },
    [dispatch]
  );

  const setUrlRefreshAttempted = useCallback(
    (attempted: boolean) => {
      dispatch({ type: 'SET_URL_REFRESH_ATTEMPTED', payload: attempted });
    },
    [dispatch]
  );

  // ============================================
  // CAMERA ACTIONS
  // ============================================

  const setIsSwitchingCamera = useCallback(
    (switching: boolean) => {
      dispatch({ type: 'SET_IS_SWITCHING_CAMERA', payload: switching });
    },
    [dispatch]
  );

  const setPendingCameraId = useCallback(
    (cameraId: string | null) => {
      dispatch({ type: 'SET_PENDING_CAMERA_ID', payload: cameraId });
    },
    [dispatch]
  );

  const setPendingSyncSeek = useCallback(
    (seekTime: number | null) => {
      dispatch({ type: 'SET_PENDING_SYNC_SEEK', payload: seekTime });
    },
    [dispatch]
  );

  const setShouldResumePlayback = useCallback(
    (resume: boolean) => {
      dispatch({ type: 'SET_SHOULD_RESUME_PLAYBACK', payload: resume });
    },
    [dispatch]
  );

  const setTargetGameTimeMs = useCallback(
    (timeMs: number | null) => {
      dispatch({ type: 'SET_TARGET_GAME_TIME', payload: timeMs });
    },
    [dispatch]
  );

  const setGameTimelinePositionMs = useCallback(
    (positionMs: number) => {
      dispatch({ type: 'SET_GAME_TIMELINE_POSITION', payload: positionMs });
    },
    [dispatch]
  );

  const setVideoOffsetMs = useCallback(
    (offsetMs: number) => {
      dispatch({ type: 'SET_VIDEO_OFFSET', payload: offsetMs });
    },
    [dispatch]
  );

  const setClipDurationMs = useCallback(
    (durationMs: number) => {
      dispatch({ type: 'SET_CLIP_DURATION', payload: durationMs });
    },
    [dispatch]
  );

  const setTimelineDurationMs = useCallback(
    (durationMs: number) => {
      dispatch({ type: 'SET_TIMELINE_DURATION', payload: durationMs });
    },
    [dispatch]
  );

  const setOffsetDataVideoId = useCallback(
    (videoId: string | null) => {
      dispatch({ type: 'SET_OFFSET_DATA_VIDEO_ID', payload: videoId });
    },
    [dispatch]
  );

  // ============================================
  // TIMELINE ACTIONS
  // ============================================

  const setTimelineLanes = useCallback(
    (lanes: CameraLane[]) => {
      dispatch({ type: 'SET_TIMELINE_LANES', payload: lanes });
    },
    [dispatch]
  );

  const setCurrentLaneNumber = useCallback(
    (lane: number) => {
      dispatch({ type: 'SET_CURRENT_LANE_NUMBER', payload: lane });
    },
    [dispatch]
  );

  const setIsVirtuallyPlaying = useCallback(
    (playing: boolean) => {
      dispatch({ type: 'SET_IS_VIRTUALLY_PLAYING', payload: playing });
    },
    [dispatch]
  );

  // ============================================
  // TAGGING ACTIONS
  // ============================================

  const setShowTagModal = useCallback(
    (show: boolean) => {
      dispatch({ type: 'SET_SHOW_TAG_MODAL', payload: show });
    },
    [dispatch]
  );

  const setEditingInstance = useCallback(
    (instance: PlayInstance | null) => {
      dispatch({ type: 'SET_EDITING_INSTANCE', payload: instance });
    },
    [dispatch]
  );

  const setTagStartTime = useCallback(
    (time: number) => {
      dispatch({ type: 'SET_TAG_START_TIME', payload: time });
    },
    [dispatch]
  );

  const setTagEndTime = useCallback(
    (time: number | null) => {
      dispatch({ type: 'SET_TAG_END_TIME', payload: time });
    },
    [dispatch]
  );

  const setTaggingMode = useCallback(
    (mode: TaggingMode) => {
      dispatch({ type: 'SET_TAGGING_MODE', payload: mode });
    },
    [dispatch]
  );

  const setIsTaggingOpponent = useCallback(
    (isOpponent: boolean) => {
      dispatch({ type: 'SET_IS_TAGGING_OPPONENT', payload: isOpponent });
    },
    [dispatch]
  );

  const setIsSavingPlay = useCallback(
    (saving: boolean) => {
      dispatch({ type: 'SET_IS_SAVING_PLAY', payload: saving });
    },
    [dispatch]
  );

  const setDriveAssignMode = useCallback(
    (mode: DriveAssignMode) => {
      dispatch({ type: 'SET_DRIVE_ASSIGN_MODE', payload: mode });
    },
    [dispatch]
  );

  const setCurrentDrive = useCallback(
    (drive: Drive | null) => {
      dispatch({ type: 'SET_CURRENT_DRIVE', payload: drive });
    },
    [dispatch]
  );

  // ============================================
  // UI ACTIONS
  // ============================================

  const setAnalyticsTier = useCallback(
    (tier: 'quick' | 'standard' | 'comprehensive') => {
      dispatch({ type: 'SET_ANALYTICS_TIER', payload: tier });
    },
    [dispatch]
  );

  const setCameraLimit = useCallback(
    (limit: number) => {
      dispatch({ type: 'SET_CAMERA_LIMIT', payload: limit });
    },
    [dispatch]
  );

  // ============================================
  // RETURN VALUES
  // ============================================

  return useMemo(
    () => ({
      // Context state (read from context)
      state: contextState,

      // Data actions
      setGame,
      setVideos,
      setPlays,
      setPlayInstances,
      addPlayInstance,
      updatePlayInstance,
      deletePlayInstance,
      setPlayers,
      setFormations,
      setDrives,
      addDrive,
      setMarkers,

      // Playback actions
      setSelectedVideo,
      setVideoUrl,
      setVideoLoadError,
      setCurrentTime,
      setVideoDuration,
      setIsPlaying,
      setUrlGeneratedAt,
      setUrlRefreshAttempted,

      // Camera actions
      setIsSwitchingCamera,
      setPendingCameraId,
      setPendingSyncSeek,
      setShouldResumePlayback,
      setTargetGameTimeMs,
      setGameTimelinePositionMs,
      setVideoOffsetMs,
      setClipDurationMs,
      setTimelineDurationMs,
      setOffsetDataVideoId,

      // Timeline actions
      setTimelineLanes,
      setCurrentLaneNumber,
      setIsVirtuallyPlaying,

      // Tagging actions
      setShowTagModal,
      setEditingInstance,
      setTagStartTime,
      setTagEndTime,
      setTaggingMode,
      setIsTaggingOpponent,
      setIsSavingPlay,
      setDriveAssignMode,
      setCurrentDrive,

      // UI actions
      setAnalyticsTier,
      setCameraLimit,

      // Direct dispatch for custom actions
      dispatch,
    }),
    [
      contextState,
      setGame,
      setVideos,
      setPlays,
      setPlayInstances,
      addPlayInstance,
      updatePlayInstance,
      deletePlayInstance,
      setPlayers,
      setFormations,
      setDrives,
      addDrive,
      setMarkers,
      setSelectedVideo,
      setVideoUrl,
      setVideoLoadError,
      setCurrentTime,
      setVideoDuration,
      setIsPlaying,
      setUrlGeneratedAt,
      setUrlRefreshAttempted,
      setIsSwitchingCamera,
      setPendingCameraId,
      setPendingSyncSeek,
      setShouldResumePlayback,
      setTargetGameTimeMs,
      setGameTimelinePositionMs,
      setVideoOffsetMs,
      setClipDurationMs,
      setTimelineDurationMs,
      setOffsetDataVideoId,
      setTimelineLanes,
      setCurrentLaneNumber,
      setIsVirtuallyPlaying,
      setShowTagModal,
      setEditingInstance,
      setTagStartTime,
      setTagEndTime,
      setTaggingMode,
      setIsTaggingOpponent,
      setIsSavingPlay,
      setDriveAssignMode,
      setCurrentDrive,
      setAnalyticsTier,
      setCameraLimit,
      dispatch,
    ]
  );
}

/**
 * useSyncLocalStateToContext - Sync existing useState values to context
 *
 * Use this temporarily during migration to keep context in sync
 * with local state values.
 */
export function useSyncLocalStateToContext(localState: {
  game?: Game | null;
  videos?: Video[];
  selectedVideo?: Video | null;
  videoUrl?: string;
  currentTime?: number;
  videoDuration?: number;
  isPlaying?: boolean;
  timelineLanes?: CameraLane[];
  gameTimelinePositionMs?: number;
}) {
  const dispatch = useFilmDispatch();

  // Sync game
  useEffect(() => {
    if (localState.game !== undefined) {
      dispatch({ type: 'SET_GAME', payload: localState.game as FilmState['data']['game'] });
    }
  }, [localState.game, dispatch]);

  // Sync videos
  useEffect(() => {
    if (localState.videos !== undefined) {
      dispatch({ type: 'SET_VIDEOS', payload: localState.videos as FilmState['data']['videos'] });
    }
  }, [localState.videos, dispatch]);

  // Sync selected video
  useEffect(() => {
    if (localState.selectedVideo !== undefined) {
      dispatch({ type: 'SET_SELECTED_VIDEO', payload: localState.selectedVideo as FilmState['playback']['selectedVideo'] });
    }
  }, [localState.selectedVideo, dispatch]);

  // Sync video URL
  useEffect(() => {
    if (localState.videoUrl !== undefined) {
      dispatch({ type: 'SET_VIDEO_URL', payload: localState.videoUrl });
    }
  }, [localState.videoUrl, dispatch]);

  // Sync current time
  useEffect(() => {
    if (localState.currentTime !== undefined) {
      dispatch({ type: 'SET_CURRENT_TIME', payload: localState.currentTime });
    }
  }, [localState.currentTime, dispatch]);

  // Sync video duration
  useEffect(() => {
    if (localState.videoDuration !== undefined) {
      dispatch({ type: 'SET_VIDEO_DURATION', payload: localState.videoDuration });
    }
  }, [localState.videoDuration, dispatch]);

  // Sync is playing
  useEffect(() => {
    if (localState.isPlaying !== undefined) {
      dispatch({ type: 'SET_IS_PLAYING', payload: localState.isPlaying });
    }
  }, [localState.isPlaying, dispatch]);

  // Sync timeline lanes
  useEffect(() => {
    if (localState.timelineLanes !== undefined) {
      dispatch({ type: 'SET_TIMELINE_LANES', payload: localState.timelineLanes });
    }
  }, [localState.timelineLanes, dispatch]);

  // Sync game timeline position
  useEffect(() => {
    if (localState.gameTimelinePositionMs !== undefined) {
      dispatch({ type: 'SET_GAME_TIMELINE_POSITION', payload: localState.gameTimelinePositionMs });
    }
  }, [localState.gameTimelinePositionMs, dispatch]);
}

export default useFilmStateBridge;
