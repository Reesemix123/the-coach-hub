'use client';

import React, { memo } from 'react';
import { formatTime } from '@/lib/utils/resumable-upload';

// ============================================
// TYPES
// ============================================

interface PlayInstance {
  id: string;
  play_code?: string;
  timestamp_start: number;
  timestamp_end?: number | null;
  camera_id?: string;
  video_id?: string;
  [key: string]: any;
}

export interface PlayTimelineBarProps {
  playInstances: PlayInstance[];
  videoDuration: number;
  timelineDurationMs: number;
  videoOffsetMs: number;
  gameTimelinePositionMs: number;
  onJumpToPlay: (startTime: number, endTime?: number, cameraId?: string) => void;
}

// ============================================
// HELPERS
// ============================================

const PLAY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

function getPlayColor(index: number): string {
  return PLAY_COLORS[index % PLAY_COLORS.length];
}

// ============================================
// COMPONENT
// ============================================

export const PlayTimelineBar = memo(function PlayTimelineBar({
  playInstances,
  videoDuration,
  timelineDurationMs,
  videoOffsetMs,
  gameTimelinePositionMs,
  onJumpToPlay,
}: PlayTimelineBarProps) {
  const gameDurationMs = timelineDurationMs > 0 ? timelineDurationMs : videoDuration * 1000;
  const gameTimeMs = gameTimelinePositionMs > 0 ? gameTimelinePositionMs : videoOffsetMs + (videoDuration * 500); // fallback center
  const gameDurationSec = gameDurationMs / 1000;

  // Calculate video's coverage area on the timeline
  const videoStartPercent = (videoOffsetMs / gameDurationMs) * 100;
  const videoEndPercent = ((videoOffsetMs + (videoDuration * 1000)) / gameDurationMs) * 100;
  const videoWidthPercent = videoEndPercent - videoStartPercent;

  return (
    <div className="space-y-2">
      <div className="relative h-12 bg-gray-100 rounded overflow-hidden border border-gray-200">
        {/* Video coverage area indicator */}
        {timelineDurationMs > 0 && videoWidthPercent < 100 && (
          <div
            className="absolute top-0 bottom-0 bg-blue-50 border-x border-blue-200"
            style={{
              left: `${videoStartPercent}%`,
              width: `${videoWidthPercent}%`,
            }}
          />
        )}

        {/* Playhead - positioned at game time */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-red-500 z-20"
          style={{ left: `${(gameTimeMs / gameDurationMs) * 100}%` }}
        />

        {/* Play instances - positioned at game time */}
        {playInstances.map((instance, index) => {
          const instanceGameStartMs = videoOffsetMs + (instance.timestamp_start * 1000);
          const instanceGameEndMs = instance.timestamp_end
            ? videoOffsetMs + (instance.timestamp_end * 1000)
            : instanceGameStartMs + 1000;

          const startPercent = (instanceGameStartMs / gameDurationMs) * 100;
          const endPercent = (instanceGameEndMs / gameDurationMs) * 100;
          const width = Math.max(endPercent - startPercent, 0.5);

          return (
            <div
              key={instance.id}
              className="absolute top-0 bottom-0 opacity-70 hover:opacity-100 cursor-pointer group transition-opacity"
              style={{
                left: `${startPercent}%`,
                width: `${width}%`,
                backgroundColor: getPlayColor(index)
              }}
              onClick={() => onJumpToPlay(instance.timestamp_start, instance.timestamp_end || undefined, instance.camera_id || instance.video_id)}
            >
              <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-30">
                {instance.play_code} - {formatTime(instance.timestamp_start)}
              </div>
            </div>
          );
        })}

        {/* Time labels - show game duration */}
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-gray-600 pointer-events-none">
          <span>0:00</span>
          <span>{formatTime(gameDurationSec)}</span>
        </div>
      </div>
    </div>
  );
});

export default PlayTimelineBar;
