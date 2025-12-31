'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface CameraOption {
  id: string;  // Primary video ID for this lane (used for onClick)
  allVideoIds: string[];  // All video IDs on this lane (for selection check)
  name: string;
  label: string;
  order: number;
  syncOffsetSeconds: number;
  url: string;
}

interface TimelineCameraSelectorProps {
  gameId: string;
  selectedCameraId: string | null;
  onCameraSwitch: (cameraId: string) => void;
}

/**
 * Camera selector that shows cameras from the timeline swimlanes.
 * Only shows cameras that have clips in video_group_members.
 */
export function TimelineCameraSelector({
  gameId,
  selectedCameraId,
  onCameraSwitch,
}: TimelineCameraSelectorProps) {
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadTimelineCameras() {
      if (!gameId) {
        setCameras([]);
        setIsLoading(false);
        return;
      }

      try {
        // Get the timeline video_group for this game
        const { data: videoGroups, error: vgError } = await supabase
          .from('video_groups')
          .select('id')
          .eq('game_id', gameId)
          .eq('is_timeline_mode', true)
          .limit(1);

        console.log('[TimelineCameraSelector] videoGroup:', videoGroups?.[0], 'error:', vgError);

        if (!videoGroups || videoGroups.length === 0) {
          console.log('[TimelineCameraSelector] No timeline video group found for game');
          setCameras([]);
          setIsLoading(false);
          return;
        }

        const videoGroupId = videoGroups[0].id;

        // Get video IDs from video_group_members (the actual clips in swimlanes)
        const { data: members, error: membersError } = await supabase
          .from('video_group_members')
          .select('video_id, camera_lane, camera_label')
          .eq('video_group_id', videoGroupId);

        console.log('[TimelineCameraSelector] members:', members?.length, 'error:', membersError);

        if (!members || members.length === 0) {
          console.log('[TimelineCameraSelector] No clips in timeline');
          setCameras([]);
          setIsLoading(false);
          return;
        }

        // Get unique video IDs
        const videoIds = [...new Set(members.map(m => m.video_id))];
        console.log('[TimelineCameraSelector] unique video IDs from members:', videoIds);

        // Fetch video details
        const { data: videos, error: videosError } = await supabase
          .from('videos')
          .select('id, name, url, camera_label, camera_order, sync_offset_seconds')
          .in('id', videoIds)
          .eq('is_virtual', false);

        console.log('[TimelineCameraSelector] videos found:', videos?.length, 'error:', videosError);

        if (videos && videos.length > 0) {
          // Group by camera_lane - one pill per lane, collect ALL video IDs per lane
          const laneMap = new Map<number, {
            videoIds: string[];  // All video IDs on this lane
            primaryVideoId: string;
            label: string;
            lane: number;
            syncOffsetSeconds: number;
            url: string;
          }>();

          for (const member of members) {
            const lane = member.camera_lane;
            const video = videos.find(v => v.id === member.video_id);

            if (video && video.url) {
              if (!laneMap.has(lane)) {
                // First video on this lane
                laneMap.set(lane, {
                  videoIds: [video.id],
                  primaryVideoId: video.id,
                  label: member.camera_label || video.camera_label || `Camera ${lane}`,
                  lane,
                  syncOffsetSeconds: video.sync_offset_seconds || 0,
                  url: video.url,
                });
              } else {
                // Add additional video ID to existing lane
                const existing = laneMap.get(lane)!;
                if (!existing.videoIds.includes(video.id)) {
                  existing.videoIds.push(video.id);
                }
              }
            }
          }

          const cameraOptions: CameraOption[] = Array.from(laneMap.values()).map(item => ({
            id: item.primaryVideoId,
            allVideoIds: item.videoIds,
            name: item.label,
            label: item.label,
            order: item.lane,
            syncOffsetSeconds: item.syncOffsetSeconds,
            url: item.url,
          }));

          cameraOptions.sort((a, b) => a.order - b.order);
          console.log('[TimelineCameraSelector] Setting cameras (by lane):', cameraOptions.map(c => c.label));
          setCameras(cameraOptions);
        } else {
          setCameras([]);
        }
      } catch (error) {
        console.error('[TimelineCameraSelector] Error loading cameras:', error);
        setCameras([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadTimelineCameras();
  }, [gameId, supabase]);

  // Don't show if loading or only one camera
  if (isLoading || cameras.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {cameras.map((camera) => {
        // Check if the selected video is ANY video on this lane
        // Fallback to id check if allVideoIds not yet populated
        const videoIds = camera.allVideoIds || [camera.id];
        const isSelected = selectedCameraId !== null && videoIds.includes(selectedCameraId);

        return (
          <button
            key={camera.id}
            onClick={() => onCameraSwitch(camera.id)}
            className={`
              px-3 py-1.5 text-sm rounded-full transition-all duration-200
              ${isSelected
                ? 'bg-black text-white font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {camera.label}
            {camera.syncOffsetSeconds !== 0 && (
              <span className="ml-1 text-xs opacity-60">
                {camera.syncOffsetSeconds >= 0 ? '+' : ''}{camera.syncOffsetSeconds.toFixed(1)}s
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TimelineCameraSelector;
