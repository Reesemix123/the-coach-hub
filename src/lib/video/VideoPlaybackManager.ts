/**
 * VideoPlaybackManager
 *
 * Centralized manager for video playback operations. Encapsulates:
 * - Video element management
 * - Signed URL lifecycle (generation, refresh, expiration)
 * - Playback state tracking
 * - Event emission for state changes
 *
 * This abstraction layer enables:
 * 1. Easier testing (can mock the manager)
 * 2. Provider-agnostic video handling (Supabase, Mux, etc.)
 * 3. Centralized error handling and recovery
 * 4. Consistent playback behavior across the app
 *
 * @module lib/video/VideoPlaybackManager
 * @since Phase 2 - Film System Refactor
 */

import type {
  VideoMetadata,
  VideoProvider,
  SignedUrlResult,
  PlaybackState,
  VideoLoadState,
  PlaybackManagerEvents,
  PlaybackManagerConfig,
} from './types';
import { getSupabaseVideoProvider } from './providers/SupabaseVideoProvider';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Omit<PlaybackManagerConfig, 'provider'> = {
  autoRefreshUrls: true,
  refreshBufferMs: 15 * 60 * 1000, // 15 minutes before expiry
  retryOnError: true,
  maxRetries: 2,
};

/**
 * VideoPlaybackManager - Manages video playback lifecycle
 *
 * @example
 * ```typescript
 * // Create manager with video element
 * const manager = new VideoPlaybackManager(videoElement);
 *
 * // Listen for state changes
 * manager.on('stateChange', (state) => {
 *   console.log('Current time:', state.currentTime);
 * });
 *
 * // Load a video
 * await manager.load(videoMetadata);
 *
 * // Control playback
 * manager.play();
 * manager.seek(30); // Jump to 30 seconds
 * manager.pause();
 *
 * // Cleanup
 * manager.destroy();
 * ```
 */
export class VideoPlaybackManager {
  private videoElement: HTMLVideoElement | null = null;
  private provider: VideoProvider;
  private config: PlaybackManagerConfig;

  // Current state
  private currentVideo: VideoMetadata | null = null;
  private currentUrl: SignedUrlResult | null = null;
  private loadState: VideoLoadState = { status: 'idle' };
  private refreshTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;

  // Event listeners
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Partial<Record<keyof PlaybackManagerEvents, Set<(...args: any[]) => void>>> = {};

  // Video element event handlers (stored for cleanup)
  private boundHandlers: Record<string, EventListener> = {};

  constructor(
    videoElement?: HTMLVideoElement | null,
    config?: Partial<PlaybackManagerConfig>
  ) {
    this.provider = config?.provider ?? getSupabaseVideoProvider();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      provider: this.provider,
    };

