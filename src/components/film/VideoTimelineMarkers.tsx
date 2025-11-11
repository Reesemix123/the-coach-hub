'use client';

import { Flag, Clock, Trophy, AlertCircle, Pin, Circle } from 'lucide-react';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';
import { MARKER_COLORS, MARKER_LABELS } from '@/types/football';

interface VideoTimelineMarkersProps {
  markers: VideoTimelineMarker[];
  currentTimeMs: number;
  durationMs: number;
  onMarkerClick: (marker: VideoTimelineMarker) => void;
}

export default function VideoTimelineMarkers({
  markers,
  currentTimeMs,
  durationMs,
  onMarkerClick
}: VideoTimelineMarkersProps) {

  const getMarkerIcon = (type: MarkerType) => {
    switch (type) {
      case 'quarter_start':
      case 'quarter_end':
      case 'quarter':
        return <Flag size={12} />;
      case 'halftime':
        return <Clock size={12} />;
      case 'overtime':
        return <Circle size={12} />;
      case 'big_play':
        return <Trophy size={12} />;
      case 'turnover':
        return <AlertCircle size={12} />;
      default:
        return <Pin size={12} />;
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (markers.length === 0 || durationMs === 0) {
    return null;
  }

  return (
    <div className="relative w-full h-10">
      {/* Timeline markers */}
      {markers.map(marker => {
        const position = (marker.virtual_timestamp_start_ms / durationMs) * 100;
        const color = marker.color || MARKER_COLORS[marker.marker_type];

        return (
          <button
            key={marker.id}
            onClick={() => onMarkerClick(marker)}
            className="absolute top-0 bottom-0 group z-10"
            style={{
              left: `${position}%`,
              transform: 'translateX(-50%)'
            }}
            title={marker.label || MARKER_LABELS[marker.marker_type]}
          >
            {/* Marker pin/line */}
            <div
              className="w-0.5 h-full transition-all group-hover:w-1 group-hover:shadow-lg"
              style={{ backgroundColor: color }}
            />

            {/* Marker label tooltip (on hover) */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                            opacity-0 group-hover:opacity-100 transition-opacity
                            bg-gray-900 text-white text-xs px-2 py-1.5 rounded-lg whitespace-nowrap
                            pointer-events-none z-20 shadow-lg">
              <div className="flex items-center gap-1.5">
                <div style={{ color }}>
                  {getMarkerIcon(marker.marker_type)}
                </div>
                <span className="font-medium">
                  {marker.label || MARKER_LABELS[marker.marker_type]}
                </span>
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                {formatTime(marker.virtual_timestamp_start_ms)}
                {marker.quarter && ` • Q${marker.quarter}`}
              </div>

              {/* Arrow pointing down */}
              <div
                className="absolute top-full left-1/2 -translate-x-1/2
                            border-4 border-transparent border-t-gray-900"
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
