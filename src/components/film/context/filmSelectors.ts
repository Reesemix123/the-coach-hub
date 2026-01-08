/**
 * Film Context Selectors
 *
 * Derived state selectors for the film tagging page.
 * Use these instead of computing derived values in components.
 *
 * @module components/film/context/filmSelectors
 * @since Phase 3 - Component Decomposition
 */

import { useMemo } from 'react';
import { useFilmState } from './FilmContext';
import type { FilmState, LoadingState } from './types';
import type { PlayInstance, Video, Drive } from '@/types/football';
import { findActiveClipForTime, findLaneForVideo } from '@/types/timeline';

// ============================================
// LOADING STATE SELECTORS
// ============================================

/**
 * Check if any data is currently loading
 */
export function useIsLoading(): boolean {
  const state = useFilmState();
  const loading = state.data.loading;
  return useMemo(() => {
    return Object.values(loading).some((s) => s === 'loading');
  }, [loading]);
}

/**
 * Check if initial data load is complete
 */
export function useIsInitialized(): boolean {
  const state = useFilmState();
  const loading = state.data.loading;
  return useMemo(() => {
    // Consider initialized when game and videos are loaded
    return loading.game === 'success' && loading.videos === 'success';
  }, [loading]);
}

/**
 * Get loading state for a specific data type
 */
export function useLoadingState(key: keyof FilmState['data']['loading']): LoadingState {
  const state = useFilmState();
  return state.data.loading[key];
}

// ============================================
// VIDEO SELECTORS
// ============================================

/**
 * Get non-virtual videos only
 */
export function useRealVideos(): Video[] {
  const state = useFilmState();
  return useMemo(
    () => state.data.videos.filter((v) => !v.is_virtual),
    [state.data.videos]
  );
}

/**
 * Check if multiple cameras are available
 */
export function useHasMultipleCameras(): boolean {
  const realVideos = useRealVideos();
  return realVideos.length > 1;
}

/**
 * Get video by ID
 */
export function useVideoById(videoId: string | null): Video | null {
  const state = useFilmState();
  return useMemo(
    () => state.data.videos.find((v) => v.id === videoId) || null,
    [state.data.videos, videoId]
  );
}

// ============================================
// TIMELINE SELECTORS
// ============================================

/**
 * Get active clip info for current timeline position
 */
export function useActiveClipInfo() {
  const state = useFilmState();
  const { timelineLanes, currentLaneNumber } = state.timeline;
  const { gameTimelinePositionMs } = state.camera;

  return useMemo(() => {
    if (timelineLanes.length === 0) {
      return {
        clip: null,
        clipTimeMs: 0,
        isInGap: false,
        nextClipStartMs: null,
      };
    }

    return findActiveClipForTime(
      timelineLanes,
      currentLaneNumber,
      gameTimelinePositionMs
    );
  }, [timelineLanes, currentLaneNumber, gameTimelinePositionMs]);
}

/**
 * Check if current position is in a coverage gap
 */
export function useIsInGap(): boolean {
  const activeClipInfo = useActiveClipInfo();
  return activeClipInfo.isInGap;
}

/**
 * Get the lane number for a specific video
 */
export function useLaneForVideo(videoId: string | null): number | null {
  const state = useFilmState();
  return useMemo(() => {
    if (!videoId) return null;
    return findLaneForVideo(state.timeline.timelineLanes, videoId);
  }, [state.timeline.timelineLanes, videoId]);
}

// ============================================
// PLAY INSTANCE SELECTORS
// ============================================

/**
 * Get play instances for the current video
 */
export function useCurrentVideoPlayInstances(): PlayInstance[] {
  const state = useFilmState();
  return useMemo(() => {
    const videoId = state.playback.selectedVideo?.id;
    if (!videoId) return [];

    return state.data.playInstances
      .filter((pi) => pi.video_id === videoId)
      .sort((a, b) => a.timestamp_start - b.timestamp_start);
  }, [state.data.playInstances, state.playback.selectedVideo?.id]);
}

/**
 * Get play instances for a specific drive
 */
export function useDrivePlayInstances(driveId: string | null): PlayInstance[] {
  const state = useFilmState();
  return useMemo(() => {
    if (!driveId) return [];
    return state.data.playInstances
      .filter((pi) => pi.drive_id === driveId)
      .sort((a, b) => a.timestamp_start - b.timestamp_start);
  }, [state.data.playInstances, driveId]);
}

/**
 * Get play count by type (offense/defense/special teams)
 */
export function usePlayCountsByType() {
  const state = useFilmState();
  return useMemo(() => {
    const instances = state.data.playInstances;

    return {
      offense: instances.filter((p) => p.play_type === 'run' || p.play_type === 'pass').length,
      defense: instances.filter((p) => p.is_opponent_play).length,
      specialTeams: instances.filter((p) =>
        p.play_type === 'kick' || p.play_type === 'pat' || p.play_type === 'two_point'
      ).length,
      total: instances.length,
    };
  }, [state.data.playInstances]);
}

