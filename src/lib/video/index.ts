/**
 * Video library exports
 *
 * @module lib/video
 * @since Phase 2 - Film System Refactor
 */

// Core manager
export { VideoPlaybackManager } from './VideoPlaybackManager';

// Types
export type {
  VideoMetadata,
  VideoProvider,
  SignedUrlResult,
  PlaybackState,
  VideoLoadState,
  PlaybackManagerEvents,
  PlaybackManagerConfig,
} from './types';

// Providers
export { SupabaseVideoProvider, getSupabaseVideoProvider } from './providers/SupabaseVideoProvider';
