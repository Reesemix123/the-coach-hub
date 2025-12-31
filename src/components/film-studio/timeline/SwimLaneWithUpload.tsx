'use client';

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { LaneDropZone } from './LaneDropZone';
import { TimelineClipBlock } from '@/components/film/TimelineClipBlock';
import type { CameraLane, TimelineClip } from '@/types/timeline';
import { timeToPixels, formatTimeMs } from '@/types/timeline';

// Type for available videos that can be added
interface AvailableVideo {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  durationMs: number;
  cameraOrder: number;
  cameraLabel: string | null;
}

interface SwimLaneWithUploadProps {
  lane: CameraLane;
  zoomLevel: number;
  totalDurationMs: number;
  selectedClipId: string | null;
  availableVideos?: AvailableVideo[];
  isUploading: boolean;
  uploadProgress: number;
  canSync: boolean;  // True if there are other lanes with clips
  onClipSelect: (clip: TimelineClip) => void;
  onClipRemove: (clipId: string) => void;
  onLabelChange: (label: string) => void;
  onAddClip: (videoId: string) => void;
  onUploadStart: (file: File) => void;
  onSyncClick?: () => void;  // Open sync modal for this lane
}

export function SwimLaneWithUpload({
  lane,
  zoomLevel,
  totalDurationMs,
  selectedClipId,
  availableVideos = [],
  isUploading,
  uploadProgress,
  canSync,
  onClipSelect,
  onClipRemove,
  onLabelChange,
  onAddClip,
  onUploadStart,
  onSyncClick,
}: SwimLaneWithUploadProps) {
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const videoPickerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Make the lane a drop target for clip dragging
  const { setNodeRef, isOver } = useDroppable({
    id: lane.lane.toString(),
    data: { type: 'lane', lane: lane.lane },
  });

  // Update dropdown position when it opens
  useLayoutEffect(() => {
    if (showVideoPicker && addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [showVideoPicker]);

  // Close video picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check both the lane label area and the dropdown portal
      const dropdownEl = document.getElementById(`video-picker-${lane.lane}`);
      if (
        videoPickerRef.current &&
        !videoPickerRef.current.contains(target) &&
        (!dropdownEl || !dropdownEl.contains(target))
      ) {
        setShowVideoPicker(false);
      }
    };

    if (showVideoPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVideoPicker, lane.lane]);

  const handleAddVideo = useCallback(
    (videoId: string) => {
      onAddClip(videoId);
      setShowVideoPicker(false);
    },
    [onAddClip]
  );

  // Filter to only videos not already in this lane
  const unplacedVideos = availableVideos.filter(
    (v) => !lane.clips.some((c) => c.videoId === v.id)
  );

  // Add extra space (5 minutes or 50% of duration, whichever is larger) for dragging clips
  const extraSpaceMs = Math.max(5 * 60 * 1000, totalDurationMs * 0.5);
  const laneWidth = timeToPixels(totalDurationMs + extraSpaceMs, zoomLevel);

  return (
    <div className="flex border-b border-gray-200 min-h-[80px]">
      {/* Lane Label with Drop Zone */}
      <div className="relative" ref={videoPickerRef}>
        <LaneDropZone
          laneNumber={lane.lane}
          laneLabel={lane.label}
          clipCount={lane.clips.length}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          canSync={canSync}
          onUploadStart={onUploadStart}
          onLabelChange={onLabelChange}
          onAddVideoClick={() => setShowVideoPicker(!showVideoPicker)}
          onSyncClick={onSyncClick}
          addButtonRef={addButtonRef}
        />

      </div>

      {/* Video picker dropdown - rendered via portal with fixed positioning */}
      {showVideoPicker && typeof document !== 'undefined' &&
        createPortal(
          <div
            id={`video-picker-${lane.lane}`}
            className="fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999] w-72"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            {unplacedVideos.length > 0 ? (
              <div className="max-h-48 overflow-y-auto">
                {unplacedVideos.map((video) => (
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
              <div className="px-4 py-4 text-sm text-center">
                <p className="text-gray-500 mb-2">
                  {availableVideos.length === 0
                    ? 'No videos uploaded for this game yet'
                    : 'All videos are already on the timeline'}
                </p>
                <p className="text-xs text-gray-400">
                  Drag & drop a video file onto the lane to upload
                </p>
              </div>
            )}
          </div>,
          document.body
        )
      }

      {/* Lane Content (Drop Zone) */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 relative min-h-[60px]
          transition-colors
          ${isOver ? 'bg-blue-50' : 'bg-white'}
        `}
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
                ? 'Click + to add a video, or drag video file here'
                : 'Drag & drop a video file to upload'}
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

export default SwimLaneWithUpload;
