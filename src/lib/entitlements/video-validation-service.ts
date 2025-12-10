// src/lib/entitlements/video-validation-service.ts
// Video Upload Validation Service
// Validates video files before and after upload based on tier requirements

import { EntitlementsService, VideoRequirements } from './entitlements-service';
import { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface VideoValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PreUploadValidation {
  valid: boolean;
  error?: string;
  requirements?: VideoRequirements;
}

export interface VideoMetadata {
  duration_seconds: number;
  resolution_width: number;
  resolution_height: number;
  fps: number;
  file_size_bytes: number;
  mime_type: string;
}

export interface PostUploadValidation {
  valid: boolean;
  errors: string[];
  metadata?: VideoMetadata;
}

// ============================================================================
// Constants
// ============================================================================

// Accepted file extensions
const ACCEPTED_EXTENSIONS = ['.mp4'];

// Max file size (5GB for Supabase Pro resumable uploads)
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB

// Common camera labels
export const CAMERA_LABELS = [
  'Main Camera',
  'End Zone',
  'Sideline',
  'Press Box',
  'All-22',
  'Tight End',
  'Backfield',
  'Custom'
] as const;

// ============================================================================
// Video Validation Service
// ============================================================================

export class VideoValidationService {
  private supabase: SupabaseClient;
  private entitlements: EntitlementsService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.entitlements = new EntitlementsService(supabase);
  }

  // ============================================================================
  // Pre-Upload Validation (Client-side checks before upload begins)
  // ============================================================================

  /**
   * Validate file before upload begins
   * Called client-side to fail fast on invalid files
   */
  async validatePreUpload(
    teamId: string,
    gameId: string,
    fileName: string,
    fileSize: number
  ): Promise<PreUploadValidation> {
    // Check file extension
    const extension = this.getFileExtension(fileName);
    if (!ACCEPTED_EXTENSIONS.includes(extension.toLowerCase())) {
      return {
        valid: false,
        error: `Please upload an MP4 video file. Received: ${extension || 'unknown format'}`
      };
    }

    // Check file size
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      const maxSizeGB = (MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024)).toFixed(0);
      const fileSizeGB = (fileSize / (1024 * 1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${fileSizeGB}GB) exceeds maximum allowed (${maxSizeGB}GB). For videos over 50 minutes, we recommend compressing to 10-12 Mbps bitrate using HandBrake (free) or your video editing software.`
      };
    }

    // Check camera limit
    const cameraCheck = await this.entitlements.canAddCamera(teamId, gameId);
    if (!cameraCheck.allowed) {
      return {
        valid: false,
        error: cameraCheck.reason || 'Cannot add camera to this game'
      };
    }

    // Get requirements for display
    const requirements = await this.entitlements.getVideoRequirements(teamId);

    return {
      valid: true,
      requirements
    };
  }

  /**
   * Validate file extension only (for quick client-side check)
   */
  validateFileExtension(fileName: string): { valid: boolean; error?: string } {
    const extension = this.getFileExtension(fileName);
    if (!ACCEPTED_EXTENSIONS.includes(extension.toLowerCase())) {
      return {
        valid: false,
        error: `Please upload an MP4 video file. Received: ${extension || 'unknown format'}`
      };
    }
    return { valid: true };
  }

  // ============================================================================
  // Post-Upload Validation (After file is uploaded, validate metadata)
  // ============================================================================

  /**
   * Validate video metadata after upload
   * Called server-side after file is stored
   */
  async validatePostUpload(
    teamId: string,
    metadata: VideoMetadata
  ): Promise<PostUploadValidation> {
    const errors: string[] = [];

    // Get tier requirements
    const requirements = await this.entitlements.getVideoRequirements(teamId);

    // Validate duration
    if (metadata.duration_seconds > requirements.maxDurationSeconds) {
      const maxHours = Math.floor(requirements.maxDurationSeconds / 3600);
      const videoHours = Math.floor(metadata.duration_seconds / 3600);
      const videoMinutes = Math.floor((metadata.duration_seconds % 3600) / 60);
      errors.push(
        `Video must be ${maxHours} hours or less. Your video is ${videoHours} hours ${videoMinutes} minutes.`
      );
    }

    // Validate resolution
    if (metadata.resolution_width > requirements.maxResolutionWidth ||
        metadata.resolution_height > requirements.maxResolutionHeight) {
      errors.push(
        `Maximum resolution is ${requirements.maxResolutionWidth}x${requirements.maxResolutionHeight} (1080p). ` +
        `Your video is ${metadata.resolution_width}x${metadata.resolution_height}. ` +
        `Please re-export at 1080p or lower.`
      );
    }

    // Validate FPS
    if (metadata.fps > requirements.maxFps) {
      errors.push(
        `Maximum frame rate is ${requirements.maxFps}fps. Your video is ${metadata.fps}fps.`
      );
    }

    // Validate file type (double-check mime type)
    if (!metadata.mime_type.includes('video/mp4') &&
        !metadata.mime_type.includes('video/quicktime')) {
      errors.push(
        `Invalid video format. Please upload an MP4 file.`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      metadata
    };
  }

  // ============================================================================
  // Combined Validation
  // ============================================================================

  /**
   * Full validation including permission check, pre-upload, and metadata validation
   */
  async validateFullUpload(
    teamId: string,
    gameId: string,
    fileName: string,
    fileSize: number,
    metadata?: VideoMetadata
  ): Promise<VideoValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Pre-upload checks
    const preCheck = await this.validatePreUpload(teamId, gameId, fileName, fileSize);
    if (!preCheck.valid && preCheck.error) {
      errors.push(preCheck.error);
    }

    // Post-upload checks (if metadata provided)
    if (metadata) {
      const postCheck = await this.validatePostUpload(teamId, metadata);
      if (!postCheck.valid) {
        errors.push(...postCheck.errors);
      }

      // Add warnings for near-limit cases
      const requirements = preCheck.requirements || await this.entitlements.getVideoRequirements(teamId);

      if (metadata.duration_seconds > requirements.maxDurationSeconds * 0.9) {
        warnings.push('Video is close to the maximum duration limit.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    if (parts.length < 2) return '';
    return '.' + parts[parts.length - 1];
  }

  /**
   * Generate storage path for video file
   */
  generateStoragePath(teamId: string, gameId: string, videoId: string): string {
    return `${teamId}/${gameId}/${videoId}.mp4`;
  }

  /**
   * Get user-friendly error message for common issues
   */
  getErrorMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      'invalid_format': 'Please upload an MP4 video file.',
      'file_too_large': 'Video file exceeds 5GB limit. For videos over 50 minutes, compress to 10-12 Mbps using HandBrake (free) or your video editing software.',
      'duration_exceeded': 'Video must be 2 hours or less.',
      'resolution_exceeded': 'Maximum resolution is 1080p. Please re-export your video.',
      'fps_exceeded': 'Maximum frame rate is 60fps.',
      'camera_limit': 'Your plan allows a limited number of camera angles per game. Upgrade to add more.',
      'no_tokens': "You've used all your game uploads this month. Purchase additional uploads or wait until your next billing cycle.",
      'game_locked': 'This game is locked. Upgrade your plan to access.',
      'game_expired': 'This game has expired and is no longer accessible.',
      'upload_failed': 'Upload failed. Please try again.',
      'processing_failed': 'Video processing failed. Please try uploading again.'
    };

    return messages[errorCode] || 'An error occurred. Please try again.';
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  }

  /**
   * Format resolution for display
   */
  formatResolution(width: number, height: number): string {
    if (width === 1920 && height === 1080) return '1080p';
    if (width === 1280 && height === 720) return '720p';
    if (width === 3840 && height === 2160) return '4K';
    return `${width}x${height}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export async function createVideoValidationService(): Promise<VideoValidationService> {
  const supabase = await createServerClient();
  return new VideoValidationService(supabase);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick pre-upload validation
 */
export async function validateVideoUpload(
  teamId: string,
  gameId: string,
  fileName: string,
  fileSize: number
): Promise<PreUploadValidation> {
  const service = await createVideoValidationService();
  return service.validatePreUpload(teamId, gameId, fileName, fileSize);
}

/**
 * Check file extension only (client-side)
 */
export function isValidVideoFile(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension === 'mp4';
}

/**
 * Get accepted formats for display
 */
export function getAcceptedFormats(): string {
  return ACCEPTED_EXTENSIONS.join(', ');
}

/**
 * Get max file size for display
 */
export function getMaxFileSize(): { bytes: number; display: string } {
  return {
    bytes: MAX_FILE_SIZE_BYTES,
    display: `${(MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024)).toFixed(0)}GB`
  };
}
