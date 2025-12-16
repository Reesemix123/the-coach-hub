// Timeline Playback Service - Time calculations and playback coordination

import type {
  GameTimeline,
  CameraLane,
  TimelineClip,
  ActiveClipInfo,
} from '@/types/timeline';

/**
 * TimelinePlaybackController handles all time-related calculations
 * for playing back multi-clip camera timelines
 */
export class TimelinePlaybackController {
  /**
   * Get the active clip for a specific lane at a given time
   */
  getActiveClipForLane(
    lane: CameraLane,
    timeMs: number
  ): ActiveClipInfo {
    // Find clip that covers this time
    for (const clip of lane.clips) {
      const clipStart = clip.lanePositionMs;
      const clipEnd = clipStart + clip.durationMs;

      if (timeMs >= clipStart && timeMs < clipEnd) {
        return {
          clip,
          clipTimeMs: timeMs - clipStart + clip.startOffsetMs,
          isInGap: false,
          nextClipStartMs: null,
        };
      }
    }

    // No clip at this time - we're in a gap
    const nextClip = this.getNextClipAfterTime(lane, timeMs);

    return {
      clip: null,
      clipTimeMs: 0,
      isInGap: true,
      nextClipStartMs: nextClip?.lanePositionMs ?? null,
    };
  }

  /**
   * Get active clips for all lanes at a given time
   */
  getActiveClipsForAllLanes(
    timeline: GameTimeline,
    timeMs: number
  ): Map<number, ActiveClipInfo> {
    const result = new Map<number, ActiveClipInfo>();

    for (const lane of timeline.lanes) {
      result.set(lane.lane, this.getActiveClipForLane(lane, timeMs));
    }

    return result;
  }

  /**
   * Convert timeline time to clip-local time
   */
  toClipTime(clip: TimelineClip, timelineTimeMs: number): number {
    const offsetIntoClip = timelineTimeMs - clip.lanePositionMs;
    return clip.startOffsetMs + offsetIntoClip;
  }

  /**
   * Convert clip-local time to timeline time
   */
  toTimelineTime(clip: TimelineClip, clipTimeMs: number): number {
    const offsetIntoClip = clipTimeMs - clip.startOffsetMs;
    return clip.lanePositionMs + offsetIntoClip;
  }

  /**
   * Find the next clip boundary (start or end) after current time
   * Useful for preloading
   */
  getNextClipBoundary(
    timeline: GameTimeline,
    currentTimeMs: number
  ): number | null {
    let nextBoundary: number | null = null;

    for (const lane of timeline.lanes) {
      for (const clip of lane.clips) {
        const clipStart = clip.lanePositionMs;
        const clipEnd = clipStart + clip.durationMs;

        // Check clip start
        if (clipStart > currentTimeMs) {
          if (nextBoundary === null || clipStart < nextBoundary) {
            nextBoundary = clipStart;
          }
        }

        // Check clip end
        if (clipEnd > currentTimeMs) {
          if (nextBoundary === null || clipEnd < nextBoundary) {
            nextBoundary = clipEnd;
          }
        }
      }
    }

    return nextBoundary;
  }

