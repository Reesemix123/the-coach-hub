import { useCallback } from 'react';
import type { CameraLane, TimelineClip, GameTimeline } from '@/types/timeline';
import { snapToGrid, TIMELINE_CONSTANTS } from '@/types/timeline';

// Types for shift planning
export interface ShiftedClip {
  clipId: string;
  currentPositionMs: number;
  newPositionMs: number;
  durationMs: number;
}

export interface ShiftPlan {
  direction: 'left' | 'right' | 'none';
  affectedClips: ShiftedClip[];
  valid: boolean;
  reason?: string;
}

/**
 * Hook for calculating clip positions and handling overlap/shift logic
 */
export function useClipPositioning(timeline: GameTimeline | null) {
  /**
   * Get the next available position in a lane (for auto-positioning)
   * First clip → 0ms, subsequent clips → end of last clip
   */
  const getNextAvailablePosition = useCallback(
    (laneNumber: number): number => {
      if (!timeline) return 0;

      const lane = timeline.lanes.find((l) => l.lane === laneNumber);
      if (!lane || lane.clips.length === 0) return 0;

      // Find the clip that ends furthest to the right
      const lastEndMs = lane.clips.reduce((max, clip) => {
        const clipEnd = clip.lanePositionMs + clip.durationMs;
        return clipEnd > max ? clipEnd : max;
      }, 0);

      return lastEndMs;
    },
    [timeline]
  );

  /**
   * Find clips that overlap with a given position and duration
   */
  const findOverlappingClips = useCallback(
    (
      laneNumber: number,
      positionMs: number,
      durationMs: number,
      excludeClipId?: string
    ): TimelineClip[] => {
      if (!timeline) return [];

      const lane = timeline.lanes.find((l) => l.lane === laneNumber);
      if (!lane) return [];

      const dropEnd = positionMs + durationMs;

      return lane.clips.filter((clip) => {
        if (clip.id === excludeClipId) return false;

        const clipEnd = clip.lanePositionMs + clip.durationMs;

        // Check for overlap: two ranges overlap if one starts before the other ends
        return positionMs < clipEnd && dropEnd > clip.lanePositionMs;
      });
    },
    [timeline]
  );

  /**
   * Determine the best shift direction when dropping causes overlap
   */
  const determineShiftDirection = useCallback(
    (
      dropPositionMs: number,
      droppedDurationMs: number,
      overlappingClips: TimelineClip[]
    ): 'left' | 'right' => {
      if (overlappingClips.length === 0) return 'right';

      // Get the first overlapping clip for comparison
      const firstOverlap = overlappingClips.sort(
        (a, b) => a.lanePositionMs - b.lanePositionMs
      )[0];

      // Check if shifting left would push any clip to negative position
      const wouldGoNegative = overlappingClips.some(
        (c) => c.lanePositionMs - droppedDurationMs < 0
      );

      if (wouldGoNegative) return 'right';

      // Drop center vs overlap center determines direction
      const dropCenter = dropPositionMs + droppedDurationMs / 2;
      const overlapCenter =
        firstOverlap.lanePositionMs + firstOverlap.durationMs / 2;

      // If drop is to the left of overlap center, shift clips right
      // If drop is to the right, shift clips left
      return dropCenter < overlapCenter ? 'right' : 'left';
    },
    []
  );

  /**
   * Calculate a shift plan for handling overlaps
   */
  const calculateShiftPlan = useCallback(
    (
      laneNumber: number,
      dropPositionMs: number,
      droppedDurationMs: number,
      excludeClipId?: string
    ): ShiftPlan => {
      const overlappingClips = findOverlappingClips(
        laneNumber,
        dropPositionMs,
        droppedDurationMs,
        excludeClipId
      );

      // No overlap - no shift needed
      if (overlappingClips.length === 0) {
        return {
          direction: 'none',
          affectedClips: [],
          valid: true,
        };
      }

      const direction = determineShiftDirection(
        dropPositionMs,
        droppedDurationMs,
        overlappingClips
      );

      // Sort clips by position based on direction
      const sortedClips =
        direction === 'right'
          ? overlappingClips.sort((a, b) => a.lanePositionMs - b.lanePositionMs)
          : overlappingClips.sort(
              (a, b) => b.lanePositionMs - a.lanePositionMs
            );

      const affectedClips: ShiftedClip[] = [];
      let currentInsertEnd = dropPositionMs + droppedDurationMs;
      let currentInsertStart = dropPositionMs;

      if (direction === 'right') {
        // Shift clips to the right
        for (const clip of sortedClips) {
          // Only shift if this clip still overlaps after previous shifts
          if (clip.lanePositionMs < currentInsertEnd) {
            const newPosition = currentInsertEnd;
            affectedClips.push({
              clipId: clip.id,
              currentPositionMs: clip.lanePositionMs,
              newPositionMs: snapToGrid(newPosition),
              durationMs: clip.durationMs,
            });
            currentInsertEnd = newPosition + clip.durationMs;
          }
        }
      } else {
        // Shift clips to the left
        for (const clip of sortedClips) {
          const clipEnd = clip.lanePositionMs + clip.durationMs;

          // Only shift if this clip still overlaps after previous shifts
          if (clipEnd > currentInsertStart) {
            const newPosition = currentInsertStart - clip.durationMs;

            // Validate: can't go negative
            if (newPosition < 0) {
              return {
                direction,
                affectedClips: [],
                valid: false,
                reason: `Cannot shift "${clip.videoName}" - would go before timeline start`,
              };
            }

            affectedClips.push({
              clipId: clip.id,
              currentPositionMs: clip.lanePositionMs,
              newPositionMs: snapToGrid(newPosition),
              durationMs: clip.durationMs,
            });
            currentInsertStart = newPosition;
          }
        }
      }

      return {
        direction,
        affectedClips,
        valid: true,
      };
    },
    [findOverlappingClips, determineShiftDirection]
  );

  /**
   * Check if a position is valid (no overlap) without shifting
   */
  const isPositionValid = useCallback(
    (
      laneNumber: number,
      positionMs: number,
      durationMs: number,
      excludeClipId?: string
    ): boolean => {
      const overlapping = findOverlappingClips(
        laneNumber,
        positionMs,
        durationMs,
        excludeClipId
      );
      return overlapping.length === 0;
    },
    [findOverlappingClips]
  );

  /**
   * Find the closest valid position (no overlap) from a target position
   */
  const findClosestValidPosition = useCallback(
    (
      laneNumber: number,
      targetPositionMs: number,
      durationMs: number,
      excludeClipId?: string
    ): number => {
      if (!timeline) return targetPositionMs;

      const lane = timeline.lanes.find((l) => l.lane === laneNumber);
      if (!lane || lane.clips.length === 0) {
        return snapToGrid(Math.max(0, targetPositionMs));
      }

      // Check if target position is valid
      if (
        isPositionValid(laneNumber, targetPositionMs, durationMs, excludeClipId)
      ) {
        return snapToGrid(Math.max(0, targetPositionMs));
      }

      // Find gaps between clips where we could fit
      const sortedClips = lane.clips
        .filter((c) => c.id !== excludeClipId)
        .sort((a, b) => a.lanePositionMs - b.lanePositionMs);

      // Check gap at the start
      if (sortedClips[0].lanePositionMs >= durationMs) {
        const gapStart = sortedClips[0].lanePositionMs - durationMs;
        if (Math.abs(gapStart - targetPositionMs) < Math.abs(targetPositionMs)) {
          return snapToGrid(gapStart);
        }
        return 0;
      }

      // Check gaps between clips
      for (let i = 0; i < sortedClips.length - 1; i++) {
        const clipEnd = sortedClips[i].lanePositionMs + sortedClips[i].durationMs;
        const nextClipStart = sortedClips[i + 1].lanePositionMs;
        const gapSize = nextClipStart - clipEnd;

        if (gapSize >= durationMs) {
          const gapPosition = clipEnd;
          if (
            Math.abs(gapPosition - targetPositionMs) <
            Math.abs(
              getNextAvailablePosition(laneNumber) - targetPositionMs
            )
          ) {
            return snapToGrid(gapPosition);
          }
        }
      }

      // Fall back to end of lane
      return snapToGrid(getNextAvailablePosition(laneNumber));
    },
    [timeline, isPositionValid, getNextAvailablePosition]
  );

  return {
    getNextAvailablePosition,
    findOverlappingClips,
    calculateShiftPlan,
    isPositionValid,
    findClosestValidPosition,
  };
}

export default useClipPositioning;
