/**
 * Supabase Storage Video Provider
 *
 * Implementation of VideoProvider interface for Supabase Storage.
 * Handles signed URL generation with configurable expiration.
 *
 * @module lib/video/providers/SupabaseVideoProvider
 * @since Phase 2 - Film System Refactor
 */

import { createClient } from '@/utils/supabase/client';
import type { VideoProvider, VideoMetadata, SignedUrlResult } from '../types';

/**
 * Default URL expiration time (1 hour in seconds)
 */
const DEFAULT_EXPIRES_IN = 3600;

/**
 * Refresh interval: 45 minutes (15 min before 1-hour expiry)
 */
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

/**
 * Storage bucket name for game videos
 */
const STORAGE_BUCKET = 'game_videos';

/**
 * Supabase Storage video provider
 *
 * Generates signed URLs for videos stored in Supabase Storage.
 * URLs expire after 1 hour by default, with auto-refresh at 45 minutes.
 *
 * @example
 * ```typescript
 * const provider = new SupabaseVideoProvider();
 * const result = await provider.getPlaybackUrl(video);
 * if (result) {
 *   videoElement.src = result.url;
 * }
 * ```
 */
export class SupabaseVideoProvider implements VideoProvider {
  readonly name = 'supabase';

  private supabase = createClient();

  /**
   * Generate a signed URL for video playback
   *
   * @param video - Video metadata (must have file_path)
   * @param expiresIn - URL validity in seconds (default: 3600)
   * @returns Signed URL result or null if generation fails
   */
  async getPlaybackUrl(
    video: VideoMetadata,
    expiresIn: number = DEFAULT_EXPIRES_IN
  ): Promise<SignedUrlResult | null> {
    // Virtual videos don't need URLs
    if (video.is_virtual) {
      console.log('[SupabaseVideoProvider] Skipping virtual video:', video.id);
      return null;
    }

    if (!video.file_path) {
      console.error('[SupabaseVideoProvider] No file_path for video:', video.id);
      return null;
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(video.file_path, expiresIn);

      if (error) {
        console.error('[SupabaseVideoProvider] Failed to create signed URL:', {
          videoId: video.id,
          filePath: video.file_path,
          error: error.message,
        });
        return null;
      }

      if (!data?.signedUrl) {
        console.error('[SupabaseVideoProvider] No signed URL returned:', video.id);
        return null;
      }

      const now = Date.now();
      const result: SignedUrlResult = {
        url: data.signedUrl,
        generatedAt: now,
        expiresAt: now + (expiresIn * 1000),
      };

      console.log('[SupabaseVideoProvider] Generated signed URL:', {
        videoId: video.id,
        expiresIn,
        refreshIn: `${Math.round(REFRESH_INTERVAL_MS / 60000)} minutes`,
      });

      return result;
    } catch (err) {
      console.error('[SupabaseVideoProvider] Exception generating URL:', {
        videoId: video.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Check if a signed URL is still valid
   *
   * Returns false if URL has expired or is within 5 minutes of expiry
   * (to allow buffer time for refresh)
   */
  isUrlValid(result: SignedUrlResult): boolean {
    const bufferMs = 5 * 60 * 1000; // 5 minute buffer
    return Date.now() < (result.expiresAt - bufferMs);
  }

  /**
   * Get recommended refresh interval
   *
   * Returns 45 minutes (15 min before 1-hour default expiry)
   */
  getRefreshInterval(): number {
    return REFRESH_INTERVAL_MS;
  }
}

/**
 * Singleton instance for convenience
 */
let defaultProvider: SupabaseVideoProvider | null = null;

/**
 * Get the default Supabase video provider instance
 */
export function getSupabaseVideoProvider(): SupabaseVideoProvider {
  if (!defaultProvider) {
    defaultProvider = new SupabaseVideoProvider();
  }
  return defaultProvider;
}

export default SupabaseVideoProvider;
