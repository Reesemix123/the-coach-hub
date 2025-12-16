'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Film } from 'lucide-react';
import type { TimelineClip } from '@/types/timeline';
import { formatTimeMs, timeToPixels, TIMELINE_CONSTANTS } from '@/types/timeline';

interface TimelineClipBlockProps {
  clip: TimelineClip;
  zoomLevel: number;
  isSelected: boolean;
  isDragging?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}

export function TimelineClipBlock({
  clip,
  zoomLevel,
  isSelected,
  isDragging = false,
  onSelect,
  onRemove,
}: TimelineClipBlockProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: clip.id,
    data: { clip },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  // Calculate width based on duration
  const width = Math.max(
    timeToPixels(clip.durationMs, zoomLevel),
    TIMELINE_CONSTANTS.MIN_CLIP_WIDTH_PX
  );

  // Calculate left position based on lane position
  const left = timeToPixels(clip.lanePositionMs, zoomLevel);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        width,
        left,
        position: 'absolute',
        top: '8px',
        bottom: '8px',
      }}
      className={`
        group flex items-center rounded-lg border-2 overflow-hidden cursor-pointer
        transition-all duration-150 ease-in-out
        ${isDragging ? 'opacity-80 shadow-lg z-50' : ''}
        ${isSelected
          ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-200'
          : 'border-gray-300 bg-gray-100 hover:border-gray-400 hover:bg-gray-200'
        }
      `}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 px-1 py-2 cursor-grab active:cursor-grabbing hover:bg-gray-300/50"
      >
        <GripVertical size={14} className="text-gray-500" />
      </div>

      {/* Thumbnail / Content */}
      <div className="flex-1 min-w-0 px-2 py-1 flex items-center gap-2">
        {clip.thumbnailUrl ? (
          <div
            className="w-8 h-8 flex-shrink-0 rounded bg-cover bg-center"
            style={{ backgroundImage: `url(${clip.thumbnailUrl})` }}
          />
        ) : (
          <div className="w-8 h-8 flex-shrink-0 rounded bg-gray-300 flex items-center justify-center">
            <Film size={14} className="text-gray-500" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-800 truncate">
            {clip.videoName}
          </p>
          <p className="text-[10px] text-gray-500">
            {formatTimeMs(clip.durationMs)}
          </p>
        </div>
      </div>

      {/* Remove button (visible on hover) */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 p-1 mr-1 opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-100 rounded transition-opacity"
          title="Remove clip"
        >
          <Trash2 size={12} />
        </button>
      )}

      {/* Trim handles (visible when selected) */}
      {isSelected && !isDragging && (
        <>
          {/* Left trim handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500 cursor-ew-resize opacity-75 hover:opacity-100"
            onMouseDown={(e) => {
              e.stopPropagation();
              // TODO: Implement trim start
              console.log('Start trimming left', clip.id);
            }}
          />
          {/* Right trim handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 bg-blue-500 cursor-ew-resize opacity-75 hover:opacity-100"
            onMouseDown={(e) => {
              e.stopPropagation();
              // TODO: Implement trim end
              console.log('Start trimming right', clip.id);
            }}
          />
        </>
      )}
    </div>
  );
}

export default TimelineClipBlock;
