'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  PlayCircle,
  Flag,
  Clock,
  StopCircle,
  Timer,
  X,
} from 'lucide-react';
import type { VideoTimelineMarker, MarkerType } from '@/types/football';
import { timeToPixels, formatTimeMs } from '@/types/timeline';

// Marker colors matching the existing MARKER_COLORS from football.ts
const MARKER_COLORS: Record<string, string> = {
  game_start: '#059669',    // emerald-600
  quarter_start: '#10B981', // green-500
  quarter_end: '#EF4444',   // red-500
  halftime: '#F59E0B',      // amber-500
  overtime: '#8B5CF6',      // purple-500
  game_end: '#64748B',      // slate-500
};

// Default labels for marker types
const MARKER_LABELS: Record<string, string> = {
  game_start: 'Game Start',
  quarter_start: 'Quarter Start',
  quarter_end: 'Quarter End',
  halftime: 'Halftime',
  overtime: 'Overtime',
  game_end: 'Game End',
};

// Icons for marker types
function MarkerIcon({ type, className = '' }: { type: MarkerType; className?: string }) {
  const iconProps = { size: 14, className };

  switch (type) {
    case 'game_start':
      return <PlayCircle {...iconProps} />;
    case 'quarter_start':
      return <Flag {...iconProps} />;
    case 'quarter_end':
      return <Flag {...iconProps} style={{ transform: 'scaleX(-1)' }} />;
    case 'halftime':
      return <Clock {...iconProps} />;
    case 'overtime':
      return <Timer {...iconProps} />;
    case 'game_end':
      return <StopCircle {...iconProps} />;
    default:
      return <Flag {...iconProps} />;
  }
}

interface DraggablePhaseMarkerProps {
  marker: VideoTimelineMarker;
  zoomLevel: number;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

export function DraggablePhaseMarker({
  marker,
  zoomLevel,
  isSelected = false,
  onSelect,
  onDelete,
}: DraggablePhaseMarkerProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `phase-${marker.id}`,
    data: { type: 'phase-marker', marker },
  });

  // Calculate position from timestamp
  const baseLeft = timeToPixels(marker.virtual_timestamp_start_ms, zoomLevel);

  // Lock Y axis during drag (horizontal only)
  const style = transform
    ? {
        transform: CSS.Translate.toString({ ...transform, y: 0 }),
        left: baseLeft,
      }
    : { left: baseLeft };

  const color = marker.color || MARKER_COLORS[marker.marker_type] || '#6B7280';
  const label = marker.label || MARKER_LABELS[marker.marker_type] || marker.marker_type;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'absolute',
        top: 0,
        bottom: 0,
        zIndex: isDragging ? 50 : isSelected ? 40 : 10,
      }}
      className="group"
    >
      {/* Vertical line extending down to timeline */}
      <div
        className="absolute top-full left-1/2 w-0.5 pointer-events-none"
        style={{
          backgroundColor: color,
          opacity: 0.3,
          transform: 'translateX(-50%)',
          height: '500px', // Extend down through all lanes
        }}
      />

      {/* Marker handle */}
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        className={`
          flex flex-col items-center cursor-grab active:cursor-grabbing
          transition-transform duration-150
          ${isDragging ? 'scale-110' : 'hover:scale-105'}
        `}
        style={{ transform: 'translateX(-50%)' }}
      >
        {/* Marker flag/pin */}
        <div
          className={`
            flex items-center justify-center w-6 h-6 rounded-full
            shadow-md border-2 border-white
            ${isDragging ? 'shadow-lg' : ''}
          `}
          style={{ backgroundColor: color }}
        >
          <MarkerIcon type={marker.marker_type} className="text-white" />
        </div>

        {/* Stem */}
        <div
          className="w-0.5 h-2"
          style={{ backgroundColor: color }}
        />
      </div>

      {/* Label tooltip - always visible when dragging, hover otherwise */}
      <div
        className={`
          absolute top-full left-1/2 mt-1
          bg-gray-900 text-white text-xs px-2 py-1 rounded
          whitespace-nowrap pointer-events-none z-50
          ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          transition-opacity
        `}
        style={{ transform: 'translateX(-50%)' }}
      >
        <div className="font-medium">{label}</div>
        <div className="text-gray-400 text-[10px]">
          {formatTimeMs(marker.virtual_timestamp_start_ms)}
        </div>
      </div>

      {/* Delete button - visible on hover when selected */}
      {isSelected && onDelete && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="
            absolute -top-1 -right-1
            w-4 h-4 rounded-full
            bg-red-500 text-white
            flex items-center justify-center
            opacity-0 group-hover:opacity-100
            transition-opacity hover:bg-red-600
          "
          style={{ transform: 'translateX(50%)' }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export default DraggablePhaseMarker;
