'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { CameraLane } from '@/types/timeline';
import { findActiveClipForTime, findLaneForVideo } from '@/types/timeline';

// ============================================
// TYPES
// ============================================

export interface VideoElementCallbacks {
  seekVideo: (seconds: number) => void;
  getCurrentTime: () => number;
  getReadyState: () => number;
  play: () => Promise<void> | undefined;
  pause: () => void;
  isPaused: () => boolean;
  isAvailable: () => boolean;
}

interface Video {
  id: string;
  sync_offset_seconds?: number;
  camera_label?: string;
  [key: string]: any;
}

export interface UseTimelinePlaybackOptions {
  selectedVideo: Video | null;
  videos: Video[];
  videoDuration: number;
  currentTime: number;
  videoCallbacks: VideoElementCallbacks;
  setCurrentTime: (t: number) => void;
  setSelectedVideo: (v: any) => void;
  setVideoDuration: (d: number) => void;
  fetchVideos: () => Promise<void>;
}

export interface UseTimelinePlaybackReturn {
  // Timeline state
  timelineDurationMs: number;
  setTimelineDurationMs: (ms: number) => void;
  videoOffsetMs: number;
  clipDurationMs: number;
  gameTimelinePositionMs: number;
  setGameTimelinePositionMs: (ms: number) => void;
  timelineLanes: CameraLane[];
  setTimelineLanes: (lanes: CameraLane[]) => void;
  isSwitchingCamera: boolean;
  setIsSwitchingCamera: (v: boolean) => void;
  currentLaneNumber: number;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  isVirtuallyPlaying: boolean;

  // Camera sync state
  pendingSyncSeek: number | null;
  targetGameTimeMs: number | null;
  setTargetGameTimeMs: (ms: number | null) => void;
  pendingCameraId: string | null;
  seekLockRef: React.MutableRefObject<boolean>;
  offsetDataVideoId: string | null;

  // Operations
  handleCameraSwitch: (newCameraId: string, overrideGameTime?: number) => void;
  handleTimelineSeek: (gameTimeSeconds: number) => void;
  handleVideoOffsetChange: (offsetMs: number, durationMs: number, videoId: string) => void;
  stopVirtualPlayback: () => void;
}

// ============================================
// HOOK
// ============================================

