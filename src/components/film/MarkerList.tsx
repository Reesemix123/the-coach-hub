'use client';

import { Trash2, Play } from 'lucide-react';
import type { VideoTimelineMarker } from '@/types/football';
import { MARKER_COLORS, MARKER_LABELS } from '@/types/football';

interface MarkerListProps {
  markers: VideoTimelineMarker[];
  onJumpToMarker: (timestampMs: number) => void;
  onDeleteMarker: (markerId: string) => void;
}

export default function MarkerList({
  markers,
  onJumpToMarker,
  onDeleteMarker
}: MarkerListProps) {

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (markers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No markers yet.</p>
        <p className="text-sm mt-1">Add markers to navigate through your video.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {markers.map(marker => {
        const color = marker.color || MARKER_COLORS[marker.marker_type];
        const label = marker.label || MARKER_LABELS[marker.marker_type];

        return (
          <div
            key={marker.id}
            className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg
                       hover:border-gray-300 transition-colors group"
          >
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />

            {/* Marker info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {label}
              </div>
              <div className="text-sm text-gray-600">
                {formatTime(marker.virtual_timestamp_start_ms)}
                {marker.quarter && ` • Q${marker.quarter}`}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onJumpToMarker(marker.virtual_timestamp_start_ms)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100
                           rounded-lg transition-colors"
                title="Jump to marker"
              >
                <Play size={16} />
              </button>
              <button
                onClick={() => onDeleteMarker(marker.id)}
                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50
                           rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Delete marker"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
