'use client';

/**
 * TimelineControlsPanel
 *
 * Controls for timeline navigation: lane selection, playback speed, zoom.
 * Used alongside TagPageUnifiedTimeline for timeline interactions.
 *
 * @module components/film/panels/TimelineControlsPanel
 * @since Phase 3 - Component Decomposition
 */

import React, { memo, useCallback } from 'react';
import type { CameraLane, TimelineClip } from '@/types/timeline';
import type { Video } from '@/types/football';

// ============================================
// TYPES
// ============================================

export interface TimelineControlsProps {
  /** Available camera lanes */
  lanes: CameraLane[];
  /** Current active lane number */
  currentLane: number;
  /** Available videos */
  videos: Video[];
  /** Currently selected video */
  selectedVideo: Video | null;
  /** Current game timeline position (ms) */
  gameTimelinePositionMs: number;
  /** Total timeline duration (ms) */
  timelineDurationMs: number;
  /** Whether currently switching cameras */
  isSwitchingCamera: boolean;
  /** Callback when lane is selected */
  onLaneChange: (laneNumber: number) => void;
  /** Callback when camera is switched */
  onCameraSwitch: (videoId: string, gameTimeMs: number) => void;
  /** Callback when timeline position changes */
  onSeek: (gameTimeMs: number) => void;
  /** Additional class name */
  className?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Format milliseconds to display time
 */
function formatTimeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Find active clip at a given time
 */
function findActiveClip(
  lanes: CameraLane[],
  laneNumber: number,
  gameTimeMs: number
): TimelineClip | null {
  const lane = lanes.find((l) => l.lane === laneNumber);
  if (!lane) return null;

  return (
    lane.clips.find((clip) => {
      const clipEnd = clip.lanePositionMs + clip.durationMs;
      return gameTimeMs >= clip.lanePositionMs && gameTimeMs < clipEnd;
    }) || null
  );
}

// ============================================
// COMPONENT
// ============================================

/**
 * TimelineControlsPanel - Controls for timeline navigation
 */
export const TimelineControlsPanel = memo(function TimelineControlsPanel({
  lanes,
  currentLane,
  videos,
  selectedVideo,
  gameTimelinePositionMs,
  timelineDurationMs,
  isSwitchingCamera,
  onLaneChange,
  onCameraSwitch,
  onSeek,
  className = '',
}: TimelineControlsProps) {
  // Handle lane selection
  const handleLaneClick = useCallback(
    (laneNumber: number) => {
      if (laneNumber === currentLane) return;

      const clip = findActiveClip(lanes, laneNumber, gameTimelinePositionMs);
      if (clip) {
        onCameraSwitch(clip.videoId, gameTimelinePositionMs);
      }
      onLaneChange(laneNumber);
    },
    [lanes, currentLane, gameTimelinePositionMs, onLaneChange, onCameraSwitch]
  );

  // Handle camera button click
  const handleCameraClick = useCallback(
    (video: Video) => {
      if (selectedVideo?.id === video.id) return;
      onCameraSwitch(video.id, gameTimelinePositionMs);
    },
    [selectedVideo, gameTimelinePositionMs, onCameraSwitch]
  );

  // Get non-virtual videos
  const realVideos = videos.filter((v) => !v.is_virtual);

  // Calculate progress percentage
  const progressPercent =
    timelineDurationMs > 0
      ? (gameTimelinePositionMs / timelineDurationMs) * 100
      : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Time Display */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {formatTimeMs(gameTimelinePositionMs)}
        </span>
        <span className="text-gray-400">
          / {formatTimeMs(timelineDurationMs)}
        </span>
      </div>

      {/* Progress Bar */}
      <div
        className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percent = x / rect.width;
          const newTimeMs = percent * timelineDurationMs;
          onSeek(Math.max(0, Math.min(newTimeMs, timelineDurationMs)));
        }}
      >
        <div
          className="absolute left-0 top-0 h-full bg-black rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-black rounded-full border-2 border-white shadow"
          style={{ left: `${progressPercent}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

      {/* Camera Selector Pills */}
      {realVideos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {realVideos.map((video, index) => {
            const isSelected = selectedVideo?.id === video.id;
            const label = video.camera_label || `Camera ${index + 1}`;

            return (
              <button
                key={video.id}
                onClick={() => handleCameraClick(video)}
                disabled={isSwitchingCamera}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-full transition-colors
                  ${
                    isSelected
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                  ${isSwitchingCamera ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Lane Selector (if timeline mode is enabled) */}
      {lanes.length > 1 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Lanes:</p>
          <div className="flex flex-wrap gap-1">
            {lanes.map((lane) => (
              <button
                key={lane.lane}
                onClick={() => handleLaneClick(lane.lane)}
                className={`
                  px-2 py-1 text-xs font-medium rounded transition-colors
                  ${
                    currentLane === lane.lane
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {lane.label || `Lane ${lane.lane}`}
                <span className="ml-1 text-xs opacity-70">
                  ({lane.clips.length})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Switching Indicator */}
      {isSwitchingCamera && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
          <span>Switching camera...</span>
        </div>
      )}
    </div>
  );
});

// ============================================
// ADDITIONAL COMPONENTS
// ============================================

/**
 * TimelineZoomControls - Zoom level controls for timeline
 */
export const TimelineZoomControls = memo(function TimelineZoomControls({
  zoomLevel,
  onZoomChange,
  minZoom = 1,
  maxZoom = 16,
  className = '',
}: {
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}) {
  const zoomIn = () => {
    const newZoom = Math.min(zoomLevel * 2, maxZoom);
    onZoomChange(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(zoomLevel / 2, minZoom);
    onZoomChange(newZoom);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={zoomOut}
        disabled={zoomLevel <= minZoom}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
        title="Zoom out"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <span className="text-xs text-gray-500 min-w-[40px] text-center">
        {zoomLevel}x
      </span>
      <button
        onClick={zoomIn}
        disabled={zoomLevel >= maxZoom}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
        title="Zoom in"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
});

/**
 * PlaybackSpeedControl - Playback rate selector
 */
export const PlaybackSpeedControl = memo(function PlaybackSpeedControl({
  speed,
  onSpeedChange,
  className = '',
}: {
  speed: number;
  onSpeedChange: (speed: number) => void;
  className?: string;
}) {
  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-xs text-gray-500 mr-1">Speed:</span>
      {speeds.map((s) => (
        <button
          key={s}
          onClick={() => onSpeedChange(s)}
          className={`
            px-2 py-1 text-xs font-medium rounded transition-colors
            ${
              speed === s
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }
          `}
        >
          {s}x
        </button>
      ))}
    </div>
  );
});

export default TimelineControlsPanel;
