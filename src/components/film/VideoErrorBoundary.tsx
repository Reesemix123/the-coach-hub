'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Error context for logging and debugging
 */
interface VideoErrorContext {
  component: string;
  videoId?: string;
  videoName?: string;
  gameId?: string;
  cameraLabel?: string;
  timestamp: string;
  userAgent: string;
}

interface VideoErrorBoundaryProps {
  children: ReactNode;
  /** Video ID for error context logging */
  videoId?: string;
  /** Video name for error context logging */
  videoName?: string;
  /** Game ID for error context logging */
  gameId?: string;
  /** Camera label for error context logging */
  cameraLabel?: string;
  /** Callback when user clicks reload */
  onReload?: () => void;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface VideoErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * VideoErrorBoundary - Catches React errors in the video player section
 *
 * This component:
 * 1. Catches JavaScript errors in child components
 * 2. Logs detailed error context for debugging
 * 3. Shows a recovery UI instead of crashing the entire page
 * 4. Allows user to reload the video section
 *
 * Usage:
 * ```tsx
 * <VideoErrorBoundary
 *   videoId={selectedVideo?.id}
 *   videoName={selectedVideo?.name}
 *   gameId={gameId}
 *   onReload={() => loadVideo(selectedVideo)}
 * >
 *   <VideoPlayer ... />
 * </VideoErrorBoundary>
 * ```
 *
 * @since Phase 1 - Film System Refactor
 */
export class VideoErrorBoundary extends Component<VideoErrorBoundaryProps, VideoErrorBoundaryState> {
  constructor(props: VideoErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<VideoErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const context = this.buildErrorContext();

    // Detailed console logging for debugging
    console.error('[VideoErrorBoundary] Caught error:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      componentStack: errorInfo.componentStack,
    });

    // Store error info for potential display
    this.setState({ errorInfo });

    // Future: Send to error tracking service (Sentry, LogRocket, etc.)
    // this.reportToErrorService(error, context, errorInfo);
  }

  /**
   * Build error context object for logging
   */
  private buildErrorContext(): VideoErrorContext {
    const { videoId, videoName, gameId, cameraLabel } = this.props;

    return {
      component: 'VideoErrorBoundary',
      videoId: videoId || 'unknown',
      videoName: videoName || 'unknown',
      gameId: gameId || 'unknown',
      cameraLabel: cameraLabel || 'unknown',
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };
  }

  /**
   * Reset error state and trigger reload callback
   */
  private handleReload = (): void => {
    const context = this.buildErrorContext();

    console.log('[VideoErrorBoundary] User initiated reload:', {
      context,
      previousError: this.state.error?.message,
    });

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call the reload callback if provided
    this.props.onReload?.();
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, videoName, cameraLabel } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center bg-gray-900 rounded-lg p-8 min-h-[300px]">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />

          <h3 className="text-white text-lg font-semibold mb-2">
            Video Player Error
          </h3>

          <p className="text-gray-400 text-sm text-center mb-4 max-w-md">
            {videoName || cameraLabel
              ? `Unable to load "${videoName || cameraLabel}".`
              : 'Unable to load the video.'
            }
            {' '}This may be a temporary issue.
          </p>

          {/* Show error message in development */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3 mb-4 max-w-md">
              <p className="text-red-300 text-xs font-mono break-all">
                {error.message}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Video
            </button>

            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Refresh Page
            </button>
          </div>

          <p className="text-gray-500 text-xs mt-4">
            If this keeps happening, try refreshing the page or contact support.
          </p>
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook to manually trigger error boundary (for non-React errors like video element errors)
 *
 * Usage:
 * ```tsx
 * const { triggerError } = useVideoErrorTrigger();
 *
 * <video onError={(e) => triggerError(new Error('Video load failed'))} />
 * ```
 */
export function useVideoErrorTrigger() {
  const [error, setError] = React.useState<Error | null>(null);

  // If error is set, throw it to trigger the nearest error boundary
  if (error) {
    throw error;
  }

  return {
    triggerError: (err: Error) => setError(err),
    clearError: () => setError(null),
  };
}

export default VideoErrorBoundary;
