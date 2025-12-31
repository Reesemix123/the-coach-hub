'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { createClient } from '@/utils/supabase/client';
import { TimelineService } from '@/lib/services/timeline.service';
import { VideoMarkerService } from '@/lib/services/video-marker.service';
import {
  TIMELINE_CONSTANTS,
  type GameTimeline,
  type TimelineClip,
  type CameraLane,
} from '@/types/timeline';
import type { VideoTimelineMarker, MarkerType, Video } from '@/types/football';

// ============================================
// TYPES
// ============================================

interface CameraInfo {
  id: string;
  name: string;
  label: string;
  order: number;
  syncOffsetSeconds: number;
  durationMs: number;
  thumbnailUrl: string | null;
  url: string;
}

interface CameraSelection {
  id: string;
  camera_id: string;
  start_seconds: number;
  end_seconds: number | null;
}

interface VideoWithUrl {
  id: string;
  name: string;
  url: string;
  signedUrl: string;
  durationMs: number;
}

interface FilmStudioState {
  // Core data
  gameId: string;
  teamId: string;
  gameName: string;

  // Timeline
  timeline: GameTimeline | null;
  zoomLevel: number;
  playheadPositionMs: number;
  scrollPositionMs: number;

  // Selection
  selectedClipId: string | null;
  activeLaneNumber: number;

  // Video Player
  activeVideo: VideoWithUrl | null;
  isPlaying: boolean;
  currentTimeMs: number;

  // Phase Markers (game periods)
  phaseMarkers: VideoTimelineMarker[];

  // Cameras
  cameras: CameraInfo[];
  primaryCameraId: string | null;
  maxCamerasAllowed: number; // Based on subscription tier

  // Upload
  uploadingToLane: number | null;
  uploadProgress: number;
  uploadStatus: string;

  // Director's Cut
  isRecording: boolean;
  isPlaybackMode: boolean;
  cameraSelections: CameraSelection[];

  // Film Slicing (marking play boundaries)
  sliceStartTimeMs: number | null;
  sliceEndTimeMs: number | null;
  isSlicing: boolean;
  showSliceModal: boolean;

  // UI State
  isLoading: boolean;
  error: string | null;
}

// Actions
type FilmStudioAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_TIMELINE'; timeline: GameTimeline | null }
  | { type: 'SET_CAMERAS'; cameras: CameraInfo[] }
  | { type: 'SET_PHASE_MARKERS'; markers: VideoTimelineMarker[] }
  | { type: 'SET_CAMERA_SELECTIONS'; selections: CameraSelection[] }
  | { type: 'SET_ACTIVE_VIDEO'; video: VideoWithUrl | null }
  | { type: 'SEEK_TO'; timeMs: number }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'TOGGLE_PLAYBACK' }
  | { type: 'UPDATE_CURRENT_TIME'; timeMs: number }
  | { type: 'SELECT_CLIP'; clipId: string | null }
  | { type: 'SET_ACTIVE_LANE'; lane: number }
  | { type: 'SWITCH_CAMERA'; cameraId: string }
  | { type: 'SET_PRIMARY_CAMERA'; cameraId: string | null }
  | { type: 'SET_MAX_CAMERAS'; maxCameras: number }
  | { type: 'UPDATE_ZOOM'; level: number }
  | { type: 'SET_SCROLL_POSITION'; positionMs: number }
  | { type: 'START_UPLOAD'; lane: number }
  | { type: 'UPDATE_UPLOAD_PROGRESS'; progress: number; status?: string }
  | { type: 'COMPLETE_UPLOAD' }
  | { type: 'CANCEL_UPLOAD' }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'START_PLAYBACK_MODE' }
  | { type: 'STOP_PLAYBACK_MODE' }
  | { type: 'SET_GAME_INFO'; gameId: string; teamId: string; gameName: string }
  | { type: 'MARK_SLICE_START'; timeMs: number }
  | { type: 'MARK_SLICE_END'; timeMs: number }
  | { type: 'CLEAR_SLICE' }
  | { type: 'SHOW_SLICE_MODAL'; show: boolean };

