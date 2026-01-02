'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Play, Pause, Plus, ZoomIn, ZoomOut, SkipBack, SkipForward } from 'lucide-react';
import { TimelineRuler } from './TimelineRuler';
import { SwimLane } from './SwimLane';
import { TimelineClipBlock } from './TimelineClipBlock';
import { TimelinePlayhead } from './TimelinePlayhead';
import { GapIndicator } from './GapIndicator';
import { timelineService } from '@/lib/services/timeline.service';
import { timelinePlayback } from '@/lib/services/timeline-playback.service';
import type {
  GameTimeline,
  CameraLane,
  TimelineClip,
  TimelinePlaybackState,
} from '@/types/timeline';
import {
  TIMELINE_CONSTANTS,
  formatTimeMs,
  snapToGrid,
  timeToPixels,
  pixelsToTime,
} from '@/types/timeline';

// Type for available videos from the service
interface AvailableVideo {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  durationMs: number;
  cameraOrder: number;
  cameraLabel: string | null;
}

interface TimelineEditorProps {
  gameId: string;
  teamId: string;
  onClipSelect?: (clip: TimelineClip) => void;
  onTimeChange?: (timeMs: number) => void;
  initialTimeMs?: number;
}

export function TimelineEditor({
  gameId,
  teamId,
  onClipSelect,
  onTimeChange,
  initialTimeMs = 0,
}: TimelineEditorProps) {
  // Timeline data state
  const [timeline, setTimeline] = useState<GameTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [playbackState, setPlaybackState] = useState<TimelinePlaybackState>({
    playheadPositionMs: initialTimeMs,
    isPlaying: false,
    playbackRate: 1,
    zoomLevel: TIMELINE_CONSTANTS.DEFAULT_ZOOM,
    scrollPositionMs: 0,
    selectedClipId: null,
    activeLane: 1,
  });

  // Drag state
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [draggedClip, setDraggedClip] = useState<TimelineClip | null>(null);

  // Available videos grouped by camera lane
  const [videosByCamera, setVideosByCamera] = useState<Map<number, AvailableVideo[]>>(new Map());

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sensors for drag-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load timeline data
  useEffect(() => {
    loadTimeline();
  }, [gameId, teamId]);

  // Load available videos grouped by camera
  useEffect(() => {
    const loadAvailableVideos = async () => {
      try {
        const videos = await timelineService.getAvailableVideos(gameId);
        // Group by camera_order (which maps to lane number)
        const grouped = new Map<number, AvailableVideo[]>();
        for (const video of videos) {
          const cameraLane = video.cameraOrder || 1;
          if (!grouped.has(cameraLane)) {
            grouped.set(cameraLane, []);
          }
          grouped.get(cameraLane)!.push(video);
        }
        setVideosByCamera(grouped);
      } catch (err) {
        console.error('Failed to load available videos:', err);
      }
    };
    loadAvailableVideos();
  }, [gameId, timeline]); // Reload when timeline changes (after adding/removing clips)

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const data = await timelineService.getOrCreateTimeline(gameId, teamId);
      setTimeline(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  // Playback controls
  const togglePlayback = useCallback(() => {
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  }, []);

  useEffect(() => {
    if (playbackState.isPlaying && timeline) {
      playbackIntervalRef.current = setInterval(() => {
        setPlaybackState(prev => {
          const newPosition = prev.playheadPositionMs + (100 * prev.playbackRate);
          if (newPosition >= timeline.totalDurationMs) {
            return { ...prev, isPlaying: false, playheadPositionMs: timeline.totalDurationMs };
          }
          return { ...prev, playheadPositionMs: newPosition };
        });
      }, 100);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [playbackState.isPlaying, playbackState.playbackRate, timeline?.totalDurationMs]);

  // Notify parent of time changes
  useEffect(() => {
    onTimeChange?.(playbackState.playheadPositionMs);
  }, [playbackState.playheadPositionMs, onTimeChange]);

  const seekTo = useCallback((timeMs: number) => {
    setPlaybackState(prev => ({
      ...prev,
      playheadPositionMs: Math.max(0, Math.min(timeMs, timeline?.totalDurationMs || 0)),
    }));
  }, [timeline?.totalDurationMs]);

  const skipForward = useCallback(() => {
    seekTo(playbackState.playheadPositionMs + 10000);
  }, [playbackState.playheadPositionMs, seekTo]);

  const skipBackward = useCallback(() => {
    seekTo(playbackState.playheadPositionMs - 10000);
  }, [playbackState.playheadPositionMs, seekTo]);

  const zoomIn = useCallback(() => {
    const currentIndex = TIMELINE_CONSTANTS.ZOOM_LEVELS.indexOf(playbackState.zoomLevel);
    if (currentIndex < TIMELINE_CONSTANTS.ZOOM_LEVELS.length - 1) {
      setPlaybackState(prev => ({
        ...prev,
        zoomLevel: TIMELINE_CONSTANTS.ZOOM_LEVELS[currentIndex + 1],
      }));
    }
  }, [playbackState.zoomLevel]);

  const zoomOut = useCallback(() => {
    const currentIndex = TIMELINE_CONSTANTS.ZOOM_LEVELS.indexOf(playbackState.zoomLevel);
    if (currentIndex > 0) {
      setPlaybackState(prev => ({
        ...prev,
        zoomLevel: TIMELINE_CONSTANTS.ZOOM_LEVELS[currentIndex - 1],
      }));
    }
  }, [playbackState.zoomLevel]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const clipId = event.active.id as string;
    setActiveClipId(clipId);

    // Find the clip
    if (timeline) {
      for (const lane of timeline.lanes) {
        const clip = lane.clips.find(c => c.id === clipId);
        if (clip) {
          setDraggedClip(clip);
          break;
        }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setActiveClipId(null);
    setDraggedClip(null);

    if (!over || !timeline || !draggedClip) return;

    const clipId = active.id as string;
    const targetLane = parseInt(over.id as string);

    if (isNaN(targetLane)) return;

    // Calculate new position from drag delta (horizontal movement)
    const deltaPx = delta.x;
    const deltaMs = pixelsToTime(deltaPx, playbackState.zoomLevel);
    let newPositionMs = snapToGrid(Math.max(0, draggedClip.lanePositionMs + deltaMs));

    // Track source lane to detect cross-lane moves
    const sourceLane = draggedClip.cameraLane;

    // If moving to a different lane, check for overlap
    if (targetLane !== sourceLane) {
      const hasOverlap = await timelineService.checkOverlap(
        timeline.videoGroupId,
        targetLane,
        newPositionMs,
        draggedClip.durationMs,
        clipId
      );

      if (hasOverlap) {
        // Fall back to end of lane if overlap detected
        const lane = timeline.lanes.find(l => l.lane === targetLane);
        newPositionMs = lane
          ? timelineService.findNextAvailablePosition(lane)
          : 0;
      }
    }

    try {
      await timelineService.moveClip({
        clipId,
        newLane: targetLane,
        newPositionMs: snapToGrid(newPositionMs),
        originalLane: sourceLane,
      }, gameId);
      await loadTimeline();
    } catch (err) {
      console.error('Failed to move clip:', err);
    }
  };

  // Add clip to lane
  const handleAddClip = async (videoId: string, lane: number, positionMs?: number) => {
    if (!timeline) return;

    const targetLane = timeline.lanes.find(l => l.lane === lane);
    const position = positionMs ?? (targetLane
      ? timelineService.findNextAvailablePosition(targetLane)
      : 0);

    try {
      await timelineService.addClip(timeline.videoGroupId, {
        videoId,
        cameraLane: lane,
        positionMs: snapToGrid(position),
      });
      await loadTimeline();
    } catch (err) {
      console.error('Failed to add clip:', err);
    }
  };

  // Remove clip
  const handleRemoveClip = async (clipId: string) => {
    try {
      await timelineService.removeClip(clipId);
      await loadTimeline();
    } catch (err) {
      console.error('Failed to remove clip:', err);
    }
  };

  // Select clip
  const handleClipSelect = (clip: TimelineClip) => {
    setPlaybackState(prev => ({
      ...prev,
      selectedClipId: clip.id,
      activeLane: clip.cameraLane,
    }));
    onClipSelect?.(clip);
  };

  // Update lane label
  const handleLaneLabelChange = async (lane: number, label: string) => {
    if (!timeline) return;

    try {
      await timelineService.updateLaneLabel(timeline.videoGroupId, lane, label);
      await loadTimeline();
    } catch (err) {
      console.error('Failed to update lane label:', err);
    }
  };

  // Add new lane
  const handleAddLane = () => {
    if (!timeline) return;
    const nextLane = timelineService.getNextAvailableLane(timeline.lanes);
    if (nextLane <= TIMELINE_CONSTANTS.MAX_LANES) {
      // Lane will be created when first clip is added
      // For now, we can add an empty lane to the UI
      setTimeline(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          lanes: [
            ...prev.lanes,
            {
              lane: nextLane,
              label: `Camera ${nextLane}`,
              clips: [],
              syncOffsetMs: 0,
            },
          ].sort((a, b) => a.lane - b.lane),
        };
      });
    }
  };

  // Get active clip info for current playhead position
  const getActiveClipInfo = () => {
    if (!timeline) return null;
    const lane = timeline.lanes.find(l => l.lane === playbackState.activeLane);
    if (!lane) return null;
    return timelinePlayback.getActiveClipForLane(lane, playbackState.playheadPositionMs);
  };

  const activeClipInfo = getActiveClipInfo();

  // Check if timeline is effectively empty (no clips on any lane)
  const isEmptyTimeline = !timeline || timeline.lanes.every(l => l.clips.length === 0);
  const hasAvailableVideos = videosByCamera.size > 0;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-red-600">{error}</div>
        <button
          onClick={loadTimeline}
          className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
        >
          Retry
        </button>
      </div>
    );
  }

  // Use a reasonable default width when timeline is empty (5 minutes = 300000ms)
  // instead of 1 hour which is misleading
  const effectiveDurationMs = timeline?.totalDurationMs || (isEmptyTimeline ? 300000 : 3600000);
  const timelineWidth = timeToPixels(effectiveDurationMs, playbackState.zoomLevel);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={skipBackward}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg"
            title="Skip back 10s"
          >
            <SkipBack size={18} />
          </button>
          <button
            onClick={togglePlayback}
            className="p-2 bg-black text-white rounded-lg hover:bg-gray-800"
            title={playbackState.isPlaying ? 'Pause' : 'Play'}
          >
            {playbackState.isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={skipForward}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg"
            title="Skip forward 10s"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-mono text-gray-700">
            {formatTimeMs(playbackState.playheadPositionMs)}
            {' / '}
            {formatTimeMs(timeline?.totalDurationMs || 0)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg"
            disabled={playbackState.zoomLevel === TIMELINE_CONSTANTS.ZOOM_LEVELS[0]}
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">
            {playbackState.zoomLevel}x
          </span>
          <button
            onClick={zoomIn}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg"
            disabled={playbackState.zoomLevel === TIMELINE_CONSTANTS.ZOOM_LEVELS[TIMELINE_CONSTANTS.ZOOM_LEVELS.length - 1]}
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* Gap Indicator (shown when in a gap) */}
      {activeClipInfo?.isInGap && (
        <GapIndicator
          resumeTimeMs={activeClipInfo.nextClipStartMs}
          currentTimeMs={playbackState.playheadPositionMs}
        />
      )}

      {/* Timeline Container */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={containerRef}
          className="relative overflow-x-auto"
          style={{ minHeight: '300px' }}
        >
          {/* Time Ruler */}
          <TimelineRuler
            totalDurationMs={effectiveDurationMs}
            zoomLevel={playbackState.zoomLevel}
            playheadPositionMs={playbackState.playheadPositionMs}
            onSeek={seekTo}
          />

          {/* Empty State Banner */}
          {isEmptyTimeline && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-blue-600">
                  <Plus size={20} />
                </div>
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    {hasAvailableVideos
                      ? 'Add videos to your timeline'
                      : 'No videos uploaded yet'}
                  </div>
                  <div className="text-xs text-blue-700">
                    {hasAvailableVideos
                      ? 'Click the + button on each lane to add videos from that camera'
                      : 'Upload videos in Camera View first, then add them here'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Swim Lanes */}
          <div className="relative" style={{ width: Math.max(timelineWidth, 800) }}>
            {/* Playhead */}
            <TimelinePlayhead
              positionMs={playbackState.playheadPositionMs}
              zoomLevel={playbackState.zoomLevel}
              height={(timeline?.lanes.length || 1) * 80 + 40}
            />

            {/* Lanes */}
            {(timeline?.lanes || []).map(lane => (
              <SwimLane
                key={lane.lane}
                lane={lane}
                zoomLevel={playbackState.zoomLevel}
                selectedClipId={playbackState.selectedClipId}
                onClipSelect={handleClipSelect}
                onClipRemove={handleRemoveClip}
                onLabelChange={(label) => handleLaneLabelChange(lane.lane, label)}
                onAddClip={(videoId) => handleAddClip(videoId, lane.lane)}
                totalDurationMs={timeline?.totalDurationMs || 0}
                availableVideos={videosByCamera.get(lane.lane) || []}
              />
            ))}

            {/* Add Lane Button */}
            {(timeline?.lanes.length || 0) < TIMELINE_CONSTANTS.MAX_LANES && (
              <button
                onClick={handleAddLane}
                className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-t border-gray-200 w-full"
              >
                <Plus size={16} />
                Add Camera Lane
              </button>
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedClip && (
            <TimelineClipBlock
              clip={draggedClip}
              zoomLevel={playbackState.zoomLevel}
              isSelected={false}
              isDragging={true}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export default TimelineEditor;
