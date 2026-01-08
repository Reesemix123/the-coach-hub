/**
 * Film-related hooks
 *
 * These hooks encapsulate video playback, camera state, and loading state
 * management for the film tagging system.
 *
 * Created during Phase 1 of the Film System Refactor.
 * Full integration with tag page will occur in Phase 3.
 *
 * @module hooks/film
 */

export { useVideoPlaybackState } from './useVideoPlaybackState';
export type { VideoPlaybackState } from './useVideoPlaybackState';

export { useCameraState } from './useCameraState';
export type { CameraState } from './useCameraState';

export { useLoadingState, useMultiLoadingState } from './useLoadingState';
export type {
  LoadingStatus,
  LoadingState,
  LoadingStateResult,
  MultiLoadingStates,
} from './useLoadingState';