// Initial state
const initialState: FilmStudioState = {
  gameId: '',
  teamId: '',
  gameName: '',
  timeline: null,
  zoomLevel: 1,
  playheadPositionMs: 0,
  scrollPositionMs: 0,
  selectedClipId: null,
  activeLaneNumber: 1,
  activeVideo: null,
  isPlaying: false,
  currentTimeMs: 0,
  phaseMarkers: [],
  cameras: [],
  primaryCameraId: null,
  maxCamerasAllowed: 1, // Default to basic tier, will be updated on load
  uploadingToLane: null,
  uploadProgress: 0,
  uploadStatus: '',
  isRecording: false,
  isPlaybackMode: false,
  cameraSelections: [],
  sliceStartTimeMs: null,
  sliceEndTimeMs: null,
  isSlicing: false,
  showSliceModal: false,
  isLoading: true,
  error: null,
};

// ============================================
// REDUCER
// ============================================

function filmStudioReducer(
  state: FilmStudioState,
  action: FilmStudioAction
): FilmStudioState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading };

    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };

    case 'SET_GAME_INFO':
      return {
        ...state,
        gameId: action.gameId,
        teamId: action.teamId,
        gameName: action.gameName,
      };

    case 'SET_TIMELINE':
      return { ...state, timeline: action.timeline };

    case 'SET_CAMERAS':
      return { ...state, cameras: action.cameras };

    case 'SET_PHASE_MARKERS':
      return { ...state, phaseMarkers: action.markers };

    case 'SET_CAMERA_SELECTIONS':
      return { ...state, cameraSelections: action.selections };

    case 'SET_ACTIVE_VIDEO':
      return { ...state, activeVideo: action.video };

    case 'SEEK_TO':
      return {
        ...state,
        playheadPositionMs: action.timeMs,
        currentTimeMs: action.timeMs,
      };

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.isPlaying };

    case 'TOGGLE_PLAYBACK':
      return { ...state, isPlaying: !state.isPlaying };

    case 'UPDATE_CURRENT_TIME':
      return {
        ...state,
        currentTimeMs: action.timeMs,
        playheadPositionMs: action.timeMs,
      };

    case 'SELECT_CLIP':
      return { ...state, selectedClipId: action.clipId };

    case 'SET_ACTIVE_LANE':
      return { ...state, activeLaneNumber: action.lane };

    case 'SWITCH_CAMERA':
      return { ...state, primaryCameraId: action.cameraId };

    case 'SET_PRIMARY_CAMERA':
      return { ...state, primaryCameraId: action.cameraId };

    case 'SET_MAX_CAMERAS':
      return { ...state, maxCamerasAllowed: action.maxCameras };

    case 'UPDATE_ZOOM':
      return { ...state, zoomLevel: action.level };

    case 'SET_SCROLL_POSITION':
      return { ...state, scrollPositionMs: action.positionMs };

    case 'START_UPLOAD':
      return {
        ...state,
        uploadingToLane: action.lane,
        uploadProgress: 0,
        uploadStatus: 'Starting upload...',
      };

    case 'UPDATE_UPLOAD_PROGRESS':
      return {
        ...state,
        uploadProgress: action.progress,
        uploadStatus: action.status || state.uploadStatus,
      };

    case 'COMPLETE_UPLOAD':
    case 'CANCEL_UPLOAD':
      return {
        ...state,
        uploadingToLane: null,
        uploadProgress: 0,
        uploadStatus: '',
      };

    case 'START_RECORDING':
      return { ...state, isRecording: true, isPlaybackMode: false };

    case 'STOP_RECORDING':
      return { ...state, isRecording: false };

    case 'START_PLAYBACK_MODE':
      return { ...state, isPlaybackMode: true, isRecording: false };

    case 'STOP_PLAYBACK_MODE':
      return { ...state, isPlaybackMode: false };

    // Film Slicing
    case 'MARK_SLICE_START':
      return {
        ...state,
        sliceStartTimeMs: action.timeMs,
        sliceEndTimeMs: null,
        isSlicing: true,
      };

    case 'MARK_SLICE_END':
      return {
        ...state,
        sliceEndTimeMs: action.timeMs,
        isSlicing: false,
        showSliceModal: true,
      };

    case 'CLEAR_SLICE':
      return {
        ...state,
        sliceStartTimeMs: null,
        sliceEndTimeMs: null,
        isSlicing: false,
        showSliceModal: false,
      };

    case 'SHOW_SLICE_MODAL':
      return { ...state, showSliceModal: action.show };

    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

