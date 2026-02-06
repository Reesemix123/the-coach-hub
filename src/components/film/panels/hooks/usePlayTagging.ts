'use client';

import { useState, type RefObject } from 'react';
import { createClient } from '@/utils/supabase/client';
import { DriveService } from '@/lib/services/drive.service';
import type { TaggingTier } from '@/types/football';
import type { CameraLane } from '@/types/timeline';
import type { useFilmStateBridge } from '@/components/film/context';

// ============================================
// TYPES
// ============================================

interface UsePlayTaggingOptions {
  bridge: ReturnType<typeof useFilmStateBridge>;
  videoRef: RefObject<HTMLVideoElement | null>;
  taggingTier: TaggingTier | null;
  timelineLanes: CameraLane[];
  onShowTierSelector: () => void;
  onFetchDrives: () => Promise<void>;
  onFetchPlayInstances: (videoIds: string[]) => Promise<void>;
}

// ============================================
// HOOK
// ============================================

export function usePlayTagging({
  bridge,
  videoRef,
  taggingTier,
  timelineLanes,
  onShowTierSelector,
  onFetchDrives,
  onFetchPlayInstances,
}: UsePlayTaggingOptions) {
  const supabase = createClient();
  const driveService = new DriveService();
  const { selectedVideo, videos } = bridge.state.playback;
  const { playInstances } = bridge.state.data;
  const { tagStartTime } = bridge.state.tagging;

  const [isSettingEndTime, setIsSettingEndTime] = useState(false);

  function getPreviousPlay() {
    if (playInstances.length === 0) return null;

    const previousPlays = playInstances
      .filter((p: { timestamp_start: number }) => p.timestamp_start < tagStartTime)
      .sort((a: { timestamp_start: number }, b: { timestamp_start: number }) => b.timestamp_start - a.timestamp_start);

    return previousPlays[0] || null;
  }

  function handleMarkPlayStart() {
    if (!videoRef.current) return;

    // Check if tagging tier is set - if not, show the tier selector
    if (!taggingTier) {
      onShowTierSelector();
      return;
    }

    bridge.setTagStartTime(videoRef.current.currentTime);
    bridge.setTagEndTime(null);
    setIsSettingEndTime(true);
    if (videoRef.current.paused) {
      videoRef.current.play();
    }
  }

  function handleMarkPlayEnd() {
    if (!videoRef.current) return;
    bridge.setTagEndTime(videoRef.current.currentTime);
    setIsSettingEndTime(false);
    bridge.setShowTagModal(true);
    videoRef.current.pause();
  }

  function handleEditInstance(instance: { id: string; timestamp_start: number; timestamp_end?: number; [key: string]: unknown }) {
    bridge.setEditingInstance(instance);
    bridge.setTagStartTime(instance.timestamp_start);
    bridge.setTagEndTime(instance.timestamp_end || null);
    bridge.setShowTagModal(true);
  }

  function jumpToPlay(timestamp: number, endTimestamp?: number, sourceCameraId?: string) {
    if (videoRef.current && selectedVideo) {
      let syncedTimestamp = timestamp;
      let syncedEndTimestamp = endTimestamp;

      if (sourceCameraId && sourceCameraId !== selectedVideo.id) {
        const sourceCamera = videos.find((v: { id: string }) => v.id === sourceCameraId);
        const targetCamera = selectedVideo;

        if (sourceCamera && targetCamera) {
          const sourceOffset = (sourceCamera as { sync_offset_seconds?: number }).sync_offset_seconds || 0;
          const targetOffset = (targetCamera as { sync_offset_seconds?: number }).sync_offset_seconds || 0;

          syncedTimestamp = timestamp + sourceOffset - targetOffset;
          if (endTimestamp) {
            syncedEndTimestamp = endTimestamp + sourceOffset - targetOffset;
          }
        }
      }

      syncedTimestamp = Math.max(0, syncedTimestamp);
      videoRef.current.currentTime = syncedTimestamp;
      videoRef.current.play();

      if (syncedEndTimestamp) {
        const checkTime = setInterval(() => {
          if (videoRef.current && videoRef.current.currentTime >= syncedEndTimestamp!) {
            videoRef.current.pause();
            clearInterval(checkTime);
          }
        }, 100);
      }
    }
  }

  async function deletePlayInstance(instanceId: string) {
    if (!confirm('Delete this play tag? This cannot be undone.')) return;

    try {
      const { data: playInstance } = await supabase
        .from('play_instances')
        .select('drive_id')
        .eq('id', instanceId)
        .single();

      const { error } = await supabase
        .from('play_instances')
        .delete()
        .eq('id', instanceId);

      if (error) throw error;

      if (playInstance?.drive_id) {
        await driveService.recalculateDriveStats(playInstance.drive_id);
        await onFetchDrives();
      }

      const timelineVideoIds = [...new Set(timelineLanes.flatMap(lane => lane.clips.map(clip => clip.videoId)))];
      onFetchPlayInstances(timelineVideoIds);
    } catch (error: unknown) {
      alert('Error deleting play: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  function cancelTagging() {
    setIsSettingEndTime(false);
  }

  return {
    isSettingEndTime,
    getPreviousPlay,
    handleMarkPlayStart,
    handleMarkPlayEnd,
    handleEditInstance,
    jumpToPlay,
    deletePlayInstance,
    cancelTagging,
  };
}
