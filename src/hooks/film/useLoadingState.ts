'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Loading state types for consistent state management
 */
export type LoadingStatus = 'idle' | 'loading' | 'error' | 'success';

/**
 * Loading state with optional error message
 */
export interface LoadingState {
  status: LoadingStatus;
  error: string | null;
  /** Timestamp of last status change (for debugging/logging) */
  lastUpdated: number | null;
}

/**
 * Return type for the useLoadingState hook
 */
export interface LoadingStateResult {
  // Current state
  status: LoadingStatus;
  error: string | null;
  isIdle: boolean;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;

  // Actions
  setIdle: () => void;
  setLoading: () => void;
  setError: (error: string) => void;
  setSuccess: () => void;

  // Utility for async operations
  withLoading: <T>(operation: () => Promise<T>) => Promise<T | null>;

  // Reset to initial state
  reset: () => void;
}

/**
 * useLoadingState - Unified loading state management
 *
 * This hook provides a consistent pattern for handling loading states
 * across video loading, camera switching, play saving, and other
 * async operations.
 *
 * Features:
 * - Four distinct states: idle, loading, error, success
 * - Computed boolean helpers (isLoading, isError, etc.)
 * - withLoading wrapper for async operations
 * - Automatic error handling and state transitions
 *
 * @param initialStatus - Initial status (defaults to 'idle')
 *
 * @example
 * ```tsx
 * const videoLoading = useLoadingState();
 *
 * const handleLoadVideo = async () => {
 *   const result = await videoLoading.withLoading(async () => {
 *     return await loadVideoFromStorage(videoId);
 *   });
 *
 *   if (result) {
 *     setVideoUrl(result.url);
 *   }
 * };
 *
 * return (
 *   <div>
 *     {videoLoading.isLoading && <Spinner />}
 *     {videoLoading.isError && <Error message={videoLoading.error} />}
 *     {videoLoading.isSuccess && <Video />}
 *   </div>
 * );
 * ```
 *
 * @since Phase 1 - Film System Refactor (Task 1.6)
 */
export function useLoadingState(initialStatus: LoadingStatus = 'idle'): LoadingStateResult {
  const [state, setState] = useState<LoadingState>({
    status: initialStatus,
    error: null,
    lastUpdated: null,
  });

  // Track if a loading operation is in progress (prevents race conditions)
  const operationInProgress = useRef(false);

  /**
   * Set status to idle (initial/reset state)
   */
  const setIdle = useCallback(() => {
    setState({
      status: 'idle',
      error: null,
      lastUpdated: Date.now(),
    });
    operationInProgress.current = false;
  }, []);

  /**
   * Set status to loading
   */
  const setLoading = useCallback(() => {
    setState({
      status: 'loading',
      error: null,
      lastUpdated: Date.now(),
    });
    operationInProgress.current = true;
  }, []);

  /**
   * Set status to error with message
   */
  const setError = useCallback((error: string) => {
    setState({
      status: 'error',
      error,
      lastUpdated: Date.now(),
    });
    operationInProgress.current = false;
  }, []);

  /**
   * Set status to success
   */
  const setSuccess = useCallback(() => {
    setState({
      status: 'success',
      error: null,
      lastUpdated: Date.now(),
    });
    operationInProgress.current = false;
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState({
      status: initialStatus,
      error: null,
      lastUpdated: Date.now(),
    });
    operationInProgress.current = false;
  }, [initialStatus]);

  /**
   * Wrap an async operation with automatic loading state management
   *
   * Automatically:
   * - Sets loading state before operation
   * - Sets success state on completion
   * - Sets error state on failure
   * - Returns result or null on error
   */
  const withLoading = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    // Prevent concurrent operations
    if (operationInProgress.current) {
      console.warn('[useLoadingState] Operation already in progress, skipping');
      return null;
    }

    setLoading();

    try {
      const result = await operation();
      setSuccess();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error('[useLoadingState] Operation failed:', errorMessage);
      return null;
    }
  }, [setLoading, setSuccess, setError]);

  return {
    // Current state
    status: state.status,
    error: state.error,
    isIdle: state.status === 'idle',
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',

    // Actions
    setIdle,
    setLoading,
    setError,
    setSuccess,

    // Utilities
    withLoading,
    reset,
  };
}

/**
 * Type for multiple loading states (e.g., video, camera, save)
 */
export interface MultiLoadingStates {
  video: LoadingStateResult;
  camera: LoadingStateResult;
  save: LoadingStateResult;
}

/**
 * useMultiLoadingState - Manage multiple related loading states
 *
 * Useful when a component has several async operations that need
 * independent state tracking.
 *
 * @example
 * ```tsx
 * const loading = useMultiLoadingState();
 *
 * // Video loading
 * await loading.video.withLoading(() => loadVideo());
 *
 * // Camera switching
 * await loading.camera.withLoading(() => switchCamera());
 *
 * // Save operation
 * await loading.save.withLoading(() => savePlay());
 *
 * // Check if anything is loading
 * const anyLoading = loading.video.isLoading ||
 *                    loading.camera.isLoading ||
 *                    loading.save.isLoading;
 * ```
 *
 * @since Phase 1 - Film System Refactor (Task 1.6)
 */
export function useMultiLoadingState(): MultiLoadingStates {
  const video = useLoadingState();
  const camera = useLoadingState();
  const save = useLoadingState();

  return { video, camera, save };
}

export default useLoadingState;