interface FilmStudioContextValue {
  state: FilmStudioState;
  dispatch: React.Dispatch<FilmStudioAction>;

  // Actions
  loadTimeline: () => Promise<void>;
  loadCameras: () => Promise<void>;
  loadPhaseMarkers: () => Promise<void>;
  loadCameraSelections: () => Promise<void>;

  // Clip operations
  addClip: (videoId: string, lane: number, positionMs?: number) => Promise<void>;
  moveClip: (clipId: string, newLane: number, newPositionMs: number) => Promise<void>;
  removeClip: (clipId: string) => Promise<void>;

  // Phase marker operations
  updateMarkerPosition: (markerId: string, newPositionMs: number) => Promise<void>;
  addPhaseMarker: (type: MarkerType, positionMs: number, label?: string) => Promise<void>;
  deletePhaseMarker: (markerId: string) => Promise<void>;

  // Camera operations
  switchCamera: (cameraId: string) => void;
  updateCameraSync: (cameraId: string, offsetSeconds: number) => Promise<void>;

  // Lane operations
  updateLaneLabel: (lane: number, label: string) => Promise<void>;

  // Playback
  seekTo: (timeMs: number) => void;
  togglePlayback: () => void;
  setPlaying: (playing: boolean) => void;

  // Director's Cut
  startRecording: () => void;
  stopRecording: () => void;
  recordCameraSelection: (cameraId: string, startSeconds: number) => Promise<void>;
  clearCameraSelections: () => Promise<void>;

  // Film Slicing
  markSliceStart: () => void;
  markSliceEnd: () => void;
  clearSlice: () => void;
  saveSlice: (playData?: { playCode?: string; notes?: string }) => Promise<void>;

  // Services
  timelineService: TimelineService;
  markerService: VideoMarkerService;
}

const FilmStudioContext = createContext<FilmStudioContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface FilmStudioProviderProps {
  gameId: string;
  teamId: string;
  gameName?: string;
  children: ReactNode;
}

