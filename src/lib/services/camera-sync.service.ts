/**
 * CameraSyncService
 *
 * Centralizes all camera synchronization and offset calculations.
 * Provides pure functions for converting between:
 * - Game timeline time (unified timeline for all cameras)
 * - Video time (position within a specific video file)
 *
 * Used by the film tagging page to handle:
 * - Camera switching with preserved timeline position
 * - Gap detection (when no footage covers a timeline position)
 * - Auto-continue to next clip when current clip ends
 *
 * @module lib/services/camera-sync.service
 * @since Phase 2 - Film System Refactor
 */

import type {
  CameraLane,
  TimelineClip,
  ActiveClipInfo,
} from '@/types/timeline';
import { findActiveClipForTime, findLaneForVideo } from '@/types/timeline';

/**
 * Video metadata needed for sync calculations
 */
export interface SyncVideoMetadata {
  id: string;
  sync_offset_seconds?: number;
}

/**
 * Result of finding the best clip to play for a target time
 */
export interface ClipSelectionResult {
  /** The clip to play (null if no coverage) */
  clip: TimelineClip | null;
  /** Video ID to load (same as clip.videoId if clip exists) */
  videoId: string | null;
  /** Time to seek to within the video (seconds) */
  seekTimeSeconds: number;
  /** Whether we're in a gap with no footage */
  isInGap: boolean;
  /** When next coverage starts (for gap messaging) */
  nextCoverageStartMs: number | null;
  /** Lane number the clip is on */
  laneNumber: number | null;
}

/**
 * Time conversion result
 */
export interface TimeConversion {
  /** Target time in the other coordinate system */
  time: number;
  /** Whether conversion was successful (false if no sync data) */
  valid: boolean;
}

/**
 * CameraSyncService - Pure functions for camera sync calculations
 */
export class CameraSyncService {
  /**
   * Convert game timeline time to video time
   *
   * @param gameTimeMs - Position on game timeline (milliseconds)
   * @param clip - The clip being played
   * @returns Video time in seconds, or 0 if invalid
   *
   * @example
   * // Clip starts at 5000ms on timeline
   * // Game time is 7000ms
   * // Result: 2 seconds into the video
   * gameTimeToVideoTime(7000, { lanePositionMs: 5000, ... })
   */
  static gameTimeToVideoTime(gameTimeMs: number, clip: TimelineClip): number {
    const clipRelativeMs = gameTimeMs - clip.lanePositionMs;
    const videoTimeMs = clipRelativeMs + clip.startOffsetMs;
    return Math.max(0, videoTimeMs / 1000);
  }

  /**
   * Convert video time to game timeline time
   *
   * @param videoTimeSeconds - Position in video (seconds)
   * @param clip - The clip being played
   * @returns Game timeline time in milliseconds
   */
  static videoTimeToGameTime(videoTimeSeconds: number, clip: TimelineClip): number {
    const videoTimeMs = videoTimeSeconds * 1000;
    const clipRelativeMs = videoTimeMs - clip.startOffsetMs;
    return clip.lanePositionMs + clipRelativeMs;
  }

  /**
   * Convert game time to video time using legacy sync offset
   * (Used when timeline mode is not configured)
   *
   * @param gameTimeMs - Position on game timeline (milliseconds)
   * @param syncOffsetSeconds - Video's sync offset
   * @returns Video time in seconds
   */
  static gameTimeToVideoTimeLegacy(gameTimeMs: number, syncOffsetSeconds: number): number {
    const offsetMs = syncOffsetSeconds * 1000;
    return Math.max(0, (gameTimeMs - offsetMs) / 1000);
  }

  /**
   * Convert video time to game time using legacy sync offset
   *
   * @param videoTimeSeconds - Position in video (seconds)
   * @param syncOffsetSeconds - Video's sync offset
   * @returns Game timeline time in milliseconds
   */
  static videoTimeToGameTimeLegacy(videoTimeSeconds: number, syncOffsetSeconds: number): number {
    const offsetMs = syncOffsetSeconds * 1000;
    return (videoTimeSeconds * 1000) + offsetMs;
  }

  /**
   * Find the best clip to play for a target game time
   *
   * Searches the specified lane (or all lanes if none specified) to find
   * the clip that covers the target time. Returns info needed to switch
   * to that clip.
   *
   * @param lanes - Timeline lanes with clips
   * @param targetGameTimeMs - Game timeline position to find coverage for
   * @param preferredLane - Lane to search first (falls back to others if no coverage)
   * @returns Selection result with clip info and seek time
   */
  static findClipForTime(
    lanes: CameraLane[],
    targetGameTimeMs: number,
    preferredLane?: number
  ): ClipSelectionResult {
    // If preferred lane specified, check it first
    if (preferredLane !== undefined) {
      const activeInfo = findActiveClipForTime(lanes, preferredLane, targetGameTimeMs);

      if (activeInfo.clip && !activeInfo.isInGap) {
        return {
          clip: activeInfo.clip,
          videoId: activeInfo.clip.videoId,
          seekTimeSeconds: this.gameTimeToVideoTime(targetGameTimeMs, activeInfo.clip),
          isInGap: false,
          nextCoverageStartMs: null,
          laneNumber: preferredLane,
        };
      }

      // Preferred lane has gap - return gap info
      if (activeInfo.isInGap) {
        return {
          clip: null,
          videoId: null,
          seekTimeSeconds: 0,
          isInGap: true,
          nextCoverageStartMs: activeInfo.nextClipStartMs,
          laneNumber: preferredLane,
        };
      }
    }

    // Search all lanes for any coverage
    for (const lane of lanes) {
      const activeInfo = findActiveClipForTime(lanes, lane.lane, targetGameTimeMs);

      if (activeInfo.clip && !activeInfo.isInGap) {
        return {
          clip: activeInfo.clip,
          videoId: activeInfo.clip.videoId,
          seekTimeSeconds: this.gameTimeToVideoTime(targetGameTimeMs, activeInfo.clip),
          isInGap: false,
          nextCoverageStartMs: null,
          laneNumber: lane.lane,
        };
      }
    }

    // No coverage on any lane
    return {
      clip: null,
      videoId: null,
      seekTimeSeconds: 0,
      isInGap: true,
      nextCoverageStartMs: this.findNextCoverageStart(lanes, targetGameTimeMs),
      laneNumber: null,
    };
  }

