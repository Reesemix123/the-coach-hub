'use client';

import { useCallback, useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  Modifier,
} from '@dnd-kit/core';
// PhaseMarkerStrip moved to above video player - markers consolidated there
import { SwimLaneWithUpload } from './SwimLaneWithUpload';
import { TimelineRuler } from '@/components/film/TimelineRuler';
import { TimelineClipBlock } from '@/components/film/TimelineClipBlock';
import { ClipSyncModal } from '../layout/ClipSyncModal';
import { useFilmStudio } from '../context/FilmStudioContext';
import { useClipPositioning } from '../hooks/useClipPositioning';
import {
  timeToPixels,
  pixelsToTime,
  snapToGrid,
  TIMELINE_CONSTANTS,
} from '@/types/timeline';
import type { TimelineClip } from '@/types/timeline';
import type { VideoTimelineMarker } from '@/types/football';
import { ZoomIn, ZoomOut, Plus, ChevronDown, ChevronUp } from 'lucide-react';

interface AvailableVideo {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  durationMs: number;
  cameraOrder: number;
  cameraLabel: string | null;
}

interface UnifiedTimelineProps {
  availableVideos: AvailableVideo[];
  markers?: VideoTimelineMarker[];
  onUploadStart: (file: File, lane: number) => void;
  onMarkerClick?: (marker: VideoTimelineMarker) => void;
}

