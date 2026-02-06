'use client';

/**
 * VideoPlaybackPanel
 *
 * Extracted component for video playback in the film tagging page.
 * Handles video rendering, playback controls, and time synchronization.
 *
 * This component can work in two modes:
 * 1. Controlled mode: All state/handlers passed via props
 * 2. Context mode: Uses FilmContext (future migration)
 *
 * @module components/film/panels/VideoPlaybackPanel
 * @since Phase 3 - Component Decomposition
 */

import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
  type RefObject,
} from 'react';
import { VideoErrorBoundary } from '@/components/film/VideoErrorBoundary';
import type { Video } from '@/types/football';

// ============================================
// TYPES
// ============================================

export interface VideoPlaybackState {
  videoUrl: string;
  selectedVideo: Video | null;
  currentTime: number;
  videoDuration: number;
  isPlaying: boolean;
  videoLoadError: string | null;
  urlRefreshAttempted: boolean;
}

export interface CameraSyncState {
  isSwitchingCamera: boolean;
  pendingSyncSeek: number | null;
  pendingCameraId: string | null;
  videoOffsetMs: number;
}

export interface VideoPlaybackHandlers {
  onTimeUpdate: (currentTime: number, gameTimeMs: number) => void;
  onDurationChange: (duration: number) => void;
  onCanPlay: () => void;
  onError: (error: MediaError | null, urlRefreshAttempted: boolean) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onReload: () => void;
}

export interface VideoPlaybackPanelProps {
  /** Video playback state */
  playback: VideoPlaybackState;
  /** Camera synchronization state */
  camera: CameraSyncState;
  /** Event handlers */
  handlers: VideoPlaybackHandlers;
  /** Game ID for session tracking */
  gameId: string;
  /** Ref to track seek lock */
  seekLockRef: RefObject<boolean>;
  /** Max height for video element */
  maxHeight?: string;
  /** Additional class name */
  className?: string;
}

export interface VideoPlaybackPanelRef {
  /** Get the video element */
  getVideoElement: () => HTMLVideoElement | null;
  /** Seek to a specific time */
  seekTo: (timeSeconds: number) => void;
  /** Play the video */
  play: () => Promise<void>;
  /** Pause the video */
  pause: () => void;
  /** Get current time */
  getCurrentTime: () => number;
  /** Check if video is ready */
  isReady: () => boolean;
}

// ============================================
// COMPONENT
// ============================================

/**
 * VideoPlaybackPanel - Video player with playback controls
 */
