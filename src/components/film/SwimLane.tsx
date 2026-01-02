'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Edit2, Check, X, Plus } from 'lucide-react';
import { TimelineClipBlock } from './TimelineClipBlock';
import type { CameraLane, TimelineClip } from '@/types/timeline';
import { timeToPixels, SUGGESTED_LANE_LABELS, formatTimeMs } from '@/types/timeline';

// Type for available videos passed from parent
interface AvailableVideo {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  durationMs: number;
  cameraOrder: number;
  cameraLabel: string | null;
}

interface SwimLaneProps {
  lane: CameraLane;
  zoomLevel: number;
  selectedClipId: string | null;
  onClipSelect: (clip: TimelineClip) => void;
  onClipRemove: (clipId: string) => void;
  onLabelChange: (label: string) => void;
  onAddClip: (videoId: string) => void;
  totalDurationMs: number;
  availableVideos?: AvailableVideo[]; // Videos for this camera that can be added
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
  availableVideos = [],
}: SwimLaneProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(lane.label);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const videoPickerRef = useRef<HTMLDivElement>(null);

  // Make the lane a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: lane.lane.toString(),
  });

  // Close video picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (videoPickerRef.current && !videoPickerRef.current.contains(event.target as Node)) {
        setShowVideoPicker(false);
      }
    };

    if (showVideoPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVideoPicker]);

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

  const handleAddVideo = useCallback((videoId: string) => {
    onAddClip(videoId);
    setShowVideoPicker(false);
  }, [onAddClip]);

  // Filter to only videos not already in this lane
  const unplacedVideos = availableVideos.filter(
    v => !lane.clips.some(c => c.videoId === v.id)
  );

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
          <div className="flex items-center gap-1">
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
            {/* Add video button */}
            <div className="relative" ref={videoPickerRef}>
              <button
                onClick={() => setShowVideoPicker(!showVideoPicker)}
                className={`p-1 rounded transition-colors ${
                  showVideoPicker
                    ? 'text-blue-600 bg-blue-100'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                }`}
                title="Add video to this lane"
              >
                <Plus size={12} />
              </button>

              {/* Video picker dropdown */}
              {showVideoPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 w-56">
                  {unplacedVideos.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto">
                      {unplacedVideos.map(video => (
                        <button
                          key={video.id}
                          onClick={() => handleAddVideo(video.id)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                        >
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt=""
                              className="w-10 h-7 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-7 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">
                              No img
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {video.cameraLabel || video.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTimeMs(video.durationMs)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                      {availableVideos.length === 0
                        ? 'No videos for this camera'
                        : 'All videos have been added'}
                    </div>
                  )}
                </div>
              )}
            </div>
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
            <span>
              {unplacedVideos.length > 0
                ? 'Click + to add a video, or drag clips here'
                : 'Upload videos from Camera View first'}
            </span>
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
