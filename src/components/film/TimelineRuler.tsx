'use client';

import { useCallback, useRef } from 'react';
import { formatTimeMs, timeToPixels, TIMELINE_CONSTANTS } from '@/types/timeline';
import type { VideoTimelineMarker } from '@/types/football';
import { MARKER_COLORS, MARKER_LABELS } from '@/types/football';
import { Flag, Clock, Trophy, AlertCircle, Pin, Circle } from 'lucide-react';

interface TimelineRulerProps {
  totalDurationMs: number;
  zoomLevel: number;
  playheadPositionMs: number;
  markers?: VideoTimelineMarker[];
  onSeek: (timeMs: number) => void;
  onMarkerClick?: (marker: VideoTimelineMarker) => void;
}

export function TimelineRuler({
  totalDurationMs,
  zoomLevel,
  playheadPositionMs,
  markers = [],
  onSeek,
  onMarkerClick,
}: TimelineRulerProps) {
  // Get marker icon based on type
  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'quarter_start':
      case 'quarter_end':
      case 'quarter':
        return <Flag size={10} />;
      case 'halftime':
        return <Clock size={10} />;
      case 'overtime':
        return <Circle size={10} />;
      case 'big_play':
        return <Trophy size={10} />;
      case 'turnover':
        return <AlertCircle size={10} />;
      default:
        return <Pin size={10} />;
    }
  };
  const rulerRef = useRef<HTMLDivElement>(null);

  // Calculate tick interval to ensure labels are ~80px apart minimum
  const getTickInterval = () => {
    const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND_BASE * zoomLevel;
    const minPixelsBetweenLabels = 80;
    const minSecondsPerTick = minPixelsBetweenLabels / pixelsPerSecond;

    // Round up to a nice interval (15s, 30s, 1m, 2m, 5m, 10m, etc.)
    const niceIntervals = [15, 30, 60, 120, 300, 600, 900, 1800, 3600]; // in seconds
    for (const interval of niceIntervals) {
      if (interval >= minSecondsPerTick) {
        return interval * 1000; // Convert to ms
      }
    }
    return 3600000; // Default to 1 hour
  };

  const getMinorTickInterval = () => {
    const major = getTickInterval();
    // Fewer minor ticks for cleaner look
    if (major >= 600000) return major / 2; // 2 minor ticks for 10+ min intervals
    return major / 4; // 4 minor ticks otherwise
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
  // Add extra space to match swimlanes (5 minutes or 50% of duration)
  const extraSpaceMs = Math.max(5 * 60 * 1000, totalDurationMs * 0.5);
  const extendedDurationMs = totalDurationMs + extraSpaceMs;
  const width = timeToPixels(extendedDurationMs, zoomLevel);

  const majorTicks: number[] = [];
  const minorTicks: number[] = [];

  for (let time = 0; time <= extendedDurationMs; time += majorInterval) {
    majorTicks.push(time);
  }

  for (let time = 0; time <= extendedDurationMs; time += minorInterval) {
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

      {/* Markers */}
      {markers.map((marker) => {
        const markerX = timeToPixels(marker.virtual_timestamp_start_ms, zoomLevel);
        const color = marker.color || MARKER_COLORS[marker.marker_type];
        const label = marker.label || MARKER_LABELS[marker.marker_type];

        return (
          <button
            key={marker.id}
            className="absolute top-0 bottom-0 group z-20"
            style={{ left: markerX, transform: 'translateX(-50%)' }}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick?.(marker);
            }}
            title={label}
          >
            {/* Marker line */}
            <div
              className="w-0.5 h-full transition-all group-hover:w-1"
              style={{ backgroundColor: color }}
            />
            {/* Marker icon at top */}
            <div
              className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 rounded-full p-0.5"
              style={{ backgroundColor: color, color: 'white' }}
            >
              {getMarkerIcon(marker.marker_type)}
            </div>
            {/* Tooltip on hover */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2
                            opacity-0 group-hover:opacity-100 transition-opacity
                            bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap
                            pointer-events-none z-30 shadow-lg">
              {label}
              {marker.quarter && ` • Q${marker.quarter}`}
            </div>
          </button>
        );
      })}

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
