'use client';

import { useEffect, type RefObject } from 'react';
import { createClient } from '@/utils/supabase/client';
import { filmSessionService } from '@/lib/services/film-session.service';
import type { useFilmStateBridge } from '@/components/film/context';

// ============================================
// TYPES
// ============================================

interface UseVideoManagementOptions {
  gameId: string;
  teamId: string;
  bridge: ReturnType<typeof useFilmStateBridge>;
  videoRef: RefObject<HTMLVideoElement | null>;
  onIsPlayingChange: (playing: boolean) => void;
  onFetchMarkers: (videoId: string) => void;
}

// ============================================
// HOOK
// ============================================

export function useVideoManagement({
  gameId,
  teamId,
  bridge,
  videoRef,
  onIsPlayingChange,
  onFetchMarkers,
}: UseVideoManagementOptions) {
  const supabase = createClient();
  const { selectedVideo, videoUrl, urlGeneratedAt } = bridge.state.playback;
  const { videos } = bridge.state.data;

  // ========== FUNCTIONS ==========

  async function loadVideo(video: { id: string; is_virtual?: boolean; file_path?: string; url?: string }) {
    // Clear any previous error
    bridge.setVideoLoadError(null);

    // If it's a virtual video, we don't need to load a URL
    if (video.is_virtual) {
      bridge.setVideoUrl(''); // Clear URL for virtual videos
      return;
    }

    if (!video.file_path) {
      bridge.setVideoLoadError('Video file path not found. The video may have been deleted.');
      return;
    }

    const { data, error } = await supabase.storage
      .from('game_videos')
      .createSignedUrl(video.file_path, 3600);

    if (error) {
      console.error('[loadVideo] Failed to create signed URL:', error);
      bridge.setVideoLoadError('Failed to access video file. Please try refreshing the page.');
      return;
    }

    if (data?.signedUrl) {
      bridge.setVideoUrl(data.signedUrl);
      bridge.setUrlGeneratedAt(Date.now());
      bridge.setUrlRefreshAttempted(false); // Reset refresh flag for new URL
      console.log('[loadVideo] Signed URL generated, will refresh in 45 minutes');
    }
  }

  async function handleSyncCamera(cameraId: string, offsetSeconds: number) {
    try {
      const response = await fetch(`/api/teams/${teamId}/videos/${cameraId}/sync`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_offset_seconds: offsetSeconds }),
      });

      if (response.ok) {
        // Update local state
        bridge.setVideos(videos.map((v: { id: string; sync_offset_seconds?: number }) =>
          v.id === cameraId ? { ...v, sync_offset_seconds: offsetSeconds } : v
        ));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update sync');
      }
    } catch (error) {
      console.error('Error syncing camera:', error);
      alert('Failed to update sync offset');
    }
  }

  // ========== EFFECTS ==========

  // Video selection & validation
  useEffect(() => {
    // Check if selectedVideo is still in the videos array (handles deleted videos)
    const selectedVideoInArray = selectedVideo && videos.find((v: { id: string }) => v.id === selectedVideo.id);

    // A video is valid if it exists in the array AND has a url or file_path
    const selectedVideoIsValid = selectedVideoInArray && (selectedVideoInArray.url || selectedVideoInArray.file_path);

    if (selectedVideoIsValid) {
      // Selected video is valid, load it
      loadVideo(selectedVideoInArray);
      onFetchMarkers(selectedVideoInArray.id);
    } else if (videos.length > 0) {
      // Find the first video with a valid URL/file_path (skip orphaned records)
      const validVideo = videos.find((v: { url?: string; file_path?: string }) => v.url || v.file_path);
      if (validVideo) {
        console.log('[TagPage] Selecting valid video:', validVideo.id, validVideo.name);
        bridge.setSelectedVideo(validVideo);
      } else {
        // No valid videos available
        console.log('[TagPage] No valid videos found (all missing URLs)');
        bridge.setSelectedVideo(null);
      }
    } else if (selectedVideo) {
      // Videos array is empty but we have a stale selection, clear it
      console.log('[TagPage] Clearing stale selectedVideo - no videos available');
      bridge.setSelectedVideo(null);
    }
  }, [selectedVideo, videos]);

  // Auto-refresh signed URLs before they expire (45 min = 15 min before 1-hour expiry)
  useEffect(() => {
    if (!urlGeneratedAt || !selectedVideo || !videoUrl) return;

    const URL_REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes
    const timeSinceGeneration = Date.now() - urlGeneratedAt;
    const timeUntilRefresh = URL_REFRESH_INTERVAL_MS - timeSinceGeneration;

    // If URL is already old (e.g., tab was backgrounded), refresh immediately
    if (timeUntilRefresh <= 0) {
      console.log('[URL Refresh] URL is stale, refreshing immediately');
      loadVideo(selectedVideo);
      return;
    }

    console.log(`[URL Refresh] Scheduling refresh in ${Math.round(timeUntilRefresh / 60000)} minutes`);

    const refreshTimer = setTimeout(() => {
      console.log('[URL Refresh] Auto-refreshing signed URL');
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
              console.log('[URL Refresh] Restored playback position:', currentPosition);
            }
          };

          // Wait for the new video to be ready
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
  }, [urlGeneratedAt, selectedVideo, videoUrl]);

  // Video element event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => bridge.setCurrentTime(video.currentTime);
    const handlePlay = () => onIsPlayingChange(true);
    const handlePause = () => {
      onIsPlayingChange(false);
      // Save position when video pauses
      if (selectedVideo && gameId) {
        filmSessionService.savePosition(gameId, selectedVideo.id, video.currentTime * 1000).catch(console.error);
      }
    };
    const handleLoadedMetadata = () => {
      // Just set the duration - the separate seek useEffect handles pending seeks
      bridge.setVideoDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [selectedVideo, gameId]);

  return {
    loadVideo,
    handleSyncCamera,
  };
}
