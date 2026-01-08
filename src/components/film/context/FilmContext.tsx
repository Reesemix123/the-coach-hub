'use client';

/**
 * FilmContext Provider
 *
 * React Context for the film tagging page state.
 * Provides centralized state management via useReducer.
 *
 * Usage:
 * ```tsx
 * <FilmProvider gameId={gameId}>
 *   <VideoPlaybackPanel />
 *   <TaggingPanel />
 *   <TimelinePanel />
 * </FilmProvider>
 * ```
 *
 * @module components/film/context/FilmContext
 * @since Phase 3 - Component Decomposition
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
  type Dispatch,
} from 'react';

import type { FilmState } from './types';
import { initialFilmState } from './types';
import type { FilmAction } from './filmActions';
import { filmReducer } from './filmReducer';

// ============================================
// CONTEXT TYPES
// ============================================

interface FilmContextValue {
  /** Current state */
  state: FilmState;
  /** Dispatch function */
  dispatch: Dispatch<FilmAction>;
}

// ============================================
// CONTEXTS
// ============================================

const FilmContext = createContext<FilmContextValue | null>(null);

// ============================================
// PROVIDER COMPONENT
// ============================================

interface FilmProviderProps {
  children: ReactNode;
  /** Optional initial state for testing or hydration */
  initialState?: Partial<FilmState>;
}

/**
 * FilmProvider - Provides film state to child components
 */
