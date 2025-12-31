'use client';

import { useCallback, useMemo } from 'react';
import { UnifiedTimeline } from '@/components/film-studio/timeline/UnifiedTimeline';
import { useFilmStudio } from '@/components/film-studio/context/FilmStudioContext';
import type { Video, VideoTimelineMarker } from '@/types/football';

interface TagPageUnifiedTimelineProps {
  videos: Video[];
  markers?: VideoTimelineMarker[];
  onUploadComplete: () => void;
  onMarkerClick?: (marker: VideoTimelineMarker) => void;
}

/**
 * Wrapper component that adapts the tag page's video data
 * to work with the UnifiedTimeline component from Film Studio.
 */
export function TagPageUnifiedTimeline({
  videos,
  markers = [],
  onUploadComplete,
  onMarkerClick,
}: TagPageUnifiedTimelineProps) {
  const { state, dispatch, loadTimeline, loadCameras, timelineService } = useFilmStudio();

  // Convert tag page videos to the format expected by UnifiedTimeline
  const availableVideos = useMemo(() => {
    return videos
      .filter(v => !v.is_virtual && v.url)
      .map(v => ({
        id: v.id,
        name: v.name,
        url: v.url || '',
        thumbnailUrl: v.thumbnail_url || null,
        durationMs: (v.duration_seconds || 0) * 1000,
        cameraOrder: v.camera_order || 1,
        cameraLabel: v.camera_label || null,
      }));
  }, [videos]);

  // Handle upload - this bridges to the tag page's upload flow
  const handleUploadStart = useCallback(
    async (file: File, lane: number) => {
      console.log('[TagPageUnifiedTimeline] Upload starting:', { fileName: file.name, lane });
      dispatch({ type: 'START_UPLOAD', lane });
      dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', progress: 0, status: 'Reading video...' });

      try {
        // Extract video duration before uploading
        const durationSeconds = await new Promise<number>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';

          video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            const duration = Math.round(video.duration);
            console.log('[TagPageUnifiedTimeline] Video duration:', duration, 'seconds');
            resolve(duration);
          };

          video.onerror = () => {
            window.URL.revokeObjectURL(video.src);
            console.warn('[TagPageUnifiedTimeline] Could not read video duration');
            resolve(0);
          };

          video.src = URL.createObjectURL(file);
        });

        // Create a unique file path
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${state.teamId}/${state.gameId}/${timestamp}_${sanitizedName}`;

        console.log('[TagPageUnifiedTimeline] Uploading to path:', filePath);

        // Get Supabase client
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();

        // Get auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No auth session - please log in again');
        }

        dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', progress: 0, status: 'Uploading...' });

        // Upload to Supabase storage using XMLHttpRequest for progress tracking
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const uploadUrl = `${supabaseUrl}/storage/v1/object/game_videos/${filePath}`;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              dispatch({
                type: 'UPDATE_UPLOAD_PROGRESS',
                progress,
                status: `Uploading... ${progress}%`,
              });
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed due to network error'));
          });

          xhr.open('POST', uploadUrl);
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
          xhr.setRequestHeader('x-upsert', 'false');
          xhr.send(file);
        });

        console.log('[TagPageUnifiedTimeline] Upload complete, creating video record');
        dispatch({ type: 'UPDATE_UPLOAD_PROGRESS', progress: 100, status: 'Processing...' });

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('game_videos')
          .getPublicUrl(filePath);

        // Get lane label from current state
        const currentLaneLabel = state.timeline?.lanes.find(l => l.lane === lane)?.label || `Camera ${lane}`;

        // Create video record
        const { data: insertedVideo, error: insertError } = await supabase
          .from('videos')
          .insert({
            name: file.name,
            file_path: filePath,
            url: urlData.publicUrl,
            game_id: state.gameId,
            camera_order: lane,
            camera_label: currentLaneLabel,
            upload_status: 'ready',
            is_virtual: false,
            duration_seconds: durationSeconds > 0 ? durationSeconds : null,
          })
          .select('id, duration_seconds')
          .single();

        if (insertError) {
          console.error('[TagPageUnifiedTimeline] Insert error:', insertError);
          throw insertError;
        }

        console.log('[TagPageUnifiedTimeline] Video record created:', insertedVideo?.id);

        // Get fresh timeline data (avoid stale closure issue from long uploads)
        const freshTimeline = await timelineService.getOrCreateTimeline(state.gameId, state.teamId);
        console.log('[TagPageUnifiedTimeline] Fresh timeline:', freshTimeline?.videoGroupId);

        // Add the video as a clip to the timeline
        if (freshTimeline?.videoGroupId && insertedVideo?.id) {
          // Calculate position: place after the last clip in this lane
          const laneData = freshTimeline.lanes.find(l => l.lane === lane);
          let positionMs = 0;

          if (laneData && laneData.clips.length > 0) {
            const lastClipEnd = Math.max(
              ...laneData.clips.map(c => c.lanePositionMs + c.durationMs)
            );
            positionMs = lastClipEnd;
          }

          // Use fresh lane label (in case it was updated during upload)
          const freshLaneLabel = laneData?.label || `Camera ${lane}`;

          await timelineService.addClip(
            freshTimeline.videoGroupId,
            {
              videoId: insertedVideo.id,
              cameraLane: lane,
              positionMs,
              label: freshLaneLabel,
            },
            state.gameId,
            false
          );
          console.log('[TagPageUnifiedTimeline] Clip added to timeline');
        } else {
          console.warn('[TagPageUnifiedTimeline] Could not add clip - no timeline or video ID', {
            hasTimeline: !!freshTimeline?.videoGroupId,
            hasVideoId: !!insertedVideo?.id
          });
        }

        // Reload timeline and cameras
        await loadTimeline();
        await loadCameras();

        // Notify tag page to refresh its video list
        onUploadComplete();

        console.log('[TagPageUnifiedTimeline] Upload complete!');
        dispatch({ type: 'COMPLETE_UPLOAD' });
      } catch (err) {
        console.error('[TagPageUnifiedTimeline] Upload failed:', err);
        dispatch({ type: 'CANCEL_UPLOAD' });
      }
    },
    [dispatch, state.teamId, state.gameId, state.timeline, loadTimeline, loadCameras, timelineService, onUploadComplete]
  );

  return (
    <UnifiedTimeline
      availableVideos={availableVideos}
      markers={markers}
      onUploadStart={handleUploadStart}
      onMarkerClick={onMarkerClick}
    />
  );
}

export default TagPageUnifiedTimeline;
