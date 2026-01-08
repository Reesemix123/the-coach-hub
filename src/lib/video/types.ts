/**
 * Video library types
 *
 * Defines interfaces for the video playback abstraction layer.
 * These types enable provider-agnostic video handling, making it
 * easier to switch between Supabase Storage, Mux, Cloudflare Stream, etc.
 *
 * @module lib/video/types
 * @since Phase 2 - Film System Refactor
 */

/**
 * Video metadata from the database
 */
export interface VideoMetadata {
  id: string;
  name: string;
  file_path?: string | null;
  url?: string | null;
  camera_label?: string | null;
  camera_order?: number;
  sync_offset_seconds?: number;
  is_virtual?: boolean;
  game_id?: string;
}

/**
 * Signed URL result from a video provider
 */
export interface SignedUrlResult {
  url: string;
  expiresAt: number; // Timestamp when URL expires
  generatedAt: number; // Timestamp when URL was generated
}

/**
 * Video provider interface - abstraction for different video storage services
 *
 * Implementations:
 * - SupabaseVideoProvider: Current implementation using Supabase Storage
 * - MuxVideoProvider: Future implementation for Mux
 * - CloudflareStreamProvider: Future implementation for Cloudflare Stream
 */
export interface VideoProvider {
  /**
   * Provider name for logging/debugging
   */
  readonly name: string;

  /**
   * Generate a signed/playback URL for a video
   * @param video - Video metadata with file_path or provider-specific ID
   * @param expiresIn - URL validity duration in seconds
   * @returns Signed URL result or null if generation fails
   */
  getPlaybackUrl(video: VideoMetadata, expiresIn?: number): Promise<SignedUrlResult | null>;

  /**
   * Check if URL is still valid (not expired)
   * @param result - Previous signed URL result
   * @returns true if URL should still be valid
   */
  isUrlValid(result: SignedUrlResult): boolean;

  /**
   * Get recommended refresh interval in milliseconds
   * Should be significantly before URL expiration
   */
  getRefreshInterval(): number;
}

/**
 * Playback state emitted by VideoPlaybackManager
 */
export interface PlaybackState {
  /** Current playback time in seconds */
  currentTime: number;
  /** Total video duration in seconds */
  duration: number;
  /** Whether video is currently playing */
  isPlaying: boolean;
  /** Playback rate (1.0 = normal speed) */
  playbackRate: number;
  /** Video is buffering */
  isBuffering: boolean;
  /** Volume level (0-1) */
  volume: number;
  /** Whether video is muted */
  isMuted: boolean;
}

/**
 * Video load state
 */
export type VideoLoadState =
  | { status: 'idle' }
  | { status: 'loading'; videoId: string }
  | { status: 'loaded'; videoId: string; url: string }
  | { status: 'error'; videoId: string; error: string };

/**
 * Events emitted by VideoPlaybackManager
 */
export interface PlaybackManagerEvents {
  /** Playback state changed (time, playing, etc.) */
  stateChange: (state: PlaybackState) => void;
  /** Video load state changed */
  loadStateChange: (state: VideoLoadState) => void;
  /** Video ended */
  ended: () => void;
  /** Error occurred */
  error: (error: Error) => void;
  /** URL was refreshed */
  urlRefreshed: (result: SignedUrlResult) => void;
  /** Seeking started */
  seeking: () => void;
  /** Seeking completed */
  seeked: () => void;
}

/**
 * Configuration for VideoPlaybackManager
 */
export interface PlaybackManagerConfig {
  /** Video provider to use */
  provider: VideoProvider;
  /** Auto-refresh URLs before expiration */
  autoRefreshUrls?: boolean;
  /** Buffer time before expiration to trigger refresh (ms) */
  refreshBufferMs?: number;
  /** Retry failed URL generation */
  retryOnError?: boolean;
  /** Max retry attempts */
  maxRetries?: number;
}