export function FilmStudioProvider({
  gameId,
  teamId,
  gameName = '',
  children,
}: FilmStudioProviderProps) {
  const [state, dispatch] = useReducer(filmStudioReducer, {
    ...initialState,
    gameId,
    teamId,
    gameName,
  });

  const supabase = createClient();
  const timelineServiceRef = useRef(new TimelineService());
  const markerServiceRef = useRef(new VideoMarkerService());

  const timelineService = timelineServiceRef.current;
  const markerService = markerServiceRef.current;

  // ============================================
  // DATA LOADING
  // ============================================

  const loadTimeline = useCallback(async () => {
    try {
      console.log('[FilmStudio] loadTimeline called for game:', gameId);
      const timeline = await timelineService.getOrCreateTimeline(gameId, teamId);
      console.log('[FilmStudio] loadTimeline got timeline:', timeline);
      dispatch({ type: 'SET_TIMELINE', timeline });
    } catch (err) {
      console.error('[FilmStudio] Failed to load timeline:', err);
      dispatch({ type: 'SET_ERROR', error: 'Failed to load timeline' });
    }
  }, [gameId, teamId, timelineService]);

  const loadCameras = useCallback(async () => {
    try {
      console.log('[FilmStudio] loadCameras called:', {
        gameId,
        hasTimeline: !!state.timeline,
        lanesCount: state.timeline?.lanes?.length || 0,
        lanes: state.timeline?.lanes?.map(l => ({
          lane: l.lane,
          label: l.label,
          clipsCount: l.clips?.length || 0
        }))
      });

      // Build a map from lane number to lane info and primary video
      // Pick the first video in each lane as the "primary" for that camera angle
      const laneToVideo = new Map<number, { label: string; videoId: string }>();

      // First try to get cameras from timeline lanes
      if (state.timeline && state.timeline.lanes.length > 0) {
        state.timeline.lanes.forEach(lane => {
          if (lane.clips.length > 0 && !laneToVideo.has(lane.lane)) {
            // Use the first clip's video as the primary for this lane
            laneToVideo.set(lane.lane, {
              label: lane.label,
              videoId: lane.clips[0].videoId,
            });
          }
        });
      }

      console.log('[FilmStudio] laneToVideo map size from timeline:', laneToVideo.size);

      // Fallback: If no clips in timeline lanes, load directly from videos table
      if (laneToVideo.size === 0) {
        console.log('[FilmStudio] No lanes with clips, falling back to videos table for gameId:', gameId);
        const { data: videos, error } = await supabase
          .from('videos')
          .select('id, name, url, camera_label, camera_order, sync_offset_seconds, duration_seconds, thumbnail_url')
          .eq('game_id', gameId)
          .eq('is_virtual', false)
          .order('camera_order', { ascending: true });

        if (error) {
          console.error('[FilmStudio] Failed to load videos fallback:', error);
          dispatch({ type: 'SET_CAMERAS', cameras: [] });
          return;
        }

        console.log('[FilmStudio] Fallback videos found:', videos?.length || 0, 'videos:', videos?.map(v => ({ id: v.id, name: v.name, hasUrl: !!v.url, duration: v.duration_seconds })));

        // Filter to only videos with URLs
        const videosWithUrls = videos?.filter(v => v.url) || [];
        console.log('[FilmStudio] Fallback videos with URLs:', videosWithUrls.length);

        if (videosWithUrls.length === 0) {
          console.log('[FilmStudio] No videos with URLs found, setting cameras to empty');
          dispatch({ type: 'SET_CAMERAS', cameras: [] });
          return;
        }

        // Create cameras directly from videos
        const cameras: CameraInfo[] = videosWithUrls.map((video, index) => ({
          id: video.id,
          name: video.name,
          label: video.camera_label || `Camera ${index + 1}`,
          order: video.camera_order || index + 1,
          syncOffsetSeconds: video.sync_offset_seconds || 0,
          durationMs: (video.duration_seconds || 0) * 1000,
          thumbnailUrl: video.thumbnail_url,
          url: video.url,
        }));

        cameras.sort((a, b) => a.order - b.order);

        console.log('[FilmStudio] Setting cameras from fallback:', cameras.map(c => ({
          id: c.id,
          label: c.label,
          order: c.order
        })));

        dispatch({ type: 'SET_CAMERAS', cameras });
        return;
      }

      // Get video data for the primary video of each lane
      const videoIds = Array.from(laneToVideo.values()).map(v => v.videoId);
      const { data: videos, error } = await supabase
        .from('videos')
        .select('id, name, url, camera_label, camera_order, sync_offset_seconds, duration_seconds, thumbnail_url')
        .in('id', videoIds);

      if (error) throw error;

      // Create cameras array - one per lane, using lane labels
      const cameras: CameraInfo[] = [];
      laneToVideo.forEach((laneInfo, laneNumber) => {
        const video = videos?.find(v => v.id === laneInfo.videoId);
        if (video) {
          cameras.push({
            id: video.id,
            name: video.name,
            label: laneInfo.label, // Use lane label, not video's camera_label
            order: laneNumber,
            syncOffsetSeconds: video.sync_offset_seconds || 0,
            durationMs: (video.duration_seconds || 0) * 1000,
            thumbnailUrl: video.thumbnail_url,
            url: video.url,
          });
        }
      });

      // Sort by lane number to match swimlane order
      cameras.sort((a, b) => a.order - b.order);

      console.log('[FilmStudio] Setting cameras:', cameras.map(c => ({
        id: c.id,
        label: c.label,
        order: c.order
      })));

      dispatch({ type: 'SET_CAMERAS', cameras });
    } catch (err) {
      console.error('Failed to load cameras:', err);
    }
  }, [gameId, supabase, state.timeline]);

  const loadPhaseMarkers = useCallback(async () => {
    try {
      // Get the primary video ID for single-video markers
      const { data: videos } = await supabase
        .from('videos')
        .select('id')
        .eq('game_id', gameId)
        .eq('is_virtual', false)
        .order('camera_order', { ascending: true })
        .limit(1);

      if (!videos || videos.length === 0) {
        dispatch({ type: 'SET_PHASE_MARKERS', markers: [] });
        return;
      }

      const videoId = videos[0].id;
      const markers = await markerService.getMarkersForVideo(videoId);

      // Filter to only game period markers
      const phaseMarkers = markers.filter((m) =>
        ['game_start', 'quarter_start', 'quarter_end', 'halftime', 'overtime', 'game_end'].includes(
          m.marker_type
        )
      );

      dispatch({ type: 'SET_PHASE_MARKERS', markers: phaseMarkers });
    } catch (err) {
      console.error('Failed to load phase markers:', err);
    }
  }, [gameId, supabase, markerService]);

  const loadCameraSelections = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/teams/${teamId}/games/${gameId}/camera-selections`
      );
      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'SET_CAMERA_SELECTIONS', selections: data.selections || [] });
      }
    } catch (err) {
      console.error('Failed to load camera selections:', err);
    }
  }, [gameId, teamId]);

  // ============================================
  // CLIP OPERATIONS
  // ============================================

  const addClip = useCallback(
    async (videoId: string, lane: number, positionMs?: number) => {
      if (!state.timeline) return;

      try {
        // Determine position: first clip at 0, subsequent at end
        let position = positionMs;
        if (position === undefined) {
          const laneData = state.timeline.lanes.find((l) => l.lane === lane);
          if (!laneData || laneData.clips.length === 0) {
            position = 0;
          } else {
            position = timelineService.findNextAvailablePosition(laneData);
          }
        }

        await timelineService.addClip(state.timeline.videoGroupId, {
          videoId,
          cameraLane: lane,
          positionMs: position,
        });

        await loadTimeline();
      } catch (err) {
        console.error('Failed to add clip:', err);
        dispatch({ type: 'SET_ERROR', error: 'Failed to add clip' });
      }
    },
    [state.timeline, timelineService, loadTimeline]
  );

  const moveClip = useCallback(
    async (clipId: string, newLane: number, newPositionMs: number) => {
      if (!state.timeline) return;

      try {
        console.log('[FilmStudio] moveClip called:', { clipId, newLane, newPositionMs });

        await timelineService.moveClip(
          {
            clipId,
            newLane,
            newPositionMs,
          },
          gameId
        );

        console.log('[FilmStudio] moveClip service call succeeded, reloading timeline...');

        await loadTimeline();

        console.log('[FilmStudio] Timeline reloaded successfully');
      } catch (err) {
        console.error('[FilmStudio] Failed to move clip:', err);
        dispatch({ type: 'SET_ERROR', error: 'Failed to move clip' });
      }
    },
    [state.timeline, gameId, timelineService, loadTimeline]
  );

  const removeClip = useCallback(
    async (clipId: string) => {
      try {
        await timelineService.removeClip(clipId);
        await loadTimeline();

        // Clear selection if removed clip was selected
        if (state.selectedClipId === clipId) {
          dispatch({ type: 'SELECT_CLIP', clipId: null });
        }
      } catch (err) {
        console.error('Failed to remove clip:', err);
        dispatch({ type: 'SET_ERROR', error: 'Failed to remove clip' });
      }
    },
    [timelineService, loadTimeline, state.selectedClipId]
  );

  // ============================================
  // PHASE MARKER OPERATIONS
  // ============================================

  const updateMarkerPosition = useCallback(
    async (markerId: string, newPositionMs: number) => {
      try {
        await markerService.updateMarker(markerId, {
          virtual_timestamp_start_ms: newPositionMs,
        });
        await loadPhaseMarkers();
      } catch (err) {
        console.error('Failed to update marker position:', err);
      }
    },
    [markerService, loadPhaseMarkers]
  );

  const addPhaseMarker = useCallback(
    async (type: MarkerType, positionMs: number, label?: string) => {
      try {
        // Get the primary video ID
        const { data: videos } = await supabase
          .from('videos')
          .select('id')
          .eq('game_id', gameId)
          .eq('is_virtual', false)
          .order('camera_order', { ascending: true })
          .limit(1);

        if (!videos || videos.length === 0) return;

        await markerService.createMarker({
          video_id: videos[0].id,
          timestamp_start_ms: positionMs,
          marker_type: type,
          label,
        });

        await loadPhaseMarkers();
      } catch (err) {
        console.error('Failed to add phase marker:', err);
      }
    },
    [gameId, supabase, markerService, loadPhaseMarkers]
  );

  const deletePhaseMarker = useCallback(
    async (markerId: string) => {
      try {
        await markerService.deleteMarker(markerId);
        await loadPhaseMarkers();
      } catch (err) {
        console.error('Failed to delete phase marker:', err);
      }
    },
    [markerService, loadPhaseMarkers]
  );

  // ============================================
  // CAMERA OPERATIONS
  // ============================================

  const switchCamera = useCallback(
    (cameraId: string) => {
      const camera = state.cameras.find((c) => c.id === cameraId);
      if (!camera) return;

      // Calculate synced time when switching cameras
      const currentCamera = state.cameras.find((c) => c.id === state.primaryCameraId);
      const currentOffset = currentCamera?.syncOffsetSeconds || 0;
      const newOffset = camera.syncOffsetSeconds;

      // Adjust playhead for sync offset difference
      const adjustedTimeMs =
        state.currentTimeMs + (currentOffset - newOffset) * 1000;

      dispatch({ type: 'SWITCH_CAMERA', cameraId });
      dispatch({ type: 'SEEK_TO', timeMs: Math.max(0, adjustedTimeMs) });

      // Record camera selection if in recording mode
      if (state.isRecording) {
        recordCameraSelection(cameraId, state.currentTimeMs / 1000);
      }
    },
    [state.cameras, state.primaryCameraId, state.currentTimeMs, state.isRecording]
  );

  const updateCameraSync = useCallback(
    async (cameraId: string, offsetSeconds: number) => {
      try {
        const { error } = await supabase
          .from('videos')
          .update({ sync_offset_seconds: offsetSeconds })
          .eq('id', cameraId);

        if (error) throw error;
        await loadCameras();
      } catch (err) {
        console.error('Failed to update camera sync:', err);
      }
    },
    [supabase, loadCameras]
  );

  // ============================================
  // LANE OPERATIONS
  // ============================================

  const updateLaneLabel = useCallback(
    async (lane: number, label: string) => {
      console.log('[FilmStudio] updateLaneLabel called:', { lane, label, hasTimeline: !!state.timeline });

      if (!state.timeline) {
        console.log('[FilmStudio] No timeline, cannot update lane label');
        return;
      }

      // Check if lane exists and has any clips - labels are stored on clips
      const laneData = state.timeline.lanes.find(l => l.lane === lane);

      if (!laneData) {
        // Lane doesn't exist in timeline yet, create it in local state
        console.log('[FilmStudio] Lane does not exist, creating in local state');
        dispatch({
          type: 'SET_TIMELINE',
          timeline: {
            ...state.timeline,
            lanes: [
              ...state.timeline.lanes,
              { lane, label, clips: [], syncOffsetMs: 0 }
            ].sort((a, b) => a.lane - b.lane)
          }
        });
        return;
      }

      if (laneData.clips.length === 0) {
        console.log('[FilmStudio] Lane has no clips, updating local state only');
        // Update local state even if no clips exist (for UX)
        // The label will be applied when a clip is added to this lane
        dispatch({
          type: 'SET_TIMELINE',
          timeline: {
            ...state.timeline,
            lanes: state.timeline.lanes.map(l =>
              l.lane === lane ? { ...l, label } : l
            )
          }
        });
        return;
      }

      try {
        await timelineService.updateLaneLabel(
          state.timeline.videoGroupId,
          lane,
          label
        );
        await loadTimeline();
      } catch (err) {
        console.error('[FilmStudio] Failed to update lane label:', err);
      }
    },
    [state.timeline, timelineService, loadTimeline, dispatch]
  );

  // ============================================
  // PLAYBACK
  // ============================================

  const seekTo = useCallback((timeMs: number) => {
    dispatch({ type: 'SEEK_TO', timeMs: Math.max(0, timeMs) });
  }, []);

  const togglePlayback = useCallback(() => {
    dispatch({ type: 'TOGGLE_PLAYBACK' });
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    dispatch({ type: 'SET_PLAYING', isPlaying: playing });
  }, []);

  // ============================================
  // DIRECTOR'S CUT
  // ============================================

  const startRecording = useCallback(() => {
    dispatch({ type: 'START_RECORDING' });
  }, []);

  const stopRecording = useCallback(() => {
    dispatch({ type: 'STOP_RECORDING' });
  }, []);

  const recordCameraSelection = useCallback(
    async (cameraId: string, startSeconds: number) => {
      try {
        await fetch(`/api/teams/${teamId}/games/${gameId}/camera-selections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camera_id: cameraId, start_seconds: startSeconds }),
        });
        await loadCameraSelections();
      } catch (err) {
        console.error('Failed to record camera selection:', err);
      }
    },
    [gameId, teamId, loadCameraSelections]
  );

  const clearCameraSelections = useCallback(async () => {
    try {
      await fetch(`/api/teams/${teamId}/games/${gameId}/camera-selections`, {
        method: 'DELETE',
      });
      dispatch({ type: 'SET_CAMERA_SELECTIONS', selections: [] });
    } catch (err) {
      console.error('Failed to clear camera selections:', err);
    }
  }, [gameId, teamId]);

  // ============================================
  // FILM SLICING
  // ============================================

  const markSliceStart = useCallback(() => {
    // Don't allow slicing if no camera/video is selected
    if (!state.primaryCameraId || state.cameras.length === 0) {
      console.warn('[FilmStudio] Cannot start slice without a camera selected');
      return;
    }

    dispatch({ type: 'MARK_SLICE_START', timeMs: state.currentTimeMs });
    // Auto-play if paused so user can watch for end of play
    if (!state.isPlaying) {
      dispatch({ type: 'SET_PLAYING', isPlaying: true });
    }
  }, [state.currentTimeMs, state.isPlaying, state.primaryCameraId, state.cameras.length]);

  const markSliceEnd = useCallback(() => {
    dispatch({ type: 'MARK_SLICE_END', timeMs: state.currentTimeMs });
    // Pause video when ending slice
    dispatch({ type: 'SET_PLAYING', isPlaying: false });
  }, [state.currentTimeMs]);

  const clearSlice = useCallback(() => {
    dispatch({ type: 'CLEAR_SLICE' });
  }, []);

  const saveSlice = useCallback(async (playData?: { playCode?: string; notes?: string }) => {
    if (state.sliceStartTimeMs === null || state.sliceEndTimeMs === null) {
      console.warn('[FilmStudio] Cannot save slice without start and end times');
      return;
    }

    // Get the primary camera/video for this slice
    const primaryCamera = state.cameras.find(c => c.id === state.primaryCameraId);
    if (!primaryCamera) {
      console.warn('[FilmStudio] Cannot save slice without a primary camera');
      return;
    }

    try {
      // Create play_instance record
      const { data: game } = await supabase
        .from('games')
        .select('team_id')
        .eq('id', gameId)
        .single();

      const instanceData = {
        video_id: primaryCamera.id,
        camera_id: primaryCamera.id,
        team_id: game?.team_id || teamId,
        timestamp_start: Math.round(state.sliceStartTimeMs / 1000),
        timestamp_end: Math.round(state.sliceEndTimeMs / 1000),
        play_code: playData?.playCode || null,
        notes: playData?.notes || null,
      };

      const { error } = await supabase
        .from('play_instances')
        .insert([instanceData]);

      if (error) throw error;

      console.log('[FilmStudio] Saved slice as play instance');

      dispatch({ type: 'CLEAR_SLICE' });
    } catch (err) {
      console.error('[FilmStudio] Failed to save slice:', err);
    }
  }, [state.sliceStartTimeMs, state.sliceEndTimeMs, state.cameras, state.primaryCameraId, gameId, teamId, supabase]);

  // ============================================
  // INITIAL LOAD
  // ============================================

  useEffect(() => {
    const loadAll = async () => {
      console.log('[FilmStudio] Initial load starting for game:', gameId);
      dispatch({ type: 'SET_LOADING', loading: true });
      try {
        // Load timeline first, then other data in parallel
        console.log('[FilmStudio] Loading timeline...');
        await loadTimeline();
        console.log('[FilmStudio] Timeline loaded, loading phase markers and camera selections...');
        await Promise.all([
          loadPhaseMarkers(),
          loadCameraSelections(),
        ]);
        console.log('[FilmStudio] Initial load complete');
        // Note: Cameras are loaded via separate useEffect when timeline changes
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    };

    if (gameId && teamId) {
      loadAll();
    }
  }, [gameId, teamId, loadTimeline, loadPhaseMarkers, loadCameraSelections]);

  // Load cameras whenever timeline changes (cameras are derived from timeline lanes)
  // Also load cameras even if timeline is null (fallback to videos table)
  useEffect(() => {
    console.log('[FilmStudio] Camera loading effect triggered:', {
      hasTimeline: !!state.timeline,
      lanesCount: state.timeline?.lanes?.length || 0,
    });
    // Always call loadCameras - it has a fallback to load from videos table
    loadCameras();
  }, [state.timeline, loadCameras]);

  // Set primary camera when cameras change
  // Also reset if current primaryCameraId is not in the cameras list
  useEffect(() => {
    const currentCameraExists = state.cameras.some(c => c.id === state.primaryCameraId);
    console.log('[FilmStudio] Primary camera effect:', {
      camerasCount: state.cameras.length,
      currentPrimaryCameraId: state.primaryCameraId,
      currentCameraExists,
      firstCameraId: state.cameras[0]?.id
    });

    // Set primary camera if none selected OR if current one doesn't exist in cameras list
    if (state.cameras.length > 0 && (!state.primaryCameraId || !currentCameraExists)) {
      console.log('[FilmStudio] Auto-selecting primary camera:', state.cameras[0].id);
      dispatch({ type: 'SET_PRIMARY_CAMERA', cameraId: state.cameras[0].id });
    }
  }, [state.cameras, state.primaryCameraId]);

  // Load team's subscription tier limits
  useEffect(() => {
    const loadTierLimits = async () => {
      if (!teamId) {
        // No teamId, use default (premium to be generous while debugging)
        dispatch({ type: 'SET_MAX_CAMERAS', maxCameras: 5 });
        return;
      }

      // Default camera limits by tier
      const defaultMaxCameras: Record<string, number> = {
        basic: 1,
        plus: 3,
        premium: 5,
      };

      try {
        // Get team's subscription
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('tier')
          .eq('team_id', teamId)
          .maybeSingle(); // Use maybeSingle to avoid error if no row found

        if (subError) {
          console.warn('[FilmStudio] Subscription query error:', subError);
        }

        const tier = subscription?.tier || 'premium'; // Default to premium if not found
        console.log('[FilmStudio] Detected tier:', tier);

        // Use defaults based on tier
        const maxCameras = defaultMaxCameras[tier] || 5;
        console.log('[FilmStudio] Setting max cameras:', maxCameras, 'for tier:', tier);
        dispatch({ type: 'SET_MAX_CAMERAS', maxCameras });
      } catch (err) {
        console.error('[FilmStudio] Failed to load tier limits:', err);
        // Default to premium tier limit to avoid blocking users
        dispatch({ type: 'SET_MAX_CAMERAS', maxCameras: 5 });
      }
    };

    loadTierLimits();
  }, [teamId, supabase]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: FilmStudioContextValue = {
    state,
    dispatch,
    loadTimeline,
    loadCameras,
    loadPhaseMarkers,
    loadCameraSelections,
    addClip,
    moveClip,
    removeClip,
    updateMarkerPosition,
    addPhaseMarker,
    deletePhaseMarker,
    switchCamera,
    updateCameraSync,
    updateLaneLabel,
    seekTo,
    togglePlayback,
    setPlaying,
    startRecording,
    stopRecording,
    recordCameraSelection,
    clearCameraSelections,
    markSliceStart,
    markSliceEnd,
    clearSlice,
    saveSlice,
    timelineService,
    markerService,
  };

  return (
    <FilmStudioContext.Provider value={value}>
      {children}
    </FilmStudioContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useFilmStudio() {
  const context = useContext(FilmStudioContext);
  if (!context) {
    throw new Error('useFilmStudio must be used within a FilmStudioProvider');
  }
  return context;
}

export type { FilmStudioState, CameraInfo, CameraSelection, VideoWithUrl };
