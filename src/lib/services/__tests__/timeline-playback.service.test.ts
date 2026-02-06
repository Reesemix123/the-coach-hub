import { describe, it, expect } from 'vitest';
import { TimelinePlaybackController } from '@/lib/services/timeline-playback.service';
import { makeClip, makeLane, makeTimeline } from './helpers/test-fixtures';

const controller = new TimelinePlaybackController();

describe('TimelinePlaybackController', () => {
  describe('getActiveClipForLane', () => {
    it('returns clip with correct clipTimeMs when time is inside clip', () => {
      const clip = makeClip({ lanePositionMs: 5000, durationMs: 10000, startOffsetMs: 0 });
      const lane = makeLane(1, [clip]);

      const result = controller.getActiveClipForLane(lane, 7000);

      expect(result.clip).toBe(clip);
      expect(result.isInGap).toBe(false);
      expect(result.clipTimeMs).toBe(2000); // 7000 - 5000 + 0
    });

    it('includes startOffsetMs in clipTimeMs', () => {
      const clip = makeClip({ lanePositionMs: 5000, durationMs: 10000, startOffsetMs: 3000 });
      const lane = makeLane(1, [clip]);

      const result = controller.getActiveClipForLane(lane, 7000);

      expect(result.clipTimeMs).toBe(5000); // 7000 - 5000 + 3000
    });

    it('returns gap with nextClipStartMs when in gap', () => {
      const clip = makeClip({ lanePositionMs: 10000, durationMs: 5000 });
      const lane = makeLane(1, [clip]);

      const result = controller.getActiveClipForLane(lane, 5000);

      expect(result.clip).toBeNull();
      expect(result.isInGap).toBe(true);
      expect(result.nextClipStartMs).toBe(10000);
    });

    it('returns gap with null nextClipStartMs when after all clips', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 5000 });
      const lane = makeLane(1, [clip]);

      const result = controller.getActiveClipForLane(lane, 10000);

      expect(result.isInGap).toBe(true);
      expect(result.nextClipStartMs).toBeNull();
    });

    it('returns correct clip when multiple clips exist', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 10000, durationMs: 5000 });
      const lane = makeLane(1, [clip1, clip2]);

      const result = controller.getActiveClipForLane(lane, 12000);

      expect(result.clip?.id).toBe('c2');
      expect(result.clipTimeMs).toBe(2000); // 12000 - 10000
    });
  });

  describe('getActiveClipsForAllLanes', () => {
    it('returns map with entries for each lane', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 60000, cameraLane: 1 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 5000, durationMs: 30000, cameraLane: 2 });
      const lane1 = makeLane(1, [clip1]);
      const lane2 = makeLane(2, [clip2]);
      const timeline = makeTimeline([lane1, lane2]);

      const result = controller.getActiveClipsForAllLanes(timeline, 10000);

      expect(result.size).toBe(2);
      expect(result.get(1)?.clip?.id).toBe('c1');
      expect(result.get(2)?.clip?.id).toBe('c2');
    });

    it('handles empty timeline', () => {
      const timeline = makeTimeline([]);
      const result = controller.getActiveClipsForAllLanes(timeline, 0);
      expect(result.size).toBe(0);
    });
  });

  describe('toClipTime / toTimelineTime', () => {
    it('converts timeline time to clip time', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 2000 });
      // offsetIntoClip = 8000 - 5000 = 3000, clipTime = 2000 + 3000 = 5000
      expect(controller.toClipTime(clip, 8000)).toBe(5000);
    });

    it('converts clip time to timeline time', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 2000 });
      // offsetIntoClip = 5000 - 2000 = 3000, timelineTime = 5000 + 3000 = 8000
      expect(controller.toTimelineTime(clip, 5000)).toBe(8000);
    });

    it('round-trips correctly', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 2000 });
      const timelineTime = 8000;
      const clipTime = controller.toClipTime(clip, timelineTime);
      expect(controller.toTimelineTime(clip, clipTime)).toBe(timelineTime);
    });

    it('handles zero offsets', () => {
      const clip = makeClip({ lanePositionMs: 0, startOffsetMs: 0 });
      expect(controller.toClipTime(clip, 5000)).toBe(5000);
      expect(controller.toTimelineTime(clip, 5000)).toBe(5000);
    });
  });

  describe('getNextClipBoundary', () => {
    it('returns nearest boundary after current time', () => {
      const clip = makeClip({ lanePositionMs: 10000, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);
      const timeline = makeTimeline([lane]);

      // Nearest boundary after 8000: clip start at 10000
      expect(controller.getNextClipBoundary(timeline, 8000)).toBe(10000);
    });

    it('returns clip end when inside a clip', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 10000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);
      const timeline = makeTimeline([lane]);

      // Inside clip (0-10000), nearest future boundary is clip end at 10000
      expect(controller.getNextClipBoundary(timeline, 5000)).toBe(10000);
    });

    it('returns null when no boundaries after current time', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);
      const timeline = makeTimeline([lane]);

      expect(controller.getNextClipBoundary(timeline, 10000)).toBeNull();
    });

    it('finds global nearest across multiple lanes', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 20000, durationMs: 5000, cameraLane: 1 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 15000, durationMs: 5000, cameraLane: 2 });
      const lane1 = makeLane(1, [clip1]);
      const lane2 = makeLane(2, [clip2]);
      const timeline = makeTimeline([lane1, lane2]);

      expect(controller.getNextClipBoundary(timeline, 10000)).toBe(15000);
    });
  });

  describe('isInGap', () => {
    it('returns false when time is inside a clip', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 10000 });
      const lane = makeLane(1, [clip]);

      expect(controller.isInGap(lane, 5000)).toBe(false);
    });

    it('returns true when time is outside all clips', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 5000 });
      const lane = makeLane(1, [clip]);

      expect(controller.isInGap(lane, 7000)).toBe(true);
    });

    it('returns true for empty lane', () => {
      const lane = makeLane(1, []);
      expect(controller.isInGap(lane, 5000)).toBe(true);
    });
  });

  describe('getNextClipAfterTime / getPreviousClipBeforeTime', () => {
    const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000 });
    const clip2 = makeClip({ id: 'c2', lanePositionMs: 10000, durationMs: 5000 });
    const clip3 = makeClip({ id: 'c3', lanePositionMs: 20000, durationMs: 5000 });
    const lane = makeLane(1, [clip1, clip2, clip3]);

    it('finds the next clip after time', () => {
      expect(controller.getNextClipAfterTime(lane, 7000)?.id).toBe('c2');
    });

    it('returns null when no next clip', () => {
      expect(controller.getNextClipAfterTime(lane, 25000)).toBeNull();
    });

    it('finds the previous clip before time', () => {
      expect(controller.getPreviousClipBeforeTime(lane, 12000)?.id).toBe('c1');
    });

    it('returns null when no previous clip', () => {
      expect(controller.getPreviousClipBeforeTime(lane, 0)).toBeNull();
    });

    it('getPreviousClipBeforeTime finds latest clip that ended before time', () => {
      // At time 22000, both clip1 (end 5000) and clip2 (end 15000) ended before
      // Should return clip2 as the most recent
      expect(controller.getPreviousClipBeforeTime(lane, 22000)?.id).toBe('c2');
    });
  });

  describe('findGapsInLane', () => {
    it('finds gap at start, between clips, and at end', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 5000, durationMs: 5000 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 15000, durationMs: 5000 });
      const lane = makeLane(1, [clip1, clip2]);

      const gaps = controller.findGapsInLane(lane, 30000);

      expect(gaps).toEqual([
        { startMs: 0, endMs: 5000 },
        { startMs: 10000, endMs: 15000 },
        { startMs: 20000, endMs: 30000 },
      ]);
    });

    it('returns no gaps when clips are contiguous', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 5000, durationMs: 5000 });
      const lane = makeLane(1, [clip1, clip2]);

      const gaps = controller.findGapsInLane(lane, 10000);

      expect(gaps).toEqual([]);
    });

    it('returns single gap spanning total duration for empty lane', () => {
      const lane = makeLane(1, []);

      const gaps = controller.findGapsInLane(lane, 60000);

      expect(gaps).toEqual([{ startMs: 0, endMs: 60000 }]);
    });

    it('handles unsorted clips', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 10000, durationMs: 5000 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 0, durationMs: 5000 });
      const lane = makeLane(1, [clip1, clip2]); // Out of order

      const gaps = controller.findGapsInLane(lane, 20000);

      expect(gaps).toEqual([
        { startMs: 5000, endMs: 10000 },
        { startMs: 15000, endMs: 20000 },
      ]);
    });
  });

  describe('canPlaceClip', () => {
    it('returns true when no overlap', () => {
      const existing = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000 });
      const lane = makeLane(1, [existing]);

      expect(controller.canPlaceClip(lane, 10000, 5000)).toBe(true);
    });

    it('returns false when overlapping existing clip', () => {
      const existing = makeClip({ id: 'c1', lanePositionMs: 5000, durationMs: 10000 });
      const lane = makeLane(1, [existing]);

      expect(controller.canPlaceClip(lane, 8000, 5000)).toBe(false);
    });

    it('returns false when new clip completely contains existing', () => {
      const existing = makeClip({ id: 'c1', lanePositionMs: 5000, durationMs: 5000 });
      const lane = makeLane(1, [existing]);

      expect(controller.canPlaceClip(lane, 3000, 10000)).toBe(false);
    });

    it('excludes specified clip from overlap check', () => {
      const existing = makeClip({ id: 'c1', lanePositionMs: 5000, durationMs: 10000 });
      const lane = makeLane(1, [existing]);

      // Would overlap, but we exclude the existing clip
      expect(controller.canPlaceClip(lane, 8000, 5000, 'c1')).toBe(true);
    });

    it('allows adjacent clips (no gap, no overlap)', () => {
      const existing = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000 });
      const lane = makeLane(1, [existing]);

      expect(controller.canPlaceClip(lane, 5000, 5000)).toBe(true);
    });
  });

  describe('findClosestValidPosition', () => {
    it('returns target position when valid', () => {
      const existing = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000 });
      const lane = makeLane(1, [existing]);

      expect(controller.findClosestValidPosition(lane, 10000, 5000)).toBe(10000);
    });

    it('snaps to end of blocking clip when target overlaps', () => {
      const existing = makeClip({ id: 'c1', lanePositionMs: 5000, durationMs: 10000 });
      const lane = makeLane(1, [existing]);

      // Target 8000 overlaps c1. Should snap to end of c1 (15000)
      const result = controller.findClosestValidPosition(lane, 8000, 5000);
      expect(result).toBe(15000);
    });
  });

  describe('calculateSyncOffset', () => {
    it('returns difference between reference times', () => {
      const lane1 = makeLane(1, []);
      const lane2 = makeLane(2, []);

      expect(controller.calculateSyncOffset(lane1, lane2, 10000, 8000)).toBe(2000);
    });

    it('returns 0 when reference times are equal', () => {
      const lane1 = makeLane(1, []);
      const lane2 = makeLane(2, []);

      expect(controller.calculateSyncOffset(lane1, lane2, 5000, 5000)).toBe(0);
    });

    it('returns negative when lane2 reference is ahead', () => {
      const lane1 = makeLane(1, []);
      const lane2 = makeLane(2, []);

      expect(controller.calculateSyncOffset(lane1, lane2, 5000, 8000)).toBe(-3000);
    });
  });

  describe('getClipsToPreload', () => {
    it('returns clips starting within preload window', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 8000, durationMs: 5000, cameraLane: 1 });
      const clip3 = makeClip({ id: 'c3', lanePositionMs: 30000, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip1, clip2, clip3]);
      const timeline = makeTimeline([lane]);

      const preloads = controller.getClipsToPreload(timeline, 3000, 10000);

      expect(preloads.length).toBe(1);
      expect(preloads[0].id).toBe('c2');
    });

    it('returns empty array when no upcoming clips', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);
      const timeline = makeTimeline([lane]);

      const preloads = controller.getClipsToPreload(timeline, 10000);
      expect(preloads).toEqual([]);
    });
  });

  describe('getAllClipBoundaries', () => {
    it('returns sorted start/end boundaries', () => {
      const clip = makeClip({ lanePositionMs: 5000, durationMs: 10000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);
      const timeline = makeTimeline([lane]);

      const boundaries = controller.getAllClipBoundaries(timeline);

      expect(boundaries.length).toBe(2);
      expect(boundaries[0]).toMatchObject({ timeMs: 5000, type: 'start' });
      expect(boundaries[1]).toMatchObject({ timeMs: 15000, type: 'end' });
    });

    it('sorts boundaries across multiple lanes', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 10000, durationMs: 5000, cameraLane: 1 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 0, durationMs: 8000, cameraLane: 2 });
      const lane1 = makeLane(1, [clip1]);
      const lane2 = makeLane(2, [clip2]);
      const timeline = makeTimeline([lane1, lane2]);

      const boundaries = controller.getAllClipBoundaries(timeline);

      expect(boundaries.length).toBe(4);
      expect(boundaries[0].timeMs).toBe(0);
      expect(boundaries[1].timeMs).toBe(8000);
      expect(boundaries[2].timeMs).toBe(10000);
      expect(boundaries[3].timeMs).toBe(15000);
    });
  });

  describe('getResumeTime', () => {
    it('returns next clip start after gap', () => {
      const clip = makeClip({ lanePositionMs: 10000, durationMs: 5000 });
      const lane = makeLane(1, [clip]);

      expect(controller.getResumeTime(lane, 5000)).toBe(10000);
    });

    it('returns null when no next clip', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 5000 });
      const lane = makeLane(1, [clip]);

      expect(controller.getResumeTime(lane, 10000)).toBeNull();
    });
  });
});