  /**
   * Check if a time position is in a gap for a specific lane
   */
  isInGap(lane: CameraLane, timeMs: number): boolean {
    for (const clip of lane.clips) {
      const clipStart = clip.lanePositionMs;
      const clipEnd = clipStart + clip.durationMs;

      if (timeMs >= clipStart && timeMs < clipEnd) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get the next clip after a given time in a lane
   */
  getNextClipAfterTime(lane: CameraLane, timeMs: number): TimelineClip | null {
    let nextClip: TimelineClip | null = null;
    let nextStartTime = Infinity;

    for (const clip of lane.clips) {
      if (clip.lanePositionMs > timeMs && clip.lanePositionMs < nextStartTime) {
        nextClip = clip;
        nextStartTime = clip.lanePositionMs;
      }
    }

    return nextClip;
  }

  /**
   * Get the previous clip before a given time in a lane
   */
  getPreviousClipBeforeTime(lane: CameraLane, timeMs: number): TimelineClip | null {
    let prevClip: TimelineClip | null = null;
    let prevEndTime = -Infinity;

    for (const clip of lane.clips) {
      const clipEnd = clip.lanePositionMs + clip.durationMs;
      if (clipEnd <= timeMs && clipEnd > prevEndTime) {
        prevClip = clip;
        prevEndTime = clipEnd;
      }
    }

    return prevClip;
  }

  /**
   * Get resume time - when the next clip starts after a gap
   */
  getResumeTime(lane: CameraLane, currentTimeMs: number): number | null {
    const nextClip = this.getNextClipAfterTime(lane, currentTimeMs);
    return nextClip?.lanePositionMs ?? null;
  }

  /**
   * Find clips that need to be preloaded (upcoming clips)
   */
  getClipsToPreload(
    timeline: GameTimeline,
    currentTimeMs: number,
    preloadWindowMs: number = 10000
  ): TimelineClip[] {
    const clips: TimelineClip[] = [];
    const targetTime = currentTimeMs + preloadWindowMs;

    for (const lane of timeline.lanes) {
      for (const clip of lane.clips) {
        const clipStart = clip.lanePositionMs;

        // Preload clips that start within the preload window
        if (clipStart > currentTimeMs && clipStart <= targetTime) {
          clips.push(clip);
        }
      }
    }

    return clips;
  }

  /**
   * Get all clip boundaries for timeline markers
   */
  getAllClipBoundaries(timeline: GameTimeline): Array<{
    timeMs: number;
    type: 'start' | 'end';
    clip: TimelineClip;
    lane: number;
  }> {
    const boundaries: Array<{
      timeMs: number;
      type: 'start' | 'end';
      clip: TimelineClip;
      lane: number;
    }> = [];

    for (const lane of timeline.lanes) {
      for (const clip of lane.clips) {
        boundaries.push({
          timeMs: clip.lanePositionMs,
          type: 'start',
          clip,
          lane: lane.lane,
        });
        boundaries.push({
          timeMs: clip.lanePositionMs + clip.durationMs,
          type: 'end',
          clip,
          lane: lane.lane,
        });
      }
    }

    return boundaries.sort((a, b) => a.timeMs - b.timeMs);
  }

  /**
   * Find gaps in a lane (periods with no video)
   */
  findGapsInLane(lane: CameraLane, totalDurationMs: number): Array<{
    startMs: number;
    endMs: number;
  }> {
    const gaps: Array<{ startMs: number; endMs: number }> = [];
    const sortedClips = [...lane.clips].sort((a, b) => a.lanePositionMs - b.lanePositionMs);

    let currentPosition = 0;

    for (const clip of sortedClips) {
      if (clip.lanePositionMs > currentPosition) {
        gaps.push({
          startMs: currentPosition,
          endMs: clip.lanePositionMs,
        });
      }
      currentPosition = clip.lanePositionMs + clip.durationMs;
    }

    // Check for gap at the end
    if (currentPosition < totalDurationMs) {
      gaps.push({
        startMs: currentPosition,
        endMs: totalDurationMs,
      });
    }

    return gaps;
  }

  /**
   * Validate clip placement (no overlaps)
   */
  canPlaceClip(
    lane: CameraLane,
    positionMs: number,
    durationMs: number,
    excludeClipId?: string
  ): boolean {
    const newStart = positionMs;
    const newEnd = positionMs + durationMs;

    for (const clip of lane.clips) {
      if (excludeClipId && clip.id === excludeClipId) {
        continue;
      }

      const clipStart = clip.lanePositionMs;
      const clipEnd = clipStart + clip.durationMs;

      // Check for overlap
      if (
        (newStart >= clipStart && newStart < clipEnd) ||
        (newEnd > clipStart && newEnd <= clipEnd) ||
        (newStart <= clipStart && newEnd >= clipEnd)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find the closest valid position for a clip (snapping to avoid overlaps)
   */
  findClosestValidPosition(
    lane: CameraLane,
    targetPositionMs: number,
    durationMs: number,
    excludeClipId?: string
  ): number {
    // Try the target position first
    if (this.canPlaceClip(lane, targetPositionMs, durationMs, excludeClipId)) {
      return targetPositionMs;
    }

    // Sort clips by position
    const otherClips = lane.clips
      .filter(c => c.id !== excludeClipId)
      .sort((a, b) => a.lanePositionMs - b.lanePositionMs);

    // Try snapping to the end of each clip
    for (const clip of otherClips) {
      const snapPosition = clip.lanePositionMs + clip.durationMs;
      if (this.canPlaceClip(lane, snapPosition, durationMs, excludeClipId)) {
        return snapPosition;
      }
    }

    // Try snapping to the start of each clip (before it)
    for (const clip of otherClips) {
      const snapPosition = clip.lanePositionMs - durationMs;
      if (snapPosition >= 0 && this.canPlaceClip(lane, snapPosition, durationMs, excludeClipId)) {
        return snapPosition;
      }
    }

    // As a fallback, place at the very end
    let maxEnd = 0;
    for (const clip of otherClips) {
      const clipEnd = clip.lanePositionMs + clip.durationMs;
      if (clipEnd > maxEnd) maxEnd = clipEnd;
    }

    return maxEnd;
  }

  /**
   * Calculate sync offset between two lanes based on a reference point
   */
  calculateSyncOffset(
    lane1: CameraLane,
    lane2: CameraLane,
    referenceTime1Ms: number,
    referenceTime2Ms: number
  ): number {
    return referenceTime1Ms - referenceTime2Ms;
  }
}

// Export singleton instance
export const timelinePlayback = new TimelinePlaybackController();
