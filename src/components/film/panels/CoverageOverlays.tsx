'use client';

import React from 'react';
import type { CameraLane } from '@/types/timeline';
import { findActiveClipForTime } from '@/types/timeline';
import { formatTime } from '@/lib/utils/resumable-upload';

// ============================================
// TYPES
// ============================================

export interface CoverageOverlaysProps {
  timelineDurationMs: number;
  isSwitchingCamera: boolean;
  pendingCameraId: string | null;
  videoDuration: number;
  videoOffsetMs: number;
  clipDurationMs: number;
  selectedVideoSyncOffset: number;
  targetGameTimeMs: number | null;
  gameTimelinePositionMs: number;
  timelineLanes: CameraLane[];
  currentLaneNumber: number;
  isVirtuallyPlaying: boolean;
  onDismissOverlay: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function CoverageOverlays({
  timelineDurationMs,
  isSwitchingCamera,
  pendingCameraId,
  videoDuration,
  videoOffsetMs,
  clipDurationMs,
  selectedVideoSyncOffset,
  targetGameTimeMs,
  gameTimelinePositionMs,
  timelineLanes,
  currentLaneNumber,
  isVirtuallyPlaying,
  onDismissOverlay,
}: CoverageOverlaysProps) {
  if (timelineDurationMs <= 0 || isSwitchingCamera) return null;

  // If we're waiting for coverage check (camera just switched), show loading overlay
  if (pendingCameraId !== null) {
    return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent mb-3" />
          <div className="text-white text-lg font-semibold">
            Checking coverage...
          </div>
        </div>
      </div>
    );
  }

  // Need video duration to calculate coverage
  if (videoDuration <= 0) return null;

  // Use timeline clip data if available, otherwise fall back to video's sync_offset_seconds
  const syncOffsetMs = selectedVideoSyncOffset * 1000;
  const videoStartMs = clipDurationMs > 0 ? videoOffsetMs : syncOffsetMs;
  // CRITICAL: Use the MINIMUM of clip duration and actual video duration
  const actualVideoDurationMs = videoDuration * 1000;
  const effectiveDurationMs = clipDurationMs > 0
    ? Math.min(clipDurationMs, actualVideoDurationMs)
    : actualVideoDurationMs;
  const videoEndMs = videoStartMs + effectiveDurationMs;

  // Check if we just switched cameras and the target game time is outside coverage
  if (targetGameTimeMs !== null) {
    const targetOutsideCoverage = targetGameTimeMs < videoStartMs || targetGameTimeMs >= videoEndMs;
    if (targetOutsideCoverage) {
      return (
        <div
          className="absolute inset-0 bg-black flex items-center justify-center rounded-lg cursor-pointer"
          onClick={onDismissOverlay}
          title="Click to dismiss and view available footage"
        >
          <div className="text-center p-8">
            <div className="text-white text-lg font-semibold mb-2">
              No film available for this part of the game
            </div>
            <div className="text-gray-300 text-sm mb-4">
              This camera only covers {formatTime(videoStartMs / 1000)} - {formatTime(videoEndMs / 1000)} in the game timeline.
            </div>
            <div className="text-gray-400 text-sm mb-4">
              You were viewing {formatTime(targetGameTimeMs / 1000)} in the game.
            </div>
            <div className="text-gray-400 text-sm">
              Choose a different camera or click to dismiss.
            </div>
          </div>
        </div>
      );
    }
  }

  // Check if we're in a gap (using findActiveClipForTime)
  const activeClipInfo = timelineLanes.length > 0
    ? findActiveClipForTime(timelineLanes, currentLaneNumber, gameTimelinePositionMs)
    : null;

  // Show gap overlay if in virtual playback mode or timeline is in a gap
  if (isVirtuallyPlaying || (activeClipInfo && activeClipInfo.isInGap)) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center rounded-lg">
        <div className="text-center p-8">
          <div className="text-white text-lg font-semibold mb-2">
            No film available at this time
          </div>
          <div className="text-gray-300 text-sm mb-2">
            Game time: {formatTime(gameTimelinePositionMs / 1000)}
          </div>
          {activeClipInfo?.nextClipStartMs && (
            <div className="text-gray-400 text-sm mb-4">
              {isVirtuallyPlaying
                ? `Playing... next clip at ${formatTime(activeClipInfo.nextClipStartMs / 1000)}`
                : `Next clip starts at ${formatTime(activeClipInfo.nextClipStartMs / 1000)}`
              }
            </div>
          )}
          {isVirtuallyPlaying && (
            <div className="mt-4">
              <div className="inline-block animate-pulse w-2 h-2 bg-white rounded-full mr-2" />
              <span className="text-gray-300 text-sm">Timeline advancing...</span>
            </div>
          )}
          {!isVirtuallyPlaying && (
            <div className="text-gray-500 text-sm mt-4">
              Drag timeline or choose a different camera
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default CoverageOverlays;
