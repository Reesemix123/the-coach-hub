'use client';

import { useState, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Edit2, Plus, Check, X } from 'lucide-react';
import { TimelineClipBlock } from './TimelineClipBlock';
import type { CameraLane, TimelineClip } from '@/types/timeline';
import { timeToPixels, SUGGESTED_LANE_LABELS } from '@/types/timeline';

interface SwimLaneProps {
  lane: CameraLane;
  zoomLevel: number;
  selectedClipId: string | null;
  onClipSelect: (clip: TimelineClip) => void;
  onClipRemove: (clipId: string) => void;
  onLabelChange: (label: string) => void;
  onAddClip: (videoId: string) => void;
  totalDurationMs: number;
}

export function SwimLane({
  lane,
  zoomLevel,
  selectedClipId,
  onClipSelect,
  onClipRemove,
  onLabelChange,
  onAddClip,
  totalDurationMs,
}: SwimLaneProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(lane.label);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  // Make the lane a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: lane.lane.toString(),
  });

  const handleLabelSubmit = useCallback(() => {
    if (labelValue.trim()) {
      onLabelChange(labelValue.trim());
    }
    setIsEditingLabel(false);
    setShowLabelDropdown(false);
  }, [labelValue, onLabelChange]);

  const handleLabelCancel = useCallback(() => {
    setLabelValue(lane.label);
    setIsEditingLabel(false);
    setShowLabelDropdown(false);
  }, [lane.label]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setLabelValue(suggestion);
    onLabelChange(suggestion);
    setIsEditingLabel(false);
    setShowLabelDropdown(false);
  }, [onLabelChange]);

  const laneWidth = timeToPixels(totalDurationMs, zoomLevel);

  return (
    <div className="flex border-b border-gray-200 min-h-[80px]">
      {/* Lane Label */}
      <div className="w-32 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-2 flex flex-col justify-center relative">
        {isEditingLabel ? (
          <div className="relative">
            <input
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onFocus={() => setShowLabelDropdown(true)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelSubmit();
                if (e.key === 'Escape') handleLabelCancel();
              }}
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleLabelSubmit}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check size={14} />
              </button>
              <button
                onClick={handleLabelCancel}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
              >
                <X size={14} />
              </button>
            </div>

            {/* Suggestions dropdown */}
            {showLabelDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                {SUGGESTED_LANE_LABELS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 truncate flex-1">
              {lane.label}
            </span>
            <button
              onClick={() => setIsEditingLabel(true)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
              title="Edit label"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}
        <span className="text-xs text-gray-500 mt-1">
          {lane.clips.length} clip{lane.clips.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lane Content (Drop Zone) */}
      <div
        ref={setNodeRef}
        className={`flex-1 relative min-h-[60px] ${
          isOver ? 'bg-blue-50' : 'bg-white'
        } transition-colors`}
        style={{ width: Math.max(laneWidth, 600) }}
      >
        {/* Clips */}
        {lane.clips.map((clip) => (
          <TimelineClipBlock
            key={clip.id}
            clip={clip}
            zoomLevel={zoomLevel}
            isSelected={selectedClipId === clip.id}
            onSelect={() => onClipSelect(clip)}
            onRemove={() => onClipRemove(clip.id)}
          />
        ))}

        {/* Empty state */}
        {lane.clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            <span>Drop video here or click</span>
            <button
              onClick={() => {
                // This would typically open a video picker modal
                // For now, we'll just show a placeholder
                console.log('Add clip to lane', lane.lane);
              }}
              className="ml-2 p-1 hover:bg-gray-100 rounded"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        {/* Drop indicator */}
        {isOver && (
          <div className="absolute inset-0 border-2 border-blue-500 border-dashed rounded pointer-events-none" />
        )}
      </div>
    </div>
  );
}

export default SwimLane;
