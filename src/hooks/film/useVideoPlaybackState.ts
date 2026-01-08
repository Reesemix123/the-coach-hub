'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

/**
 * Video object interface (minimal for this hook)
 */
interface VideoForPlayback {
  id: string;
  name?: string;
  file_path?: string;
  is_virtual?: boolean;
}

/**
 * Return type for the useVideoPlaybackState hook
 */
export interface VideoPlaybackState {
  // Refs
  videoRef: React.RefObject<HTMLVideoElement>;

  // URL State
  videoUrl: string;
  videoLoadError: string | null;
  urlGeneratedAt: number | null;
  urlRefreshAttempted: boolean;

  // Playback State
  currentTime: number;
  videoDuration: number;
  isPlaying: boolean;

  // Actions
  loadVideo: (video: VideoForPlayback) => Promise<void>;
  setCurrentTime: (time: number) => void;
  setVideoDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setVideoLoadError: (error: string | null) => void;
  setUrlRefreshAttempted: (attempted: boolean) => void;
  clearVideoUrl: () => void;
}

/**
 * URL refresh interval in milliseconds (45 minutes = 15 min before 1-hour expiry)
 */
const URL_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

/**
 * useVideoPlaybackState - Manages video playback state including URL lifecycle
 *
 * This hook encapsulates:
 * - Video URL generation and signed URL management
 * - URL refresh mechanism (auto-refresh before expiry)
 * - Basic playback state (currentTime, duration, isPlaying)
 * - Error handling for video loading
 *
 * Features:
 * - Auto-refreshes signed URLs 15 minutes before they expire
 * - Preserves playback position during URL refresh
 * - Tracks refresh attempts for error recovery
 *
 * @param selectedVideo - Currently selected video to manage playback for
 * @param gameId - Game ID for session tracking (optional)
 *
 * @example
 * ```tsx
 * const {
 *   videoRef,
 *   videoUrl,
 *   loadVideo,
 *   currentTime,
 *   isPlaying,
 * } = useVideoPlaybackState(selectedVideo, gameId);
 *
 * return (
 *   <video
 *     ref={videoRef}
 *     src={videoUrl}
 *     onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
 *   />
 * );
 * ```
 *
 * @since Phase 1 - Film System Refactor (Task 1.4)
 */
export function useVideoPlaybackState(
  selectedVideo: VideoForPlayback | null,
  gameId?: string
): VideoPlaybackState {
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement>(null);

  // URL State
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [urlGeneratedAt, setUrlGeneratedAt] = useState<number | null>(null);
  const [urlRefreshAttempted, setUrlRefreshAttempted] = useState(false);

  // Playback State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Load a video by generating a signed URL from Supabase storage
   */
  const loadVideo = useCallback(async (video: VideoForPlayback) => {
    // Clear any previous error
    setVideoLoadError(null);

    // Virtual videos don't need URLs
    if (video.is_virtual) {
      setVideoUrl('');
      return;
    }

    if (!video.file_path) {
      setVideoLoadError('Video file path not found. The video may have been deleted.');
      return;
    }

    const { data, error } = await supabase.storage
      .from('game_videos')
      .createSignedUrl(video.file_path, 3600);

    if (error) {
      console.error('[useVideoPlaybackState] Failed to create signed URL:', error);
      setVideoLoadError('Failed to access video file. Please try refreshing the page.');
      return;
    }

    if (data?.signedUrl) {
      setVideoUrl(data.signedUrl);
      setUrlGeneratedAt(Date.now());
      setUrlRefreshAttempted(false);
      console.log('[useVideoPlaybackState] Signed URL generated, will refresh in 45 minutes');
    }
  }, [supabase]);

  /**
   * Clear video URL (used when stopping playback or handling errors)
   */
  const clearVideoUrl = useCallback(() => {
    setVideoUrl('');
    setUrlGeneratedAt(null);
  }, []);

  /**
   * Auto-refresh signed URLs before they expire
   */
  useEffect(() => {
    if (!urlGeneratedAt || !selectedVideo || !videoUrl) return;

    const timeSinceGeneration = Date.now() - urlGeneratedAt;
    const timeUntilRefresh = URL_REFRESH_INTERVAL_MS - timeSinceGeneration;

    // If URL is already old (e.g., tab was backgrounded), refresh immediately
    if (timeUntilRefresh <= 0) {
      console.log('[useVideoPlaybackState] URL is stale, refreshing immediately');
      loadVideo(selectedVideo);
      return;
    }

    console.log(`[useVideoPlaybackState] Scheduling refresh in ${Math.round(timeUntilRefresh / 60000)} minutes`);

    const refreshTimer = setTimeout(() => {
      console.log('[useVideoPlaybackState] Auto-refreshing signed URL');

      // Store current playback state
      const wasPlaying = videoRef.current && !videoRef.current.paused;
      const currentPosition = videoRef.current?.currentTime || 0;

      // Refresh the URL
      loadVideo(selectedVideo).then(() => {
        if (videoRef.current) {
          const restorePlayback = () => {
            if (videoRef.current) {
              videoRef.current.currentTime = currentPosition;
              if (wasPlaying) {
                videoRef.current.play().catch(() => {
                  // Autoplay may be blocked, that's ok
                });
              }
              console.log('[useVideoPlaybackState] Restored playback position:', currentPosition);
            }
          };

          if (videoRef.current.readyState >= 1) {
            restorePlayback();
          } else {
            videoRef.current.addEventListener('loadedmetadata', restorePlayback, { once: true });
          }
        }
      });
    }, timeUntilRefresh);

    return () => {
      clearTimeout(refreshTimer);
    };
  }, [urlGeneratedAt, selectedVideo, videoUrl, loadVideo]);

  return {
    // Refs
    videoRef,

    // URL State
    videoUrl,
    videoLoadError,
    urlGeneratedAt,
    urlRefreshAttempted,

    // Playback State
    currentTime,
    videoDuration,
    isPlaying,

    // Actions
    loadVideo,
    setCurrentTime,
    setVideoDuration,
    setIsPlaying,
    setVideoLoadError,
    setUrlRefreshAttempted,
    clearVideoUrl,
  };
}

export default useVideoPlaybackState;