/**
 * Get the play instance at or near the current time
 */
export function useCurrentPlayInstance(): PlayInstance | null {
  const state = useFilmState();
  const playInstances = state.data.playInstances;
  const currentTime = state.playback.currentTime;
  const videoId = state.playback.selectedVideo?.id;

  return useMemo(() => {
    if (!videoId) return null;

    // Find play that contains the current time
    return (
      playInstances.find(
        (pi) =>
          pi.video_id === videoId &&
          pi.timestamp_start <= currentTime &&
          (!pi.timestamp_end || pi.timestamp_end >= currentTime)
      ) || null
    );
  }, [playInstances, currentTime, videoId]);
}

// ============================================
// DRIVE SELECTORS
// ============================================

/**
 * Get drives for current game ordered by number
 */
export function useGameDrives(): Drive[] {
  const state = useFilmState();
  return useMemo(
    () => [...state.data.drives].sort((a, b) => a.drive_number - b.drive_number),
    [state.data.drives]
  );
}

/**
 * Get the most recent drive (for "continue current drive" feature)
 */
export function useMostRecentDrive(): Drive | null {
  const drives = useGameDrives();
  return drives.length > 0 ? drives[drives.length - 1] : null;
}

// ============================================
// CAMERA SWITCH SELECTORS
// ============================================

/**
 * Check if a camera switch is in progress
 */
export function useIsCameraSwitching(): boolean {
  const state = useFilmState();
  return state.camera.isSwitchingCamera;
}

/**
 * Check if there's a pending sync seek
 */
export function useHasPendingSeek(): boolean {
  const state = useFilmState();
  return state.camera.pendingSyncSeek !== null;
}

/**
 * Get the target camera during a switch
 */
export function usePendingCamera(): Video | null {
  const state = useFilmState();
  const pendingId = state.camera.pendingCameraId;

  return useMemo(() => {
    if (!pendingId) return null;
    return state.data.videos.find((v) => v.id === pendingId) || null;
  }, [state.data.videos, pendingId]);
}

// ============================================
// UI STATE SELECTORS
// ============================================

/**
 * Check if any menu is open
 */
export function useHasOpenMenu(): boolean {
  const state = useFilmState();
  return state.ui.showPeriodMarkerMenu || state.ui.showAddMarkerMenu;
}

/**
 * Check if the tag modal is open
 */
export function useIsTagModalOpen(): boolean {
  const state = useFilmState();
  return state.tagging.showTagModal;
}

/**
 * Get analytics tier restrictions
 */
export function useAnalyticsTierFeatures() {
  const state = useFilmState();
  return useMemo(() => {
    const tier = state.ui.analyticsTier;

    return {
      tier,
      hasPlayerTracking: tier !== 'quick',
      hasOLTracking: tier === 'comprehensive',
      hasDefensiveTracking: tier === 'comprehensive',
      hasSituationalFlags: tier === 'comprehensive',
      hasAIAssist: tier !== 'quick',
    };
  }, [state.ui.analyticsTier]);
}

// ============================================
// COMPOSITE SELECTORS
// ============================================

/**
 * Get complete playback info for UI display
 */
export function usePlaybackInfo() {
  const state = useFilmState();

  return useMemo(
    () => ({
      video: state.playback.selectedVideo,
      url: state.playback.videoUrl,
      currentTime: state.playback.currentTime,
      duration: state.playback.videoDuration,
      isPlaying: state.playback.isPlaying,
      error: state.playback.videoLoadError,
      progress:
        state.playback.videoDuration > 0
          ? (state.playback.currentTime / state.playback.videoDuration) * 100
          : 0,
    }),
    [state.playback]
  );
}

/**
 * Get complete timeline info for UI display
 */
export function useTimelineInfo() {
  const state = useFilmState();

  return useMemo(
    () => ({
      lanes: state.timeline.timelineLanes,
      currentLane: state.timeline.currentLaneNumber,
      gamePosition: state.camera.gameTimelinePositionMs,
      totalDuration: state.camera.timelineDurationMs,
      isVirtuallyPlaying: state.timeline.isVirtuallyPlaying,
      hasTimeline: state.timeline.timelineLanes.length > 0,
    }),
    [state.timeline, state.camera.gameTimelinePositionMs, state.camera.timelineDurationMs]
  );
}

/**
 * Get tagging form state for the modal
 */
export function useTaggingFormInfo() {
  const state = useFilmState();

  return useMemo(
    () => ({
      isOpen: state.tagging.showTagModal,
      startTime: state.tagging.tagStartTime,
      endTime: state.tagging.tagEndTime,
      editingInstance: state.tagging.editingInstance,
      mode: state.tagging.taggingMode,
      isOpponent: state.tagging.isTaggingOpponent,
      isSaving: state.tagging.isSavingPlay,
      currentDrive: state.tagging.currentDrive,
      isEditing: state.tagging.editingInstance !== null,
    }),
    [state.tagging]
  );
}
