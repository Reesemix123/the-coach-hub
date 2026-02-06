import { describe, it, expect } from 'vitest';
import {
  formatTimeMs,
  parseTimeToMs,
  snapToGrid,
  timeToPixels,
  pixelsToTime,
  findActiveClipForTime,
  findLaneForVideo,
  TIMELINE_CONSTANTS,
} from '@/types/timeline';
import { makeClip, makeLane } from '@/lib/services/__tests__/helpers/test-fixtures';

describe('formatTimeMs', () => {
  it('formats 0ms as 0:00', () => {
    expect(formatTimeMs(0)).toBe('0:00');
  });

  it('formats seconds only', () => {
    expect(formatTimeMs(5000)).toBe('0:05');
  });

  it('formats minutes and seconds', () => {
    expect(formatTimeMs(65000)).toBe('1:05');
  });

  it('pads seconds with leading zero', () => {
    expect(formatTimeMs(60000)).toBe('1:00');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatTimeMs(3661000)).toBe('1:01:01');
  });

  it('formats 2 hours exactly', () => {
    expect(formatTimeMs(7200000)).toBe('2:00:00');
  });

  it('pads minutes when hours present', () => {
    expect(formatTimeMs(3600000)).toBe('1:00:00');
  });
});

describe('parseTimeToMs', () => {
  it('parses mm:ss format', () => {
    expect(parseTimeToMs('1:05')).toBe(65000);
  });

  it('parses hh:mm:ss format', () => {
    expect(parseTimeToMs('1:01:01')).toBe(3661000);
  });

  it('parses 0:00', () => {
    expect(parseTimeToMs('0:00')).toBe(0);
  });

  it('returns 0 for invalid single-part string', () => {
    expect(parseTimeToMs('abc')).toBe(0);
  });

  it('round-trips with formatTimeMs for mm:ss', () => {
    const ms = 65000;
    expect(parseTimeToMs(formatTimeMs(ms))).toBe(ms);
  });

  it('round-trips with formatTimeMs for hh:mm:ss', () => {
    const ms = 3661000;
    expect(parseTimeToMs(formatTimeMs(ms))).toBe(ms);
  });
});

describe('snapToGrid', () => {
  it('snaps down when below midpoint', () => {
    expect(snapToGrid(1400, 1000)).toBe(1000);
  });

  it('snaps up when at midpoint', () => {
    expect(snapToGrid(1500, 1000)).toBe(2000);
  });

  it('snaps up when above midpoint', () => {
    expect(snapToGrid(1600, 1000)).toBe(2000);
  });

  it('exact grid value stays the same', () => {
    expect(snapToGrid(3000, 1000)).toBe(3000);
  });

  it('uses default grid (1000ms) when not specified', () => {
    expect(snapToGrid(1499)).toBe(1000);
    expect(snapToGrid(1500)).toBe(2000);
  });

  it('works with custom grid size', () => {
    expect(snapToGrid(250, 500)).toBe(500);
    expect(snapToGrid(200, 500)).toBe(0);
  });
});

describe('timeToPixels', () => {
  it('converts time to pixels at zoom level 1', () => {
    // 1 second * 0.25 pixels/second * zoom 1 = 0.25px
    expect(timeToPixels(1000, 1)).toBe(TIMELINE_CONSTANTS.PIXELS_PER_SECOND_BASE);
  });

  it('zoom level 2 doubles pixels', () => {
    const px1 = timeToPixels(1000, 1);
    const px2 = timeToPixels(1000, 2);
    expect(px2).toBe(px1 * 2);
  });

  it('0ms returns 0px', () => {
    expect(timeToPixels(0, 1)).toBe(0);
  });

  it('calculates correct pixels for 60min at zoom 1', () => {
    // 60 minutes = 3600 seconds * 0.25 = 900px
    expect(timeToPixels(3600000, 1)).toBe(900);
  });
});

