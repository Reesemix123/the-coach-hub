'use client';

import { useState, useRef, useCallback } from 'react';
import type { CameraLane } from '@/types/timeline';

/**
 * Video interface for camera state management
 */
interface VideoForCamera {
  id: string;
  name: string;
  camera_label?: string | null;
  camera_order?: number;
  sync_offset_seconds?: number;
  file_path?: string;
}

/**
 * Return type for the useCameraState hook
 */
export interface CameraState {
  // Selected camera state
  selectedVideo: VideoForCamera | null;
  setSelectedVideo: (video: VideoForCamera | null) => void;

  // Timeline positioning
  videoOffsetMs: number;
  setVideoOffsetMs: (offset: number) => void;
  clipDurationMs: number;
  setClipDurationMs: (duration: number) => void;
  offsetDataVideoId: string | null;
  setOffsetDataVideoId: (id: string | null) => void;

  // Camera switching state
  isSwitchingCamera: boolean;
  setIsSwitchingCamera: (switching: boolean) => void;
  pendingCameraId: string | null;
  setPendingCameraId: (id: string | null) => void;
  pendingSyncSeek: number | null;
  setPendingSyncSeek: (seek: number | null) => void;
  shouldResumePlayback: boolean;
  setShouldResumePlayback: (resume: boolean) => void;

  // Timeline coverage
  targetGameTimeMs: number | null;
  setTargetGameTimeMs: (time: number | null) => void;
  gameTimelinePositionMs: number;
  setGameTimelinePositionMs: (position: number) => void;
  timelineDurationMs: number;
  setTimelineDurationMs: (duration: number) => void;

  // Multi-camera timeline
  timelineLanes: CameraLane[];
  setTimelineLanes: (lanes: CameraLane[]) => void;
  currentLaneNumber: number;
  setCurrentLaneNumber: (lane: number) => void;

  // Refs for debouncing/coordination
  lastCameraSwitchTime: React.MutableRefObject<number>;
  deferredCameraSwitch: React.MutableRefObject<{ videoId: string; gameTime?: number } | null>;
  seekLockRef: React.MutableRefObject<boolean>;

  // Virtual playback (for timeline gaps)
  isVirtuallyPlaying: boolean;
  setIsVirtuallyPlaying: (playing: boolean) => void;
  virtualPlaybackRef: React.MutableRefObject<NodeJS.Timeout | null>;
  virtualPlaybackTargetRef: React.MutableRefObject<number | null>;

  // Actions
  resetCameraSwitch: () => void;
}

/**
 * useCameraState - Manages multi-camera selection and synchronization state
 *
 * This hook encapsulates:
 * - Selected camera/video tracking
 * - Camera sync offset calculations
 * - Camera switching state machine
 * - Timeline lane management
 * - Virtual playback for coverage gaps
 *
 * Used in conjunction with useVideoPlaybackState for complete
 * film playback management.
 *
 * @example
 * ```tsx
 * const {
 *   selectedVideo,
 *   setSelectedVideo,
 *   isSwitchingCamera,
 *   pendingSyncSeek,
 * } = useCameraState();
 *
 * const handleCameraSwitch = (cameraId: string) => {
 *   setIsSwitchingCamera(true);
 *   // ... camera switch logic
 * };
 * ```
 *
 * @since Phase 1 - Film System Refactor (Task 1.5)
 */
export function useCameraState(): CameraState {
  // Selected camera state
  const [selectedVideo, setSelectedVideo] = useState<VideoForCamera | null>(null);

  // Timeline positioning
  const [videoOffsetMs, setVideoOffsetMs] = useState<number>(0);
  const [clipDurationMs, setClipDurationMs] = useState<number>(0);
  const [offsetDataVideoId, setOffsetDataVideoId] = useState<string | null>(null);

  // Camera switching state
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [pendingCameraId, setPendingCameraId] = useState<string | null>(null);
  const [pendingSyncSeek, setPendingSyncSeek] = useState<number | null>(null);
  const [shouldResumePlayback, setShouldResumePlayback] = useState(false);

  // Timeline coverage
  const [targetGameTimeMs, setTargetGameTimeMs] = useState<number | null>(null);
  const [gameTimelinePositionMs, setGameTimelinePositionMs] = useState<number>(0);
  const [timelineDurationMs, setTimelineDurationMs] = useState<number>(0);

  // Multi-camera timeline
  const [timelineLanes, setTimelineLanes] = useState<CameraLane[]>([]);
  const [currentLaneNumber, setCurrentLaneNumber] = useState<number>(1);

  // Refs for debouncing/coordination
  const lastCameraSwitchTime = useRef<number>(0);
  const deferredCameraSwitch = useRef<{ videoId: string; gameTime?: number } | null>(null);
  const seekLockRef = useRef<boolean>(false);

  // Virtual playback state
  const [isVirtuallyPlaying, setIsVirtuallyPlaying] = useState(false);
  const virtualPlaybackRef = useRef<NodeJS.Timeout | null>(null);
  const virtualPlaybackTargetRef = useRef<number | null>(null);

  /**
   * Reset camera switch state (used when canceling or completing a switch)
   */
  const resetCameraSwitch = useCallback(() => {
    setIsSwitchingCamera(false);
    setPendingCameraId(null);
    setPendingSyncSeek(null);
    setTargetGameTimeMs(null);
    setShouldResumePlayback(false);
  }, []);

  return {
    // Selected camera state
    selectedVideo,
    setSelectedVideo,

    // Timeline positioning
    videoOffsetMs,
    setVideoOffsetMs,
    clipDurationMs,
    setClipDurationMs,
    offsetDataVideoId,
    setOffsetDataVideoId,

    // Camera switching state
    isSwitchingCamera,
    setIsSwitchingCamera,
    pendingCameraId,
    setPendingCameraId,
    pendingSyncSeek,
    setPendingSyncSeek,
    shouldResumePlayback,
    setShouldResumePlayback,

    // Timeline coverage
    targetGameTimeMs,
    setTargetGameTimeMs,
    gameTimelinePositionMs,
    setGameTimelinePositionMs,
    timelineDurationMs,
    setTimelineDurationMs,

    // Multi-camera timeline
    timelineLanes,
    setTimelineLanes,
    currentLaneNumber,
    setCurrentLaneNumber,

    // Refs
    lastCameraSwitchTime,
    deferredCameraSwitch,
    seekLockRef,

    // Virtual playback
    isVirtuallyPlaying,
    setIsVirtuallyPlaying,
    virtualPlaybackRef,
    virtualPlaybackTargetRef,

    // Actions
    resetCameraSwitch,
  };
}

export default useCameraState;