export function UnifiedTimeline({
  availableVideos,
  markers = [],
  onUploadStart,
  onMarkerClick,
}: UnifiedTimelineProps) {
  const {
    state,
    dispatch,
    moveClip,
    removeClip,
    addClip,
    updateLaneLabel,
    seekTo,
  } = useFilmStudio();

  const { timeline, zoomLevel, selectedClipId, uploadingToLane, uploadProgress, maxCamerasAllowed } = state;

  const { calculateShiftPlan, getNextAvailablePosition } = useClipPositioning(timeline);

  // Drag state
  const [draggedClip, setDraggedClip] = useState<TimelineClip | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null);
  // Phase markers moved to above video player

  // Collapsed state for timeline
  const [isCollapsed, setIsCollapsed] = useState(false);

  // State for adding a new camera lane
  const [isAddingCamera, setIsAddingCamera] = useState(false);

  // Sync modal state
  const [syncingLane, setSyncingLane] = useState<number | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Modifier to restrict clip dragging to horizontal axis only
  const restrictToHorizontalAxis: Modifier = ({ transform }) => {
    return {
      ...transform,
      y: 0, // Lock Y axis - clips can't change lanes
    };
  };

  // Calculate total duration (from timeline or default)
  const totalDurationMs = useMemo(() => {
    if (timeline && timeline.totalDurationMs > 0) {
      return timeline.totalDurationMs;
    }
    // Default to 5 minutes if empty
    return 5 * 60 * 1000;
  }, [timeline]);

  // Group available videos by camera order
  const videosByCamera = useMemo(() => {
    const grouped = new Map<number, AvailableVideo[]>();
    for (const video of availableVideos) {
      const cameraLane = video.cameraOrder || 1;
      if (!grouped.has(cameraLane)) {
        grouped.set(cameraLane, []);
      }
      grouped.get(cameraLane)!.push(video);
    }
    return grouped;
  }, [availableVideos]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    // Check if it's a clip drag
    if (!activeId.startsWith('phase-')) {
      const clip = active.data.current?.clip as TimelineClip | undefined;
      if (clip) {
        setDraggedClip(clip);
        setDragDelta({ x: 0, y: 0 });
        dispatch({ type: 'SELECT_CLIP', clipId: clip.id });
      }
    }
  }, [dispatch]);

  // Handle drag move (track delta for position indicator)
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { delta } = event;
    setDragDelta({ x: delta.x, y: delta.y });
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over, delta } = event;
      const activeId = active.id as string;

      setDraggedClip(null);
      setDragDelta(null);

      // Handle clip drag
      if (!timeline) {
        console.log('[Timeline] No timeline, skipping drop');
        return;
      }

      const clipId = activeId;
      const clip = active.data.current?.clip as TimelineClip | undefined;
      if (!clip) {
        console.log('[Timeline] No clip data, skipping drop');
        return;
      }

      console.log('[Timeline] Drag end:', {
        clipId,
        clipName: clip.videoName,
        originalPosition: clip.lanePositionMs,
        originalLane: clip.cameraLane,
        deltaX: delta.x,
      });

      // IMPORTANT: Clips cannot change lanes - they stay in their original lane
      // Only horizontal (time) movement is allowed
      const targetLane = clip.cameraLane;

      // Calculate new position from drag delta (horizontal only)
      const deltaPx = delta.x;
      const deltaMs = pixelsToTime(deltaPx, zoomLevel);
      let newPositionMs = snapToGrid(Math.max(0, clip.lanePositionMs + deltaMs));

      console.log('[Timeline] Calculated new position:', {
        deltaPx,
        deltaMs,
        newPositionMs,
        targetLane,
      });

      // Skip if position hasn't changed significantly (avoid unnecessary updates)
      if (targetLane === clip.cameraLane && Math.abs(newPositionMs - clip.lanePositionMs) < 500) {
        console.log('[Timeline] Position change too small, skipping');
        return;
      }

      // Calculate shift plan if there's overlap
      const shiftPlan = calculateShiftPlan(
        targetLane,
        newPositionMs,
        clip.durationMs,
        clipId
      );

      console.log('[Timeline] Shift plan:', shiftPlan);

      if (!shiftPlan.valid) {
        // Fall back to end of lane
        newPositionMs = getNextAvailablePosition(targetLane);
        console.log('[Timeline] Shift invalid, using end of lane:', newPositionMs);
      } else if (shiftPlan.affectedClips.length > 0) {
        // Execute shifts first
        console.log('[Timeline] Shifting affected clips:', shiftPlan.affectedClips);
        for (const shiftedClip of shiftPlan.affectedClips) {
          await moveClip(shiftedClip.clipId, targetLane, shiftedClip.newPositionMs);
        }
      }

      // Move the dragged clip
      console.log('[Timeline] Moving clip to:', { clipId, targetLane, newPositionMs });
      try {
        await moveClip(clipId, targetLane, newPositionMs);
        console.log('[Timeline] Move completed successfully');
      } catch (err) {
        console.error('[Timeline] Move failed:', err);
      }
    },
    [
      timeline,
      zoomLevel,
      calculateShiftPlan,
      getNextAvailablePosition,
      moveClip,
    ]
  );

  // Handle clip selection
  const handleClipSelect = useCallback(
    (clip: TimelineClip) => {
      dispatch({ type: 'SELECT_CLIP', clipId: clip.id });
      // Seek to clip start
      seekTo(clip.lanePositionMs);
    },
    [dispatch, seekTo]
  );

  // Handle adding a clip from video picker
  const handleAddClip = useCallback(
    (videoId: string, lane: number) => {
      addClip(videoId, lane);
    },
    [addClip]
  );

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    const currentIndex = TIMELINE_CONSTANTS.ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < TIMELINE_CONSTANTS.ZOOM_LEVELS.length - 1) {
      dispatch({
        type: 'UPDATE_ZOOM',
        level: TIMELINE_CONSTANTS.ZOOM_LEVELS[currentIndex + 1],
      });
    }
  }, [zoomLevel, dispatch]);

  const handleZoomOut = useCallback(() => {
    const currentIndex = TIMELINE_CONSTANTS.ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      dispatch({
        type: 'UPDATE_ZOOM',
        level: TIMELINE_CONSTANTS.ZOOM_LEVELS[currentIndex - 1],
      });
    }
  }, [zoomLevel, dispatch]);

  // Handle ruler click
  const handleRulerClick = useCallback(
    (timeMs: number) => {
      seekTo(timeMs);
    },
    [seekTo]
  );

  // Handle upload for a specific lane
  const handleLaneUpload = useCallback(
    (file: File, lane: number) => {
      onUploadStart(file, lane);
    },
    [onUploadStart]
  );

  // Ensure we have lanes to display
  const lanes = timeline?.lanes || [];

  // Handle syncing multiple clips to new positions
  const handleSyncClips = useCallback(
    async (updates: Array<{ clipId: string; newPositionMs: number }>) => {
      // Update each clip's position
      for (const update of updates) {
        const clip = lanes.flatMap(l => l.clips).find(c => c.id === update.clipId);
        if (clip) {
          await moveClip(update.clipId, clip.cameraLane, update.newPositionMs);
        }
      }
      setSyncingLane(null);
    },
    [lanes, moveClip]
  );

  // Get the lane being synced
  const syncingLaneData = syncingLane !== null
    ? lanes.find(l => l.lane === syncingLane)
    : null;

  // Count lanes with actual clips (active cameras)
  const activeCameraCount = lanes.filter(l => l.clips.length > 0).length;
  const canAddMoreCameras = activeCameraCount < maxCamerasAllowed;

  // Calculate if syncing is possible (need at least 2 lanes with clips)
  const lanesWithClips = lanes.filter(l => l.clips.length > 0);
  const canSyncAnyLane = lanesWithClips.length >= 2;

  // Calculate next lane number
  const maxLaneNumber = Math.max(0, ...lanes.map(l => l.lane));
  const nextLaneNumber = maxLaneNumber + 1;

  // Show all existing lanes, plus:
  // - Always show at least one lane (Camera 1) if no lanes exist
  // - Show an additional empty lane if user clicked "Add Camera"
  const displayLanes = lanes.length > 0
    ? [
        ...lanes,
        // Only show empty "new" lane if user clicked Add Camera
        ...(isAddingCamera && canAddMoreCameras
          ? [{
              lane: nextLaneNumber,
              label: `Camera ${nextLaneNumber}`,
              clips: [],
              syncOffsetMs: 0,
            }]
          : []),
      ]
    : // If no lanes at all, always show Camera 1 so users can drag & drop
      [{
        lane: 1,
        label: 'Camera 1',
        clips: [],
        syncOffsetMs: 0,
      }];

  // Reset isAddingCamera when a clip is added to the new lane
  useEffect(() => {
    if (isAddingCamera && lanes.some(l => l.lane === nextLaneNumber && l.clips.length > 0)) {
      setIsAddingCamera(false);
    }
  }, [lanes, nextLaneNumber, isAddingCamera]);

  // Handle adding camera click
  const handleAddCameraClick = useCallback(() => {
    setIsAddingCamera(true);
  }, []);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          title={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
        >
          {isCollapsed ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
          Timeline
          {isCollapsed && (
            <span className="text-xs text-gray-400 font-normal ml-1">
              (click to expand)
            </span>
          )}
        </button>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= TIMELINE_CONSTANTS.ZOOM_LEVELS[0]}
              className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-gray-500 w-12 text-center">
              {zoomLevel}x
            </span>
            <button
              onClick={handleZoomIn}
              disabled={
                zoomLevel >=
                TIMELINE_CONSTANTS.ZOOM_LEVELS[
                  TIMELINE_CONSTANTS.ZOOM_LEVELS.length - 1
                ]
              }
              className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Timeline content - collapsible */}
      {!isCollapsed && (
        <div className="overflow-x-auto overflow-y-visible">
          <DndContext
            sensors={sensors}
            modifiers={[restrictToHorizontalAxis]}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
          {/* Timeline ruler - with left spacer for lane labels */}
          <div className="flex">
            <div className="w-40 flex-shrink-0 bg-gray-100 border-b border-gray-300" /> {/* Spacer */}
            <TimelineRuler
              totalDurationMs={totalDurationMs}
              zoomLevel={zoomLevel}
              playheadPositionMs={state.playheadPositionMs}
              markers={markers}
              onSeek={handleRulerClick}
              onMarkerClick={onMarkerClick}
            />
          </div>

          {/* Swimlanes */}
          {displayLanes.map((lane) => (
            <SwimLaneWithUpload
              key={lane.lane}
              lane={lane}
              zoomLevel={zoomLevel}
              totalDurationMs={totalDurationMs}
              selectedClipId={selectedClipId}
              availableVideos={videosByCamera.get(lane.lane) || []}
              isUploading={uploadingToLane === lane.lane}
              uploadProgress={uploadProgress}
              canSync={canSyncAnyLane && lane.clips.length > 0}
              onClipSelect={handleClipSelect}
              onClipRemove={removeClip}
              onLabelChange={(label) => updateLaneLabel(lane.lane, label)}
              onAddClip={(videoId) => handleAddClip(videoId, lane.lane)}
              onUploadStart={(file) => handleLaneUpload(file, lane.lane)}
              onSyncClick={() => setSyncingLane(lane.lane)}
            />
          ))}

          {/* Drag overlay */}
          <DragOverlay>
            {draggedClip && (
              <TimelineClipBlock
                clip={draggedClip}
                zoomLevel={zoomLevel}
                isSelected={true}
                isDragging={true}
                overlayDelta={dragDelta}
              />
            )}
          </DragOverlay>
        </DndContext>

        {/* Add Camera button - compact row (only show when at least 1 camera has content) */}
        {canAddMoreCameras && !isAddingCamera && activeCameraCount > 0 && (
          <button
            onClick={handleAddCameraClick}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-200 transition-colors"
          >
            <Plus size={14} />
            <span>Add Camera</span>
            <span className="text-xs text-gray-400">
              ({activeCameraCount}/{maxCamerasAllowed} used)
            </span>
          </button>
        )}

        {/* Camera limit reached message */}
        {!canAddMoreCameras && activeCameraCount > 0 && (
          <div className="px-4 py-2 text-center border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Camera limit reached ({activeCameraCount}/{maxCamerasAllowed}).{' '}
              <a href="/pricing" className="text-blue-600 hover:underline">
                Upgrade your plan
              </a>{' '}
              for more camera angles.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Clip Sync Modal */}
      {syncingLaneData && (
        <ClipSyncModal
          currentLane={syncingLaneData}
          allLanes={lanes}
          currentTimeMs={state.currentTimeMs}
          onClose={() => setSyncingLane(null)}
          onSyncClips={handleSyncClips}
        />
      )}
    </div>
  );
}

export default UnifiedTimeline;