  /**
   * Find when the next coverage starts across all lanes
   *
   * @param lanes - Timeline lanes with clips
   * @param afterTimeMs - Find next coverage after this time
   * @returns Milliseconds when next coverage starts, or null if none
   */
  static findNextCoverageStart(lanes: CameraLane[], afterTimeMs: number): number | null {
    let earliestStart: number | null = null;

    for (const lane of lanes) {
      for (const clip of lane.clips) {
        if (clip.lanePositionMs > afterTimeMs) {
          if (earliestStart === null || clip.lanePositionMs < earliestStart) {
            earliestStart = clip.lanePositionMs;
          }
        }
      }
    }

    return earliestStart;
  }

  /**
   * Check if a video is currently playing in the active position
   *
   * @param lanes - Timeline lanes
   * @param videoId - Video to check
   * @param gameTimeMs - Current game timeline position
   * @returns true if the video covers this time
   */
  static isVideoActiveAtTime(
    lanes: CameraLane[],
    videoId: string,
    gameTimeMs: number
  ): boolean {
    const laneNumber = findLaneForVideo(lanes, videoId);
    if (laneNumber === null) return false;

    const activeInfo = findActiveClipForTime(lanes, laneNumber, gameTimeMs);
    return activeInfo.clip?.videoId === videoId;
  }

  /**
   * Get the clip that contains a specific video at a given time
   *
   * @param lanes - Timeline lanes
   * @param videoId - Video to find
   * @param gameTimeMs - Game timeline position
   * @returns The clip if found and covers the time, null otherwise
   */
  static getClipForVideo(
    lanes: CameraLane[],
    videoId: string,
    gameTimeMs: number
  ): TimelineClip | null {
    const laneNumber = findLaneForVideo(lanes, videoId);
    if (laneNumber === null) return null;

    const lane = lanes.find(l => l.lane === laneNumber);
    if (!lane) return null;

    // Find clip that matches videoId AND covers the time
    return lane.clips.find(clip => {
      if (clip.videoId !== videoId) return false;
      const clipEnd = clip.lanePositionMs + clip.durationMs;
      return gameTimeMs >= clip.lanePositionMs && gameTimeMs < clipEnd;
    }) || null;
  }

  /**
   * Calculate the video offset for positioning on the timeline
   * (This is the clip's lane position, used to align video time with game time)
   *
   * @param clip - The active clip
   * @returns Offset in milliseconds
   */
  static getVideoOffset(clip: TimelineClip): number {
    // The offset is where the clip's start_offset_ms maps to on the timeline
    return clip.lanePositionMs - clip.startOffsetMs;
  }

  /**
   * Calculate clip end time on the game timeline
   *
   * @param clip - The clip
   * @returns End time in milliseconds
   */
  static getClipEndTime(clip: TimelineClip): number {
    return clip.lanePositionMs + clip.durationMs;
  }

  /**
   * Find the next clip on the same lane
   *
   * @param lanes - Timeline lanes
   * @param currentClip - Current clip
   * @returns Next clip or null if none
   */
  static findNextClipOnLane(
    lanes: CameraLane[],
    currentClip: TimelineClip
  ): TimelineClip | null {
    const lane = lanes.find(l => l.lane === currentClip.cameraLane);
    if (!lane) return null;

    const currentEnd = currentClip.lanePositionMs + currentClip.durationMs;

    // Find clips that start after current ends
    const futureClips = lane.clips
      .filter(c => c.lanePositionMs >= currentEnd)
      .sort((a, b) => a.lanePositionMs - b.lanePositionMs);

    return futureClips[0] || null;
  }

  /**
   * Calculate total timeline duration from all clips
   *
   * @param lanes - Timeline lanes
   * @returns Duration in milliseconds
   */
  static calculateTimelineDuration(lanes: CameraLane[]): number {
    let maxEnd = 0;

    for (const lane of lanes) {
      for (const clip of lane.clips) {
        const clipEnd = clip.lanePositionMs + clip.durationMs;
        if (clipEnd > maxEnd) {
          maxEnd = clipEnd;
        }
      }
    }

    return maxEnd;
  }
}

export default CameraSyncService;