describe('pixelsToTime', () => {
  it('converts pixels to time at zoom level 1', () => {
    expect(pixelsToTime(TIMELINE_CONSTANTS.PIXELS_PER_SECOND_BASE, 1)).toBe(1000);
  });

  it('round-trips with timeToPixels', () => {
    const originalMs = 5000;
    const zoom = 2;
    const px = timeToPixels(originalMs, zoom);
    expect(pixelsToTime(px, zoom)).toBeCloseTo(originalMs);
  });

  it('0px returns 0ms', () => {
    expect(pixelsToTime(0, 1)).toBe(0);
  });
});

describe('findActiveClipForTime', () => {
  it('returns clip when time is inside a clip', () => {
    const clip = makeClip({ lanePositionMs: 5000, durationMs: 10000 });
    const lane = makeLane(1, [clip]);

    const result = findActiveClipForTime([lane], 1, 7000);

    expect(result.clip).toBe(clip);
    expect(result.isInGap).toBe(false);
    expect(result.clipTimeMs).toBe(2000); // 7000 - 5000
    expect(result.nextClipStartMs).toBeNull();
  });

  it('returns gap info when time is between clips', () => {
    const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000 });
    const clip2 = makeClip({ id: 'c2', lanePositionMs: 10000, durationMs: 5000 });
    const lane = makeLane(1, [clip1, clip2]);

    const result = findActiveClipForTime([lane], 1, 7000);

    expect(result.clip).toBeNull();
    expect(result.isInGap).toBe(true);
    expect(result.nextClipStartMs).toBe(10000);
  });

  it('returns gap with null nextClipStartMs when after all clips', () => {
    const clip = makeClip({ lanePositionMs: 0, durationMs: 5000 });
    const lane = makeLane(1, [clip]);

    const result = findActiveClipForTime([lane], 1, 10000);

    expect(result.clip).toBeNull();
    expect(result.isInGap).toBe(true);
    expect(result.nextClipStartMs).toBeNull();
  });

  it('returns gap when lane has no clips', () => {
    const lane = makeLane(1, []);

    const result = findActiveClipForTime([lane], 1, 5000);

    expect(result.clip).toBeNull();
    expect(result.isInGap).toBe(true);
    expect(result.nextClipStartMs).toBeNull();
  });

  it('returns gap when lane number not found', () => {
    const clip = makeClip({ cameraLane: 1 });
    const lane = makeLane(1, [clip]);

    const result = findActiveClipForTime([lane], 2, 5000);

    expect(result.clip).toBeNull();
    expect(result.isInGap).toBe(true);
  });

  it('handles exact clip start boundary (inclusive)', () => {
    const clip = makeClip({ lanePositionMs: 5000, durationMs: 10000 });
    const lane = makeLane(1, [clip]);

    const result = findActiveClipForTime([lane], 1, 5000);

    expect(result.clip).toBe(clip);
    expect(result.isInGap).toBe(false);
  });

  it('handles exact clip end boundary (exclusive)', () => {
    const clip = makeClip({ lanePositionMs: 5000, durationMs: 10000 });
    const lane = makeLane(1, [clip]);

    const result = findActiveClipForTime([lane], 1, 15000); // end = 5000 + 10000

    expect(result.clip).toBeNull();
    expect(result.isInGap).toBe(true);
  });
});

describe('findLaneForVideo', () => {
  it('finds the lane containing the video', () => {
    const clip = makeClip({ videoId: 'video-abc', cameraLane: 2 });
    const lane1 = makeLane(1, []);
    const lane2 = makeLane(2, [clip]);

    expect(findLaneForVideo([lane1, lane2], 'video-abc')).toBe(2);
  });

  it('returns null when video not found', () => {
    const clip = makeClip({ videoId: 'video-abc' });
    const lane = makeLane(1, [clip]);

    expect(findLaneForVideo([lane], 'video-xyz')).toBeNull();
  });

  it('returns null for empty lanes', () => {
    expect(findLaneForVideo([], 'video-abc')).toBeNull();
  });
});
