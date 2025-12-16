'use client';

import { useCallback, useRef } from 'react';
import { formatTimeMs, timeToPixels, TIMELINE_CONSTANTS } from '@/types/timeline';

interface TimelineRulerProps {
  totalDurationMs: number;
  zoomLevel: number;
  playheadPositionMs: number;
  onSeek: (timeMs: number) => void;
}

export function TimelineRuler({
  totalDurationMs,
  zoomLevel,
  playheadPositionMs,
  onSeek,
}: TimelineRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);

  // Calculate tick interval based on zoom level
  const getTickInterval = () => {
    // At zoom 1, show marks every 5 minutes (300000ms)
    // At higher zoom, show more detail
    if (zoomLevel >= 8) return 15000;   // 15 seconds
    if (zoomLevel >= 4) return 30000;   // 30 seconds
    if (zoomLevel >= 2) return 60000;   // 1 minute
    if (zoomLevel >= 1) return 300000;  // 5 minutes
    return 600000;                       // 10 minutes
  };

  const getMinorTickInterval = () => {
    const major = getTickInterval();
    return major / 5; // 5 minor ticks per major tick
  };

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rulerRef.current) return;

      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pixelsPerMs = (TIMELINE_CONSTANTS.PIXELS_PER_SECOND_BASE * zoomLevel) / 1000;
      const timeMs = x / pixelsPerMs;

      // Clamp to valid range
      const clampedTime = Math.max(0, Math.min(timeMs, totalDurationMs));
      onSeek(clampedTime);
    },
    [zoomLevel, totalDurationMs, onSeek]
  );

  // Generate tick marks
  const majorInterval = getTickInterval();
  const minorInterval = getMinorTickInterval();
  const width = timeToPixels(totalDurationMs, zoomLevel);

  const majorTicks: number[] = [];
  const minorTicks: number[] = [];

  for (let time = 0; time <= totalDurationMs; time += majorInterval) {
    majorTicks.push(time);
  }

  for (let time = 0; time <= totalDurationMs; time += minorInterval) {
    // Skip if it's a major tick
    if (time % majorInterval !== 0) {
      minorTicks.push(time);
    }
  }

  const playheadX = timeToPixels(playheadPositionMs, zoomLevel);

  return (
    <div
      ref={rulerRef}
      className="relative h-8 bg-gray-100 border-b border-gray-300 cursor-pointer select-none"
      style={{ width: Math.max(width, 800), minWidth: '100%' }}
      onClick={handleClick}
    >
      {/* Minor tick marks */}
      {minorTicks.map((time) => (
        <div
          key={`minor-${time}`}
          className="absolute bottom-0 w-px h-2 bg-gray-300"
          style={{ left: timeToPixels(time, zoomLevel) }}
        />
      ))}

      {/* Major tick marks with labels */}
      {majorTicks.map((time) => (
        <div
          key={`major-${time}`}
          className="absolute bottom-0"
          style={{ left: timeToPixels(time, zoomLevel) }}
        >
          <div className="w-px h-4 bg-gray-500" />
          <span className="absolute bottom-4 left-0 transform -translate-x-1/2 text-xs text-gray-600 whitespace-nowrap">
            {formatTimeMs(time)}
          </span>
        </div>
      ))}

      {/* Playhead indicator on ruler */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10 pointer-events-none"
        style={{ left: playheadX }}
      >
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-blue-600 rotate-45" />
      </div>
    </div>
  );
}

export default TimelineRuler;
