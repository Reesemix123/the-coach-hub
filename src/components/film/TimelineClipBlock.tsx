'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Film } from 'lucide-react';
import type { TimelineClip } from '@/types/timeline';
import { formatTimeMs, timeToPixels, pixelsToTime, TIMELINE_CONSTANTS } from '@/types/timeline';

interface TimelineClipBlockProps {
  clip: TimelineClip;
  zoomLevel: number;
  isSelected: boolean;
  isDragging?: boolean;
  overlayDelta?: { x: number; y: number } | null;  // For DragOverlay position indicator
  onSelect?: () => void;
  onRemove?: () => void;
}

export function TimelineClipBlock({
  clip,
  zoomLevel,
  isSelected,
  isDragging = false,
  overlayDelta,
  onSelect,
  onRemove,
}: TimelineClipBlockProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: clip.id,
    data: { clip },
  });

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Close context menu
  const closeContextMenu = () => setContextMenu(null);

  // Hide the original clip when being dragged (DragOverlay shows the dragged copy)
  // transform exists for the original clip when dragging, overlayDelta exists for the DragOverlay copy
  const isOriginalBeingDragged = transform && !overlayDelta;

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isOriginalBeingDragged ? 0 : undefined, // Hide original, DragOverlay shows the copy
      }
    : undefined;

  // Calculate width based on duration
  const width = Math.max(
    timeToPixels(clip.durationMs, zoomLevel),
    TIMELINE_CONSTANTS.MIN_CLIP_WIDTH_PX
  );

  // Calculate left position based on lane position
  const left = timeToPixels(clip.lanePositionMs, zoomLevel);

  // Determine if clip is "compact" (too small for full content)
  const isCompact = width < 80;
  const isVeryCompact = width < 50;

  // Calculate dragged position for tooltip (use overlayDelta for DragOverlay, transform for inline)
  const effectiveDeltaX = overlayDelta?.x ?? transform?.x ?? 0;
  const draggedPositionMs = effectiveDeltaX !== 0
    ? clip.lanePositionMs + pixelsToTime(effectiveDeltaX, zoomLevel)
    : clip.lanePositionMs;

  // Tooltip text for hover
  const tooltipText = `${clip.videoName}\nDuration: ${formatTimeMs(clip.durationMs)}\nPosition: ${formatTimeMs(clip.lanePositionMs)}`;

  // For DragOverlay, don't use lane-based positioning - let dnd-kit position it at cursor
  const isOverlay = !!overlayDelta;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={tooltipText}
      style={isOverlay ? {
        // DragOverlay: just width and height, dnd-kit handles position
        width,
        height: '40px',
      } : {
        // In-lane: absolute positioning based on lane position
        ...style,
        width,
        left,
        position: 'absolute',
        top: '8px',
        bottom: '8px',
      }}
      className="cursor-grab active:cursor-grabbing"
      onClick={(e) => {
        e.stopPropagation();
        closeContextMenu();
        onSelect?.();
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Right-click context menu */}
      {contextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          {/* Menu */}
          <div
            className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] py-1 min-w-[120px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeContextMenu();
                  onRemove();
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
          </div>
        </>
      )}
      {/* Drag position indicator (shown while dragging) - positioned outside overflow-hidden container */}
      {isDragging && (overlayDelta || transform) && (
        <div className="absolute -top-7 left-0 bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[100] pointer-events-none shadow-lg">
          Drop at {formatTimeMs(Math.max(0, draggedPositionMs))}
        </div>
      )}

      {/* Clip content container with overflow-hidden */}
      <div
        className={`
          group flex items-center rounded-lg border-2 overflow-hidden h-full
          transition-all duration-150 ease-in-out
          ${isDragging ? 'opacity-90 shadow-lg' : ''}
          ${isSelected
            ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-200'
            : 'border-gray-300 bg-gray-100 hover:border-gray-400 hover:bg-gray-200'
          }
        `}
      >
        {/* Drag handle indicator - only show if not very compact */}
        {!isVeryCompact && (
          <div className="flex-shrink-0 px-0.5 py-2 hover:bg-gray-300/50">
            <GripVertical size={12} className="text-gray-500" />
          </div>
        )}

        {/* Thumbnail / Content */}
        <div className={`flex-1 min-w-0 py-1 flex items-center gap-1 ${isVeryCompact ? 'px-1' : 'px-2'}`}>
          {/* Only show thumbnail if not compact */}
          {!isCompact && (
            clip.thumbnailUrl ? (
              <div
                className="w-6 h-6 flex-shrink-0 rounded bg-cover bg-center"
                style={{ backgroundImage: `url(${clip.thumbnailUrl})` }}
              />
            ) : (
              <div className="w-6 h-6 flex-shrink-0 rounded bg-gray-300 flex items-center justify-center">
                <Film size={12} className="text-gray-500" />
              </div>
            )
          )}

          <div className="min-w-0 flex-1">
            {isVeryCompact ? (
              // Very compact: just show duration
              <p className="text-[10px] text-gray-600 font-medium">
                {formatTimeMs(clip.durationMs)}
              </p>
            ) : isCompact ? (
              // Compact: show truncated name and duration
              <p className="text-[10px] text-gray-700 truncate">
                {formatTimeMs(clip.durationMs)}
              </p>
            ) : (
              // Full: show name and duration
              <>
                <p className="text-xs font-medium text-gray-800 truncate">
                  {clip.videoName}
                </p>
                <p className="text-[10px] text-gray-500">
                  {formatTimeMs(clip.durationMs)}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Remove button (visible on hover, not on compact) */}
        {onRemove && !isCompact && (
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
    </div>
  );
}

export default TimelineClipBlock;