export function FilmProvider({ children, initialState }: FilmProviderProps) {
  // Merge any provided initial state with defaults
  const mergedInitialState = useMemo(
    () => ({
      ...initialFilmState,
      ...initialState,
      data: {
        ...initialFilmState.data,
        ...initialState?.data,
      },
      playback: {
        ...initialFilmState.playback,
        ...initialState?.playback,
      },
      camera: {
        ...initialFilmState.camera,
        ...initialState?.camera,
      },
      timeline: {
        ...initialFilmState.timeline,
        ...initialState?.timeline,
      },
      tagging: {
        ...initialFilmState.tagging,
        ...initialState?.tagging,
      },
      ui: {
        ...initialFilmState.ui,
        ...initialState?.ui,
      },
    }),
    [initialState]
  );

  const [state, dispatch] = useReducer(filmReducer, mergedInitialState);

  const value = useMemo(
    () => ({
      state,
      dispatch,
    }),
    [state]
  );

  return (
    <FilmContext.Provider value={value}>
      {children}
    </FilmContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================

/**
 * useFilmContext - Access the full film context
 *
 * @throws Error if used outside FilmProvider
 * @returns Film context value with state and dispatch
 */
export function useFilmContext(): FilmContextValue {
  const context = useContext(FilmContext);

  if (!context) {
    throw new Error('useFilmContext must be used within a FilmProvider');
  }

  return context;
}

/**
 * useFilmState - Access just the state (no dispatch)
 *
 * @returns Film state
 */
export function useFilmState(): FilmState {
  const { state } = useFilmContext();
  return state;
}

/**
 * useFilmDispatch - Access just the dispatch function
 *
 * @returns Dispatch function
 */
export function useFilmDispatch(): Dispatch<FilmAction> {
  const { dispatch } = useFilmContext();
  return dispatch;
}

// ============================================
// SELECTOR HOOKS (State Slices)
// ============================================

/**
 * useCoreData - Access core data state
 */
export function useCoreData() {
  const { state } = useFilmContext();
  return state.data;
}

/**
 * usePlayback - Access playback state
 */
export function usePlayback() {
  const { state } = useFilmContext();
  return state.playback;
}

/**
 * useCamera - Access camera sync state
 */
export function useCamera() {
  const { state } = useFilmContext();
  return state.camera;
}

/**
 * useTimeline - Access timeline state
 */
export function useTimeline() {
  const { state } = useFilmContext();
  return state.timeline;
}

/**
 * useTagging - Access tagging form state
 */
export function useTagging() {
  const { state } = useFilmContext();
  return state.tagging;
}

/**
 * useFilmUI - Access UI state
 */
export function useFilmUI() {
  const { state } = useFilmContext();
  return state.ui;
}

// ============================================
// ACTION DISPATCH HOOKS
// ============================================

/**
 * usePlaybackActions - Memoized playback action dispatchers
 */
export function usePlaybackActions() {
  const dispatch = useFilmDispatch();

  return useMemo(
    () => ({
      setSelectedVideo: (video: FilmState['playback']['selectedVideo']) =>
        dispatch({ type: 'SET_SELECTED_VIDEO', payload: video }),
      setVideoUrl: (url: string) =>
        dispatch({ type: 'SET_VIDEO_URL', payload: url }),
      setCurrentTime: (time: number) =>
        dispatch({ type: 'SET_CURRENT_TIME', payload: time }),
      setVideoDuration: (duration: number) =>
        dispatch({ type: 'SET_VIDEO_DURATION', payload: duration }),
      setIsPlaying: (playing: boolean) =>
        dispatch({ type: 'SET_IS_PLAYING', payload: playing }),
      setVideoLoadError: (error: string | null) =>
        dispatch({ type: 'SET_VIDEO_LOAD_ERROR', payload: error }),
    }),
    [dispatch]
  );
}

/**
 * useCameraActions - Memoized camera action dispatchers
 */
export function useCameraActions() {
  const dispatch = useFilmDispatch();

  return useMemo(
    () => ({
      startCameraSwitch: (
        targetCameraId: string,
        targetGameTimeMs: number,
        shouldResumePlayback: boolean
      ) =>
        dispatch({
          type: 'START_CAMERA_SWITCH',
          payload: { targetCameraId, targetGameTimeMs, shouldResumePlayback },
        }),
      completeCameraSwitch: (videoOffsetMs: number, clipDurationMs: number) =>
        dispatch({
          type: 'COMPLETE_CAMERA_SWITCH',
          payload: { videoOffsetMs, clipDurationMs },
        }),
      setGameTimelinePosition: (positionMs: number) =>
        dispatch({ type: 'SET_GAME_TIMELINE_POSITION', payload: positionMs }),
      setPendingSyncSeek: (seekTime: number | null) =>
        dispatch({ type: 'SET_PENDING_SYNC_SEEK', payload: seekTime }),
    }),
    [dispatch]
  );
}

/**
 * useTaggingActions - Memoized tagging action dispatchers
 */
export function useTaggingActions() {
  const dispatch = useFilmDispatch();

  return useMemo(
    () => ({
      openTagModal: (
        startTime: number,
        endTime?: number | null,
        editingInstance?: FilmState['tagging']['editingInstance']
      ) =>
        dispatch({
          type: 'OPEN_TAG_MODAL',
          payload: { startTime, endTime, editingInstance },
        }),
      closeTagModal: () => dispatch({ type: 'CLOSE_TAG_MODAL' }),
      setTaggingMode: (mode: FilmState['tagging']['taggingMode']) =>
        dispatch({ type: 'SET_TAGGING_MODE', payload: mode }),
      setIsTaggingOpponent: (isOpponent: boolean) =>
        dispatch({ type: 'SET_IS_TAGGING_OPPONENT', payload: isOpponent }),
      setIsSavingPlay: (saving: boolean) =>
        dispatch({ type: 'SET_IS_SAVING_PLAY', payload: saving }),
      setCurrentDrive: (drive: FilmState['tagging']['currentDrive']) =>
        dispatch({ type: 'SET_CURRENT_DRIVE', payload: drive }),
    }),
    [dispatch]
  );
}

/**
 * useDataActions - Memoized data action dispatchers
 */
export function useDataActions() {
  const dispatch = useFilmDispatch();

  return useMemo(
    () => ({
      setGame: (game: FilmState['data']['game']) =>
        dispatch({ type: 'SET_GAME', payload: game }),
      setVideos: (videos: FilmState['data']['videos']) =>
        dispatch({ type: 'SET_VIDEOS', payload: videos }),
      setPlays: (plays: FilmState['data']['plays']) =>
        dispatch({ type: 'SET_PLAYS', payload: plays }),
      setPlayInstances: (instances: FilmState['data']['playInstances']) =>
        dispatch({ type: 'SET_PLAY_INSTANCES', payload: instances }),
      addPlayInstance: (instance: FilmState['data']['playInstances'][0]) =>
        dispatch({ type: 'ADD_PLAY_INSTANCE', payload: instance }),
      updatePlayInstance: (instance: FilmState['data']['playInstances'][0]) =>
        dispatch({ type: 'UPDATE_PLAY_INSTANCE', payload: instance }),
      deletePlayInstance: (playId: string) =>
        dispatch({ type: 'DELETE_PLAY_INSTANCE', payload: playId }),
      setPlayers: (players: FilmState['data']['players']) =>
        dispatch({ type: 'SET_PLAYERS', payload: players }),
      setDrives: (drives: FilmState['data']['drives']) =>
        dispatch({ type: 'SET_DRIVES', payload: drives }),
      addDrive: (drive: FilmState['data']['drives'][0]) =>
        dispatch({ type: 'ADD_DRIVE', payload: drive }),
      setMarkers: (markers: FilmState['data']['markers']) =>
        dispatch({ type: 'SET_MARKERS', payload: markers }),
      setLoading: (key: string, state: FilmState['data']['loading']['game']) =>
        dispatch({ type: 'SET_LOADING', payload: { key: key as keyof FilmState['data']['loading'], state } }),
      setError: (error: string) =>
        dispatch({ type: 'SET_ERROR', payload: error }),
      clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
    }),
    [dispatch]
  );
}

// ============================================
// EXPORTS
// ============================================

export { FilmContext };
