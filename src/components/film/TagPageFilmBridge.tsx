'use client';

import React, { useEffect, useRef, useCallback, ReactNode } from 'react';
import { FilmStudioProvider, useFilmStudio } from '@/components/film-studio/context/FilmStudioContext';
import type { Video } from '@/types/football';
import type { CameraLane } from '@/types/timeline';

interface TagPageFilmBridgeProps {
  gameId: string;
  teamId: string;
  gameName: string;

  // Tag page state (passed in)
  currentTimeSeconds: number;
  isPlaying: boolean;
  selectedVideoId: string | null;
  videos: Video[];

  // Callbacks for bidirectional sync
  onTimeChange: (seconds: number) => void;
  onCameraChange: (cameraId: string) => void;
  onPlayStateChange: (playing: boolean) => void;
  onTimelineDurationChange?: (durationMs: number) => void;
  onVideoOffsetChange?: (offsetMs: number, videoDurationMs: number, videoId: string) => void;
  onTimelineLanesChange?: (lanes: CameraLane[]) => void;

  children: ReactNode;
}

/**
 * Bridge component that syncs state between the tag page and FilmStudioContext.
 * Uses refs to prevent infinite loops from callback dependencies.
 */
function TagPageFilmBridgeInner({
  currentTimeSeconds,
  isPlaying,
  selectedVideoId,
  onTimeChange,
  onCameraChange,
  onPlayStateChange,
  onTimelineDurationChange,
  onVideoOffsetChange,
  onTimelineLanesChange,
  children,
}: Omit<TagPageFilmBridgeProps, 'gameId' | 'teamId' | 'gameName' | 'videos'>) {
  const { state, dispatch, seekTo } = useFilmStudio();

  // Expose timeline duration to parent
  const onTimelineDurationChangeRef = useRef(onTimelineDurationChange);
  useEffect(() => {
    onTimelineDurationChangeRef.current = onTimelineDurationChange;
  });

  useEffect(() => {
    if (state.timeline?.totalDurationMs && onTimelineDurationChangeRef.current) {
      onTimelineDurationChangeRef.current(state.timeline.totalDurationMs);
    }
  }, [state.timeline?.totalDurationMs]);

  // Expose timeline lanes to parent (for multi-clip camera switching)
  const onTimelineLanesChangeRef = useRef(onTimelineLanesChange);
  useEffect(() => {
    onTimelineLanesChangeRef.current = onTimelineLanesChange;
  });

  useEffect(() => {
    if (state.timeline?.lanes && onTimelineLanesChangeRef.current) {
      console.log('[FilmBridge] Timeline lanes updated:', {
        lanesCount: state.timeline.lanes.length,
        lanes: state.timeline.lanes.map(l => ({
          lane: l.lane,
          label: l.label,
          clipsCount: l.clips.length,
          clips: l.clips.map(c => ({
            videoId: c.videoId,
            start: c.lanePositionMs,
            end: c.lanePositionMs + c.durationMs,
            durationMs: c.durationMs,
          }))
        }))
      });
      onTimelineLanesChangeRef.current(state.timeline.lanes);
    }
  }, [state.timeline?.lanes]);

  // Expose current video's offset in the game timeline
  const onVideoOffsetChangeRef = useRef(onVideoOffsetChange);
  useEffect(() => {
    onVideoOffsetChangeRef.current = onVideoOffsetChange;
  });

  useEffect(() => {
    if (!selectedVideoId || !state.timeline?.lanes || !onVideoOffsetChangeRef.current) return;

    console.log('[FilmBridge] Looking for video offset:', {
      selectedVideoId,
      lanesCount: state.timeline.lanes.length,
      lanes: state.timeline.lanes.map(l => ({
        lane: l.lane,
        label: l.label,
        clipsCount: l.clips.length,
        clips: l.clips.map(c => ({ videoId: c.videoId, lanePositionMs: c.lanePositionMs, durationMs: c.durationMs }))
      }))
    });

    // Find the clip for the selected video across all lanes
    for (const lane of state.timeline.lanes) {
      const clip = lane.clips.find(c => c.videoId === selectedVideoId);
      if (clip) {
        console.log('[FilmBridge] Found clip for video:', {
          videoId: selectedVideoId,
          lane: lane.lane,
          lanePositionMs: clip.lanePositionMs,
          durationMs: clip.durationMs
        });
        onVideoOffsetChangeRef.current(clip.lanePositionMs, clip.durationMs, selectedVideoId);
        return;
      }
    }
    // Video not found in timeline - default to 0 offset
    console.log('[FilmBridge] Video NOT found in timeline lanes, defaulting to (0, 0):', selectedVideoId);
    onVideoOffsetChangeRef.current(0, 0, selectedVideoId);
  }, [selectedVideoId, state.timeline?.lanes]);

  // Store callbacks in refs to avoid dependency issues
  const onTimeChangeRef = useRef(onTimeChange);
  const onCameraChangeRef = useRef(onCameraChange);
  const onPlayStateChangeRef = useRef(onPlayStateChange);

  // Update refs when callbacks change (without triggering effects)
  useEffect(() => {
    onTimeChangeRef.current = onTimeChange;
    onCameraChangeRef.current = onCameraChange;
    onPlayStateChangeRef.current = onPlayStateChange;
  });

  // Track sync state to prevent loops
  const isSyncingTime = useRef(false);
  const isSyncingCamera = useRef(false);
  const isSyncingPlayState = useRef(false);
  const lastContextTimeMs = useRef(0);
  const lastTagPageTimeSeconds = useRef(0);

  // ========== TIME SYNC ==========
  // Tag page time -> context (video timeupdate events)
  useEffect(() => {
    if (isSyncingTime.current) return;

    // Skip if this is essentially the same time we already know about
    if (Math.abs(currentTimeSeconds - lastTagPageTimeSeconds.current) < 0.1) return;

    lastTagPageTimeSeconds.current = currentTimeSeconds;
    const newTimeMs = currentTimeSeconds * 1000;

    // Only dispatch if significantly different from context
    if (Math.abs(state.currentTimeMs - newTimeMs) > 300) {
      dispatch({ type: 'UPDATE_CURRENT_TIME', timeMs: newTimeMs });
      lastContextTimeMs.current = newTimeMs;
    }
  }, [currentTimeSeconds, dispatch, state.currentTimeMs]);

  // Timeline seek handler - called when user clicks timeline
  const handleTimelineSeek = useCallback((timeMs: number) => {
    isSyncingTime.current = true;
    lastContextTimeMs.current = timeMs;

    // Update context
    seekTo(timeMs);

    // Update tag page
    const seconds = timeMs / 1000;
    lastTagPageTimeSeconds.current = seconds;
    onTimeChangeRef.current(seconds);

    // Reset sync flag after a tick
    setTimeout(() => {
      isSyncingTime.current = false;
    }, 50);
  }, [seekTo]);

  // Expose timeline seek handler globally
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__filmBridgeSeek = handleTimelineSeek;
    return () => {
      delete (window as unknown as Record<string, unknown>).__filmBridgeSeek;
    };
  }, [handleTimelineSeek]);

  // Context -> tag page (for timeline-initiated time changes like ruler clicks/drags)
  useEffect(() => {
    // Skip if we're already in a sync operation
    if (isSyncingTime.current) return;

    const contextTimeSeconds = state.currentTimeMs / 1000;

    // Skip if the times are already close (prevents unnecessary updates)
    if (Math.abs(contextTimeSeconds - lastTagPageTimeSeconds.current) < 0.3) return;

    // This is a context-initiated change (e.g., user clicked/dragged on timeline)
    // Sync it to the tag page
    isSyncingTime.current = true;
    lastTagPageTimeSeconds.current = contextTimeSeconds;
    onTimeChangeRef.current(contextTimeSeconds);

    setTimeout(() => {
      isSyncingTime.current = false;
    }, 50);
  }, [state.currentTimeMs]);

  // ========== PLAY STATE SYNC ==========
  // Tag page -> context
  useEffect(() => {
    if (isSyncingPlayState.current) return;
    if (state.isPlaying === isPlaying) return;

    dispatch({ type: 'SET_PLAYING', isPlaying });
  }, [isPlaying, dispatch, state.isPlaying]);

  // Context -> tag page (only for timeline-initiated changes)
  // Note: We don't auto-sync context->tagPage for play state since
  // the video player is the source of truth

  // ========== CAMERA SYNC ==========
  // Tag page -> context
  useEffect(() => {
    if (isSyncingCamera.current) return;
    if (!selectedVideoId) return;
    if (state.primaryCameraId === selectedVideoId) return;

    // Only sync if camera exists in context
    const cameraExists = state.cameras.some(c => c.id === selectedVideoId);
    if (cameraExists) {
      dispatch({ type: 'SET_PRIMARY_CAMERA', cameraId: selectedVideoId });
    }
  }, [selectedVideoId, dispatch, state.primaryCameraId, state.cameras]);

  // Context -> tag page
  useEffect(() => {
    if (isSyncingCamera.current) return;
    if (!state.primaryCameraId) return;
    if (state.primaryCameraId === selectedVideoId) return;

    isSyncingCamera.current = true;
    onCameraChangeRef.current(state.primaryCameraId);

    setTimeout(() => {
      isSyncingCamera.current = false;
    }, 50);
  }, [state.primaryCameraId, selectedVideoId]);

  return <>{children}</>;
}

/**
 * Main bridge component that wraps children with FilmStudioProvider
 * and handles bidirectional state synchronization.
 */
export function TagPageFilmBridge({
  gameId,
  teamId,
  gameName,
  currentTimeSeconds,
  isPlaying,
  selectedVideoId,
  videos,
  onTimeChange,
  onCameraChange,
  onPlayStateChange,
  onTimelineDurationChange,
  onVideoOffsetChange,
  onTimelineLanesChange,
  children,
}: TagPageFilmBridgeProps) {
  return (
    <FilmStudioProvider gameId={gameId} teamId={teamId} gameName={gameName}>
      <TagPageFilmBridgeInner
        currentTimeSeconds={currentTimeSeconds}
        isPlaying={isPlaying}
        selectedVideoId={selectedVideoId}
        onTimeChange={onTimeChange}
        onCameraChange={onCameraChange}
        onPlayStateChange={onPlayStateChange}
        onTimelineDurationChange={onTimelineDurationChange}
        onVideoOffsetChange={onVideoOffsetChange}
        onTimelineLanesChange={onTimelineLanesChange}
      >
        {children}
      </TagPageFilmBridgeInner>
    </FilmStudioProvider>
  );
}

export default TagPageFilmBridge;
