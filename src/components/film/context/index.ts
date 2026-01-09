/**
 * Film Context Module
 *
 * Centralized state management for the film tagging page.
 *
 * @module components/film/context
 * @since Phase 3 - Component Decomposition
 */

// Types
export type {
  FilmState,
  LoadingState,
  LoadingStates,
  CoreDataState,
  VideoPlaybackState,
  CameraSyncState,
  TimelineState,
  TaggingFormState,
  TaggingMode,
  DriveAssignMode,
  UIState,
  QuarterScore,
  ScoreMismatch,
} from './types';

export {
  initialFilmState,
  initialLoadingStates,
  initialCoreDataState,
  initialVideoPlaybackState,
  initialCameraSyncState,
  initialTimelineState,
  initialTaggingFormState,
  initialUIState,
} from './types';

// Actions
export * from './filmActions';

// Reducer
export { filmReducer } from './filmReducer';

// Context & Hooks
export {
  FilmProvider,
  FilmContext,
  useFilmContext,
  useFilmState,
  useFilmDispatch,
  // State slice hooks
  useCoreData,
  usePlayback,
  useCamera,
  useTimeline,
  useTagging,
  useFilmUI,
  // Action dispatch hooks
  usePlaybackActions,
  useCameraActions,
  useTaggingActions,
  useDataActions,
} from './FilmContext';

// Bridge Hook
export {
  useFilmStateBridge,
  useSyncLocalStateToContext,
} from './useFilmStateBridge';

// Selectors
export {
  // Loading
  useIsLoading,
  useIsInitialized,
  useLoadingState,
  // Video
  useRealVideos,
  useHasMultipleCameras,
  useVideoById,
  // Timeline
  useActiveClipInfo,
  useIsInGap,
  useLaneForVideo,
  // Play instances
  useCurrentVideoPlayInstances,
  useDrivePlayInstances,
  usePlayCountsByType,
  useCurrentPlayInstance,
  // Drives
  useGameDrives,
  useMostRecentDrive,
  // Camera
  useIsCameraSwitching,
  useHasPendingSeek,
  usePendingCamera,
  // UI
  useHasOpenMenu,
  useIsTagModalOpen,
  useAnalyticsTierFeatures,
  // Composite
  usePlaybackInfo,
  useTimelineInfo,
  useTaggingFormInfo,
} from './filmSelectors';