export function useTimelinePlayback({
  selectedVideo,
  videos,
  videoDuration,
  currentTime,
  videoCallbacks,
  setCurrentTime,
  setSelectedVideo,
  setVideoDuration,
  fetchVideos,
}: UseTimelinePlaybackOptions): UseTimelinePlaybackReturn {
  // ========== STATE ==========
  const [pendingSyncSeek, setPendingSyncSeek] = useState<number | null>(null);
  const [shouldResumePlayback, setShouldResumePlayback] = useState(false);
  const [timelineDurationMs, setTimelineDurationMs] = useState<number>(0);
  const [videoOffsetMs, setVideoOffsetMs] = useState<number>(0);
  const [clipDurationMs, setClipDurationMs] = useState<number>(0);
  const [offsetDataVideoId, setOffsetDataVideoId] = useState<string | null>(null);
  const [targetGameTimeMs, setTargetGameTimeMs] = useState<number | null>(null);
  const [pendingCameraId, setPendingCameraId] = useState<string | null>(null);
  const [gameTimelinePositionMs, setGameTimelinePositionMs] = useState<number>(0);
  const [timelineLanes, setTimelineLanes] = useState<CameraLane[]>([]);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [currentLaneNumber, setCurrentLaneNumber] = useState<number>(1);
  const [isVirtuallyPlaying, setIsVirtuallyPlaying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // ========== REFS ==========
  const lastCameraSwitchTime = useRef<number>(0);
  const deferredCameraSwitch = useRef<{ videoId: string; gameTime?: number } | null>(null);
  const seekLockRef = useRef<boolean>(false);
  const virtualPlaybackRef = useRef<NodeJS.Timeout | null>(null);
  const virtualPlaybackTargetRef = useRef<number | null>(null);

  // ========== VIRTUAL PLAYBACK ==========

  const stopVirtualPlayback = useCallback(() => {
    if (virtualPlaybackRef.current) {
      clearInterval(virtualPlaybackRef.current);
      virtualPlaybackRef.current = null;
    }
    virtualPlaybackTargetRef.current = null;
    setIsVirtuallyPlaying(false);
  }, []);

  // handleCameraSwitch is used inside startVirtualPlayback, so we use a ref to break circular dependency
  const handleCameraSwitchRef = useRef<(newCameraId: string, overrideGameTime?: number) => void>(() => {});

  const startVirtualPlayback = useCallback((startMs: number, targetMs: number | null) => {
    stopVirtualPlayback();

    if (targetMs === null) {
      return;
    }

    console.log('[VirtualPlayback] Starting from', startMs, 'to', targetMs);
    virtualPlaybackTargetRef.current = targetMs;
    setIsVirtuallyPlaying(true);

    const startTime = Date.now();
    const startPosition = startMs;

    virtualPlaybackRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newPosition = startPosition + elapsed;

      setGameTimelinePositionMs(newPosition);

      const activeClipInfo = findActiveClipForTime(timelineLanes, currentLaneNumber, newPosition);

      if (activeClipInfo.clip) {
        stopVirtualPlayback();
        console.log('[VirtualPlayback] Reached clip:', activeClipInfo.clip.videoId);
        handleCameraSwitchRef.current(activeClipInfo.clip.videoId, newPosition);
      } else if (newPosition >= targetMs) {
        stopVirtualPlayback();
        console.log('[VirtualPlayback] Reached target, no clip found');
      }
    }, 100);
  }, [stopVirtualPlayback, timelineLanes, currentLaneNumber]);

  // ========== CAMERA SWITCH ==========

  const handleCameraSwitch = useCallback((newCameraId: string, overrideGameTime?: number) => {
    stopVirtualPlayback();

    const now = Date.now();
    if (now - lastCameraSwitchTime.current < 500) {
      console.log('[CameraSwitch] Ignoring rapid click, debouncing');
      return;
    }
    lastCameraSwitchTime.current = now;

    console.log('[CameraSwitch] handleCameraSwitch called:', {
      newCameraId,
      overrideGameTime,
      currentSelectedVideoId: selectedVideo?.id,
      currentTargetGameTimeMs: targetGameTimeMs,
      currentPendingCameraId: pendingCameraId,
      timelineLanesCount: timelineLanes.length,
    });

    // Calculate the game time we want to view
    let gameTimeToView: number;
    if (overrideGameTime !== undefined) {
      gameTimeToView = overrideGameTime;
    } else if (targetGameTimeMs !== null) {
      gameTimeToView = targetGameTimeMs;
    } else if (gameTimelinePositionMs > 0) {
      gameTimeToView = gameTimelinePositionMs;
    } else if (selectedVideo && videoCallbacks.isAvailable()) {
      gameTimeToView = videoOffsetMs + (videoCallbacks.getCurrentTime() * 1000);
    } else {
      gameTimeToView = 0;
    }

    console.log('[CameraSwitch] Target game time to view:', gameTimeToView);

    // Find which lane the clicked video belongs to
    let targetLane: CameraLane | undefined;

    if (timelineLanes.length === 0) {
      console.warn('[CameraSwitch] WARNING: timelineLanes is empty! Clip-finding will be skipped.');
    } else {
      console.log('[CameraSwitch] Available lanes:', timelineLanes.map(l => ({
        lane: l.lane,
        label: l.label,
        clips: l.clips.map(c => ({
          videoId: c.videoId,
          start: c.lanePositionMs,
          end: c.lanePositionMs + c.durationMs,
        }))
      })));
    }

    for (const lane of timelineLanes) {
      const hasVideo = lane.clips.some(c => c.videoId === newCameraId);
      if (hasVideo) {
        targetLane = lane;
        break;
      }
    }

    if (!targetLane) {
      console.warn('[CameraSwitch] Could not find lane for videoId:', newCameraId);
    } else {
      setCurrentLaneNumber(targetLane.lane);
    }

    // If the lane has multiple clips, find the clip that covers the target game time
    let actualVideoId = newCameraId;
    let actualClipLanePositionMs: number | null = null;

    if (targetLane && targetLane.clips.length > 1) {
      console.log('[CameraSwitch] Lane has multiple clips:', {
        lane: targetLane.lane,
        label: targetLane.label,
        clipCount: targetLane.clips.length,
        clips: targetLane.clips.map(c => ({
          videoId: c.videoId,
          start: c.lanePositionMs,
          end: c.lanePositionMs + c.durationMs,
        })),
      });

      let foundCoveringClip = false;
      for (const clip of targetLane.clips) {
        const clipStart = clip.lanePositionMs;
        const clipEnd = clip.lanePositionMs + clip.durationMs;

        if (gameTimeToView >= clipStart && gameTimeToView < clipEnd) {
          console.log('[CameraSwitch] Found covering clip:', {
            videoId: clip.videoId, clipStart, clipEnd, gameTimeToView,
          });
          actualVideoId = clip.videoId;
          actualClipLanePositionMs = clipStart;
          foundCoveringClip = true;
          break;
        }
      }

      if (!foundCoveringClip && targetLane.clips.length > 0) {
        let closestClip = targetLane.clips[0];
        let closestDistance = Infinity;

        for (const clip of targetLane.clips) {
          const clipStart = clip.lanePositionMs;
          const clipEnd = clip.lanePositionMs + clip.durationMs;

          let distance: number;
          if (gameTimeToView < clipStart) {
            distance = clipStart - gameTimeToView;
          } else if (gameTimeToView >= clipEnd) {
            distance = gameTimeToView - clipEnd;
          } else {
            distance = 0;
          }

          if (distance < closestDistance) {
            closestDistance = distance;
            closestClip = clip;
          }
        }

        console.log('[CameraSwitch] No covering clip found, using closest:', {
          videoId: closestClip.videoId,
          clipStart: closestClip.lanePositionMs,
          clipEnd: closestClip.lanePositionMs + closestClip.durationMs,
          gameTimeToView,
          distance: closestDistance,
        });
        actualVideoId = closestClip.videoId;
        actualClipLanePositionMs = closestClip.lanePositionMs;
      }

      if (actualVideoId !== newCameraId) {
        console.log('[CameraSwitch] Using different clip on same lane:', {
          originalClickedVideoId: newCameraId, actualVideoId,
        });
      }
    } else if (targetLane && targetLane.clips.length === 1) {
      actualClipLanePositionMs = targetLane.clips[0].lanePositionMs;
    }

    const newCamera = videos.find(v => v.id === actualVideoId);
    if (!newCamera) {
      console.log('[CameraSwitch] Camera not found in local array, deferring switch and fetching videos:', actualVideoId);
      deferredCameraSwitch.current = { videoId: actualVideoId, gameTime: overrideGameTime };
      fetchVideos();
      return;
    }

    // If clicking the same camera while "No film available" overlay is showing, dismiss it
    if (selectedVideo?.id === actualVideoId && targetGameTimeMs !== null) {
      console.log('[CameraSwitch] Same camera clicked while overlay showing, dismissing overlay');
      setTargetGameTimeMs(null);
      setPendingCameraId(null);
      setIsSwitchingCamera(false);
      return;
    }

    // If clicking the same camera (no overlay), do nothing
    if (selectedVideo?.id === actualVideoId) {
      console.log('[CameraSwitch] Same camera clicked, ignoring');
      return;
    }

    // If there's already a pending camera switch, log but continue
    if (pendingCameraId !== null) {
      console.log('[CameraSwitch] Interrupting pending switch from:', pendingCameraId);
    }

    // If we have a current video playing and sync offsets are set, calculate the synced time
    if (selectedVideo && videoCallbacks.isAvailable()) {
      setIsSwitchingCamera(true);
      setVideoDuration(0);

      const currentVideoTime = videoCallbacks.getCurrentTime();
      const wasPlaying = !videoCallbacks.isPaused();
      const currentOffset = selectedVideo.sync_offset_seconds || 0;
      const newOffset = newCamera.sync_offset_seconds || 0;

      console.log('[CameraSwitch] Switching cameras:', {
        gameTimeToView,
        currentVideoId: selectedVideo.id,
        newCameraId: actualVideoId,
        newCameraLabel: newCamera.camera_label,
        actualClipLanePositionMs,
      });
      setTargetGameTimeMs(gameTimeToView);
      setPendingCameraId(actualVideoId);

      let seekTime: number;
      if (actualClipLanePositionMs !== null) {
        seekTime = (gameTimeToView - actualClipLanePositionMs) / 1000;
        console.log('[CameraSwitch] Timeline seek calculation:', {
          gameTimeToView, actualClipLanePositionMs, seekTime,
        });
      } else {
        seekTime = currentVideoTime + currentOffset - newOffset;
        console.log('[CameraSwitch] Sync offset seek calculation:', {
          currentVideoTime, currentOffset, newOffset, seekTime,
        });
      }

      setPendingSyncSeek(Math.max(0, seekTime));

      const wasShowingNoFilmOverlay = targetGameTimeMs !== null;
      const atBoundary = videoCallbacks.isAvailable() && videoDuration > 0 &&
        (videoCallbacks.getCurrentTime() <= 0.5 || videoCallbacks.getCurrentTime() >= videoDuration - 0.5);
      setShouldResumePlayback(wasPlaying || wasShowingNoFilmOverlay || !!atBoundary);
    }

    setSelectedVideo(newCamera);
  }, [
    stopVirtualPlayback, selectedVideo, videos, videoCallbacks, videoOffsetMs,
    targetGameTimeMs, pendingCameraId, gameTimelinePositionMs, timelineLanes,
    videoDuration, setSelectedVideo, setVideoDuration, fetchVideos,
  ]);

  // Keep ref in sync
  handleCameraSwitchRef.current = handleCameraSwitch;

  // ========== TIMELINE SEEK (from TagPageFilmBridge onTimeChange) ==========

  const handleTimelineSeek = useCallback((secs: number) => {
    const newGameTimeMs = secs * 1000;
    setGameTimelinePositionMs(newGameTimeMs);

    // Clear stale targetGameTimeMs when user drags to a new position
    if (targetGameTimeMs !== null && Math.abs(newGameTimeMs - targetGameTimeMs) > 1000) {
      setTargetGameTimeMs(null);
      setPendingCameraId(null);
      setIsSwitchingCamera(false);
    }

    // Auto-switch clips when dragging timeline
    if (timelineLanes.length > 0 && selectedVideo) {
      const activeClipInfo = findActiveClipForTime(timelineLanes, currentLaneNumber, newGameTimeMs);

      if (activeClipInfo.clip && activeClipInfo.clip.videoId !== selectedVideo.id) {
        console.log('[AutoSwitch] Timeline drag - switching to clip:', activeClipInfo.clip.videoId);
        handleCameraSwitch(activeClipInfo.clip.videoId, newGameTimeMs);
        return;
      }

      if (activeClipInfo.isInGap) {
        if (isPlaying && activeClipInfo.nextClipStartMs !== null) {
          console.log('[AutoSwitch] Dragged to gap, starting virtual playback');
          startVirtualPlayback(newGameTimeMs, activeClipInfo.nextClipStartMs);
        }
        return;
      }
    }

    // Same clip — seek within current video
    const videoRelativeTime = secs - (videoOffsetMs / 1000);

    if (videoCallbacks.isAvailable() && videoRelativeTime >= 0) {
      const duration = videoDuration || Infinity;
      const clampedVideoTime = Math.min(videoRelativeTime, duration);
      videoCallbacks.seekVideo(clampedVideoTime);
      setCurrentTime(clampedVideoTime);
    } else {
      setCurrentTime(Math.max(0, videoRelativeTime));
    }
  }, [
    targetGameTimeMs, timelineLanes, currentLaneNumber, selectedVideo,
    isPlaying, videoOffsetMs, videoDuration, videoCallbacks, setCurrentTime,
    handleCameraSwitch, startVirtualPlayback,
  ]);

  // ========== VIDEO OFFSET CHANGE (from TagPageFilmBridge) ==========

  const handleVideoOffsetChange = useCallback((offsetMs: number, durationMs: number, videoId: string) => {
    console.log('[TagPage] onVideoOffsetChange called:', { offsetMs, durationMs, videoId });
    setVideoOffsetMs(offsetMs);
    setClipDurationMs(durationMs);
    setOffsetDataVideoId(videoId);
  }, []);

  // ========== EFFECTS ==========

  // Cleanup virtual playback timer on unmount
  useEffect(() => {
    return () => {
      if (virtualPlaybackRef.current) {
        clearInterval(virtualPlaybackRef.current);
      }
    };
  }, []);

  // Process deferred camera switch when videos array updates
  useEffect(() => {
    if (!deferredCameraSwitch.current) return;

    const { videoId, gameTime } = deferredCameraSwitch.current;
    const video = videos.find(v => v.id === videoId);

    if (video) {
      console.log('[TagPage] Processing deferred camera switch:', videoId);
      deferredCameraSwitch.current = null;
      handleCameraSwitch(videoId, gameTime);
    }
  }, [videos, handleCameraSwitch]);

  // Apply pending seek when video duration becomes available
  useEffect(() => {
    if (pendingSyncSeek === null) return;
    if (videoDuration <= 0) return;
    if (!videoCallbacks.isAvailable()) return;

    console.log('[CameraSwitch] Applying pending seek:', {
      pendingSyncSeek,
      videoDuration,
      currentTime: videoCallbacks.getCurrentTime(),
      readyState: videoCallbacks.getReadyState(),
      targetGameTimeMs,
      videoOffsetMs,
    });

    if (videoCallbacks.getReadyState() < 1) {
      console.warn('[CameraSwitch] Video not ready for seeking, readyState:', videoCallbacks.getReadyState());
      return;
    }

    const seekedTime = Math.max(0, Math.min(pendingSyncSeek, videoDuration));
    console.log('[CameraSwitch] Seeking to:', seekedTime, 'seconds');
    videoCallbacks.seekVideo(seekedTime);

    console.log('[CameraSwitch] After seek, currentTime is:', videoCallbacks.getCurrentTime());

    setCurrentTime(seekedTime);

    if (targetGameTimeMs !== null) {
      console.log('[CameraSwitch] Setting gameTimelinePositionMs from targetGameTimeMs:', targetGameTimeMs);
      setGameTimelinePositionMs(targetGameTimeMs);
    } else {
      console.log('[CameraSwitch] Fallback: calculating gameTimelinePositionMs from videoOffsetMs:', videoOffsetMs + (seekedTime * 1000));
      setGameTimelinePositionMs(videoOffsetMs + (seekedTime * 1000));
    }

    // CRITICAL: Lock to prevent onTimeUpdate from overwriting gameTimelinePositionMs
    seekLockRef.current = true;
    console.log('[CameraSwitch] Setting seek lock to prevent onTimeUpdate overwrite');
    setTimeout(() => {
      seekLockRef.current = false;
      console.log('[CameraSwitch] Seek lock cleared');
    }, 500);

    setPendingSyncSeek(null);

    if (shouldResumePlayback) {
      videoCallbacks.play()?.catch(() => {});
      setShouldResumePlayback(false);
    }
  }, [pendingSyncSeek, videoDuration, shouldResumePlayback, videoOffsetMs, targetGameTimeMs, videoCallbacks, setCurrentTime]);

  // Clear targetGameTimeMs if the camera switch resulted in valid coverage
  useEffect(() => {
    if (targetGameTimeMs === null) return;
    if (pendingCameraId === null) return;

    if (selectedVideo?.id !== pendingCameraId) {
      console.log('[CameraSwitch] Waiting for new camera to be selected...', {
        selectedVideoId: selectedVideo?.id,
        pendingCameraId,
      });
      return;
    }

    if (offsetDataVideoId !== pendingCameraId) {
      console.log('[CameraSwitch] Waiting for offset data to update...', {
        offsetDataVideoId,
        pendingCameraId,
        currentOffsetMs: videoOffsetMs,
        currentDurationMs: clipDurationMs,
      });
      return;
    }

    const syncOffsetMs = (selectedVideo?.sync_offset_seconds || 0) * 1000;
    const videoStartMs = clipDurationMs > 0 ? videoOffsetMs : syncOffsetMs;

    const actualVideoDurationMs = videoDuration > 0 ? videoDuration * 1000 : 0;
    let effectiveDurationMs: number;
    if (clipDurationMs > 0 && actualVideoDurationMs > 0) {
      effectiveDurationMs = Math.min(clipDurationMs, actualVideoDurationMs);
    } else if (clipDurationMs > 0) {
      effectiveDurationMs = clipDurationMs;
    } else {
      effectiveDurationMs = actualVideoDurationMs;
    }
    const videoEndMs = videoStartMs + effectiveDurationMs;

    console.log('[CameraSwitch] Checking coverage for NEW camera (data verified):', {
      targetGameTimeMs,
      videoOffsetMs,
      clipDurationMs,
      actualVideoDurationMs,
      effectiveDurationMs,
      syncOffsetMs,
      videoStartMs,
      videoEndMs,
      videoDuration,
      selectedVideoId: selectedVideo?.id,
      pendingCameraId,
      offsetDataVideoId,
    });

    if (videoEndMs === 0 || videoDuration <= 0) {
      console.log('[CameraSwitch] Waiting for video duration...', { videoEndMs, videoDuration });
      return;
    }

    if (targetGameTimeMs >= videoStartMs && targetGameTimeMs < videoEndMs) {
      console.log('[CameraSwitch] Target is within coverage, clearing overlay and resuming playback');
      setTargetGameTimeMs(null);
      setPendingCameraId(null);
      setIsSwitchingCamera(false);
      setShouldResumePlayback(true);
      if (videoCallbacks.isPaused() && videoCallbacks.getReadyState() >= 2) {
        videoCallbacks.play()?.catch(() => {});
      }
    } else {
      console.log('[CameraSwitch] Target is OUTSIDE coverage, should show overlay');
      setPendingCameraId(null);
      setIsSwitchingCamera(false);
      setShouldResumePlayback(false);
      if (!videoCallbacks.isPaused()) {
        videoCallbacks.pause();
      }
    }
  }, [targetGameTimeMs, pendingCameraId, videoOffsetMs, clipDurationMs, videoDuration, selectedVideo?.id, selectedVideo?.sync_offset_seconds, offsetDataVideoId, videoCallbacks]);

  // Pause video when showing "No film available" overlay
  useEffect(() => {
    if (!videoCallbacks.isAvailable()) return;

    const isCheckingCoverage = pendingCameraId !== null;
    const isShowingNoFilmOverlay = targetGameTimeMs !== null && pendingCameraId === null;

    if (isCheckingCoverage || isShowingNoFilmOverlay) {
      if (!videoCallbacks.isPaused()) {
        console.log('[VideoOverlay] Pausing video due to overlay:', {
          isCheckingCoverage,
          isShowingNoFilmOverlay,
          pendingCameraId,
          targetGameTimeMs,
        });
        videoCallbacks.pause();
      }
    }
  }, [pendingCameraId, targetGameTimeMs, videoCallbacks]);

  // Initialize currentLaneNumber from selected video when timelineLanes loads
  useEffect(() => {
    if (timelineLanes.length > 0 && selectedVideo) {
      const laneForVideo = findLaneForVideo(timelineLanes, selectedVideo.id);
      if (laneForVideo !== null && laneForVideo !== currentLaneNumber) {
        console.log('[LaneInit] Initializing currentLaneNumber from selected video:', {
          selectedVideoId: selectedVideo.id,
          foundLane: laneForVideo,
          previousLane: currentLaneNumber,
        });
        setCurrentLaneNumber(laneForVideo);
      }
    }
  }, [timelineLanes, selectedVideo?.id, currentLaneNumber]);

  // ========== RETURN ==========

  return {
    timelineDurationMs,
    setTimelineDurationMs,
    videoOffsetMs,
    clipDurationMs,
    gameTimelinePositionMs,
    setGameTimelinePositionMs,
    timelineLanes,
    setTimelineLanes,
    isSwitchingCamera,
    setIsSwitchingCamera,
    currentLaneNumber,
    isPlaying,
    setIsPlaying,
    isVirtuallyPlaying,

    pendingSyncSeek,
    setPendingSyncSeek,
    targetGameTimeMs,
    setTargetGameTimeMs,
    pendingCameraId,
    seekLockRef,
    offsetDataVideoId,

    handleCameraSwitch,
    handleTimelineSeek,
    handleVideoOffsetChange,
    stopVirtualPlayback,
  };
}