    if (videoElement) {
      this.attachVideoElement(videoElement);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Attach a video element to manage
   */
  attachVideoElement(element: HTMLVideoElement): void {
    // Cleanup old element if exists
    if (this.videoElement) {
      this.detachVideoElement();
    }

    this.videoElement = element;
    this.setupVideoEventListeners();

    console.log('[VideoPlaybackManager] Attached video element');
  }

  /**
   * Detach the current video element
   */
  detachVideoElement(): void {
    if (!this.videoElement) return;

    this.cleanupVideoEventListeners();
    this.videoElement = null;

    console.log('[VideoPlaybackManager] Detached video element');
  }

  /**
   * Load a video
   *
   * @param video - Video metadata to load
   * @returns true if load initiated successfully
   */
  async load(video: VideoMetadata): Promise<boolean> {
    // Cancel any pending refresh
    this.cancelRefresh();

    // Skip virtual videos
    if (video.is_virtual) {
      console.log('[VideoPlaybackManager] Skipping virtual video:', video.id);
      this.setLoadState({ status: 'idle' });
      return false;
    }

    this.currentVideo = video;
    this.setLoadState({ status: 'loading', videoId: video.id });
    this.retryCount = 0;

    return this.loadVideoUrl(video);
  }

  /**
   * Reload the current video (e.g., after URL expiration)
   */
  async reload(): Promise<boolean> {
    if (!this.currentVideo) {
      console.warn('[VideoPlaybackManager] No video to reload');
      return false;
    }

    return this.load(this.currentVideo);
  }

  /**
   * Play the video
   */
  async play(): Promise<void> {
    if (!this.videoElement) {
      console.warn('[VideoPlaybackManager] No video element attached');
      return;
    }

    try {
      await this.videoElement.play();
    } catch (err) {
      // Autoplay may be blocked - this is expected
      console.log('[VideoPlaybackManager] Play failed (may be autoplay blocked):', err);
    }
  }

  /**
   * Pause the video
   */
  pause(): void {
    if (!this.videoElement) return;
    this.videoElement.pause();
  }

  /**
   * Seek to a specific time
   *
   * @param time - Time in seconds
   */
  seek(time: number): void {
    if (!this.videoElement) return;

    const clampedTime = Math.max(0, Math.min(time, this.videoElement.duration || Infinity));
    this.videoElement.currentTime = clampedTime;
  }

  /**
   * Get current playback position in seconds
   */
  getPosition(): number {
    return this.videoElement?.currentTime ?? 0;
  }

  /**
   * Get video duration in seconds
   */
  getDuration(): number {
    return this.videoElement?.duration ?? 0;
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    const el = this.videoElement;
    return {
      currentTime: el?.currentTime ?? 0,
      duration: el?.duration ?? 0,
      isPlaying: el ? !el.paused : false,
      playbackRate: el?.playbackRate ?? 1,
      isBuffering: el ? el.readyState < 3 : false,
      volume: el?.volume ?? 1,
      isMuted: el?.muted ?? false,
    };
  }

  /**
   * Get current load state
   */
  getLoadState(): VideoLoadState {
    return this.loadState;
  }

  /**
   * Get currently loaded video metadata
   */
  getCurrentVideo(): VideoMetadata | null {
    return this.currentVideo;
  }

  /**
   * Get current signed URL result
   */
  getCurrentUrl(): SignedUrlResult | null {
    return this.currentUrl;
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate;
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Set muted state
   */
  setMuted(muted: boolean): void {
    if (this.videoElement) {
      this.videoElement.muted = muted;
    }
  }

  /**
   * Subscribe to events
   */
  on<K extends keyof PlaybackManagerEvents>(
    event: K,
    callback: PlaybackManagerEvents[K]
  ): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(callback);
  }

  /**
   * Unsubscribe from events
   */
  off<K extends keyof PlaybackManagerEvents>(
    event: K,
    callback: PlaybackManagerEvents[K]
  ): void {
    this.listeners[event]?.delete(callback);
  }

  /**
   * Cleanup and destroy the manager
   */
  destroy(): void {
    this.cancelRefresh();
    this.detachVideoElement();
    this.listeners = {};
    this.currentVideo = null;
    this.currentUrl = null;
    this.setLoadState({ status: 'idle' });

    console.log('[VideoPlaybackManager] Destroyed');
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Load video URL from provider
   */
  private async loadVideoUrl(video: VideoMetadata): Promise<boolean> {
    const result = await this.provider.getPlaybackUrl(video);

    if (!result) {
      const errorMsg = 'Failed to generate video URL';
      console.error('[VideoPlaybackManager]', errorMsg);

      // Retry if enabled
      if (this.config.retryOnError && this.retryCount < (this.config.maxRetries ?? 2)) {
        this.retryCount++;
        console.log(`[VideoPlaybackManager] Retrying (${this.retryCount}/${this.config.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
        return this.loadVideoUrl(video);
      }

      this.setLoadState({ status: 'error', videoId: video.id, error: errorMsg });
      this.emit('error', new Error(errorMsg));
      return false;
    }

    this.currentUrl = result;

    // Set the video source
    if (this.videoElement) {
      this.videoElement.src = result.url;
    }

    this.setLoadState({ status: 'loaded', videoId: video.id, url: result.url });

    // Schedule refresh if enabled
    if (this.config.autoRefreshUrls) {
      this.scheduleRefresh();
    }

    return true;
  }

  /**
   * Schedule URL refresh before expiration
   */
  private scheduleRefresh(): void {
    if (!this.currentUrl || !this.currentVideo) return;

    const refreshInterval = this.provider.getRefreshInterval();
    const timeSinceGeneration = Date.now() - this.currentUrl.generatedAt;
    const timeUntilRefresh = Math.max(0, refreshInterval - timeSinceGeneration);

    console.log(`[VideoPlaybackManager] Scheduling URL refresh in ${Math.round(timeUntilRefresh / 60000)} minutes`);

    this.refreshTimer = setTimeout(() => this.refreshUrl(), timeUntilRefresh);
  }

  /**
   * Refresh the current URL
   */
  private async refreshUrl(): Promise<void> {
    if (!this.currentVideo) return;

    console.log('[VideoPlaybackManager] Refreshing URL...');

    // Store playback state
    const wasPlaying = this.videoElement && !this.videoElement.paused;
    const currentTime = this.videoElement?.currentTime ?? 0;

    // Get new URL
    const result = await this.provider.getPlaybackUrl(this.currentVideo);

    if (!result) {
      console.error('[VideoPlaybackManager] URL refresh failed');
      this.emit('error', new Error('URL refresh failed'));
      return;
    }

    this.currentUrl = result;

    // Update video source
    if (this.videoElement) {
      this.videoElement.src = result.url;

      // Restore playback state after metadata loads
      const restore = () => {
        if (this.videoElement) {
          this.videoElement.currentTime = currentTime;
          if (wasPlaying) {
            this.videoElement.play().catch(() => {});
          }
        }
      };

      if (this.videoElement.readyState >= 1) {
        restore();
      } else {
        this.videoElement.addEventListener('loadedmetadata', restore, { once: true });
      }
    }

    this.emit('urlRefreshed', result);

    // Schedule next refresh
    this.scheduleRefresh();
  }

  /**
   * Cancel pending refresh
   */
  private cancelRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Set load state and emit event
   */
  private setLoadState(state: VideoLoadState): void {
    this.loadState = state;
    this.emit('loadStateChange', state);
  }

  /**
   * Emit an event to all listeners
   */
  private emit<K extends keyof PlaybackManagerEvents>(
    event: K,
    ...args: Parameters<PlaybackManagerEvents[K]>
  ): void {
    this.listeners[event]?.forEach(callback => {
      try {
        callback(...args);
      } catch (err) {
        console.error(`[VideoPlaybackManager] Error in ${event} listener:`, err);
      }
    });
  }

  /**
   * Setup video element event listeners
   */
  private setupVideoEventListeners(): void {
    if (!this.videoElement) return;

    const el = this.videoElement;

    // Create bound handlers
    this.boundHandlers = {
      timeupdate: () => this.emit('stateChange', this.getState()),
      play: () => this.emit('stateChange', this.getState()),
      pause: () => this.emit('stateChange', this.getState()),
      ended: () => this.emit('ended'),
      seeking: () => this.emit('seeking'),
      seeked: () => this.emit('seeked'),
      error: () => {
        const error = el.error;
        this.emit('error', new Error(error?.message ?? 'Video playback error'));
      },
      ratechange: () => this.emit('stateChange', this.getState()),
      volumechange: () => this.emit('stateChange', this.getState()),
      loadedmetadata: () => this.emit('stateChange', this.getState()),
    };

    // Attach handlers
    Object.entries(this.boundHandlers).forEach(([event, handler]) => {
      el.addEventListener(event, handler);
    });
  }

  /**
   * Cleanup video element event listeners
   */
  private cleanupVideoEventListeners(): void {
    if (!this.videoElement) return;

    const el = this.videoElement;

    Object.entries(this.boundHandlers).forEach(([event, handler]) => {
      el.removeEventListener(event, handler);
    });

    this.boundHandlers = {};
  }
}

export default VideoPlaybackManager;