export const VideoPlaybackPanel = memo(forwardRef<
  VideoPlaybackPanelRef,
  VideoPlaybackPanelProps
>(function VideoPlaybackPanel(
  {
    playback,
    camera,
    handlers,
    gameId,
    seekLockRef,
    maxHeight = '600px',
    className = '',
  },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
    seekTo: (timeSeconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = timeSeconds;
      }
    },
    play: async () => {
      if (videoRef.current) {
        await videoRef.current.play();
      }
    },
    pause: () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    isReady: () => (videoRef.current?.readyState ?? 0) >= 1,
  }));

  // Handle time update with sync logic
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.target as HTMLVideoElement;
      const currentTime = video.currentTime;

      // Don't update game timeline during camera switch or while seek locked
      if (
        camera.isSwitchingCamera ||
        camera.pendingSyncSeek !== null ||
        seekLockRef.current
      ) {
        handlers.onTimeUpdate(currentTime, -1); // -1 signals no game time update
        return;
      }

      // Don't update at video end to avoid timeline jump
      const isAtVideoEnd =
        video.duration > 0 && currentTime >= video.duration - 0.5;
      if (!isAtVideoEnd) {
        const gameTimeMs = camera.videoOffsetMs + currentTime * 1000;
        handlers.onTimeUpdate(currentTime, gameTimeMs);
      } else {
        handlers.onTimeUpdate(currentTime, -1);
      }
    },
    [camera, handlers, seekLockRef]
  );

  // Handle metadata loaded
  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.target as HTMLVideoElement;
      handlers.onDurationChange(video.duration);
    },
    [handlers]
  );

  // Handle ready to play
  const handleCanPlay = useCallback(() => {
    // Only clear switching state if no pending operations
    if (camera.pendingSyncSeek === null && camera.pendingCameraId === null) {
      handlers.onCanPlay();
    }
  }, [camera, handlers]);

  // Handle video error with URL refresh logic
  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.target as HTMLVideoElement;
      const error = video.error;

      console.error('[VideoPlaybackPanel] Video error:', {
        code: error?.code,
        message: error?.message,
        networkState: video.networkState,
        readyState: video.readyState,
        urlRefreshAttempted: playback.urlRefreshAttempted,
      });

      handlers.onError(error, playback.urlRefreshAttempted);
    },
    [handlers, playback.urlRefreshAttempted]
  );

  // Handle play event
  const handlePlay = useCallback(() => {
    handlers.onPlay();
  }, [handlers]);

  // Handle pause event
  const handlePause = useCallback(() => {
    handlers.onPause();
  }, [handlers]);

  // Handle video ended
  const handleEnded = useCallback(() => {
    handlers.onEnded();
  }, [handlers]);

  // Don't render if no video URL
  if (!playback.videoUrl || !playback.selectedVideo) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-lg ${className}`}
           style={{ minHeight: '300px', maxHeight }}>
        <p className="text-gray-400">Select a video to begin</p>
      </div>
    );
  }

  // Show error state if video failed to load
  if (playback.videoLoadError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-900 rounded-lg p-8 ${className}`}
           style={{ minHeight: '300px', maxHeight }}>
        <div className="text-amber-500 mb-4">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-white text-lg font-semibold mb-2">Video Load Error</h3>
        <p className="text-gray-400 text-sm text-center mb-4 max-w-md">
          {playback.videoLoadError}
        </p>
        <button
          onClick={handlers.onReload}
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reload Video
        </button>
      </div>
    );
  }

  return (
    <VideoErrorBoundary
      videoId={playback.selectedVideo?.id}
      videoName={playback.selectedVideo?.name}
      gameId={gameId}
      cameraLabel={playback.selectedVideo?.camera_label || undefined}
      onReload={handlers.onReload}
    >
      <div className={`relative ${className}`}>
        <video
          ref={videoRef}
          src={playback.videoUrl}
          controls
          preload="metadata"
          className="w-full rounded-lg bg-black"
          style={{ maxHeight }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onError={handleError}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
        />

        {/* Camera switch loading overlay */}
        {camera.isSwitchingCamera && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              <span className="text-white text-sm">Switching camera...</span>
            </div>
          </div>
        )}
      </div>
    </VideoErrorBoundary>
  );
}));

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Create video playback handlers from dispatch/state
 * Use this when connecting to FilmContext
 */
export function createVideoHandlers(callbacks: {
  setCurrentTime: (time: number) => void;
  setGameTimelinePosition: (positionMs: number) => void;
  setVideoDuration: (duration: number) => void;
  setIsSwitchingCamera: (switching: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setVideoLoadError: (error: string | null) => void;
  setUrlRefreshAttempted: (attempted: boolean) => void;
  loadVideo: (video: Video) => void;
  selectedVideo: Video | null;
}): VideoPlaybackHandlers {
  return {
    onTimeUpdate: (currentTime, gameTimeMs) => {
      callbacks.setCurrentTime(currentTime);
      if (gameTimeMs >= 0) {
        callbacks.setGameTimelinePosition(gameTimeMs);
      }
    },
    onDurationChange: (duration) => {
      callbacks.setVideoDuration(duration);
    },
    onCanPlay: () => {
      callbacks.setIsSwitchingCamera(false);
    },
    onError: (error, urlRefreshAttempted) => {
      // Handle URL refresh on network errors
      const isNetworkOrSrcError = error?.code === 2 || error?.code === 4;

      if (!urlRefreshAttempted && callbacks.selectedVideo && isNetworkOrSrcError) {
        console.log('[VideoPlaybackPanel] Attempting URL refresh');
        callbacks.setUrlRefreshAttempted(true);
        callbacks.loadVideo(callbacks.selectedVideo);
        return;
      }

      // Show error
      callbacks.setVideoLoadError(
        urlRefreshAttempted
          ? 'Failed to load video after refresh. The file may be missing or corrupted.'
          : 'Failed to load video. Please try again.'
      );
    },
    onPlay: () => {
      callbacks.setIsPlaying(true);
    },
    onPause: () => {
      callbacks.setIsPlaying(false);
    },
    onEnded: () => {
      callbacks.setIsPlaying(false);
    },
    onReload: () => {
      if (callbacks.selectedVideo) {
        callbacks.loadVideo(callbacks.selectedVideo);
      }
    },
  };
}

export default VideoPlaybackPanel;
