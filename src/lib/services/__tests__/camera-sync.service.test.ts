import { describe, it, expect } from 'vitest';
import { CameraSyncService } from '@/lib/services/camera-sync.service';
import { makeClip, makeLane } from './helpers/test-fixtures';

describe('CameraSyncService', () => {
  describe('gameTimeToVideoTime', () => {
    it('converts game time to video time when clip is at position 0', () => {
      const clip = makeClip({ lanePositionMs: 0, startOffsetMs: 0 });
      expect(CameraSyncService.gameTimeToVideoTime(7000, clip)).toBe(7);
    });

    it('converts game time accounting for clip lane position', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 0 });
      // 7000 - 5000 = 2000ms = 2 seconds
      expect(CameraSyncService.gameTimeToVideoTime(7000, clip)).toBe(2);
    });

    it('accounts for startOffsetMs (trimmed clip)', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 3000 });
      // (7000 - 5000) + 3000 = 5000ms = 5 seconds
      expect(CameraSyncService.gameTimeToVideoTime(7000, clip)).toBe(5);
    });

    it('clamps to 0 when game time is before clip position', () => {
      const clip = makeClip({ lanePositionMs: 10000, startOffsetMs: 0 });
      expect(CameraSyncService.gameTimeToVideoTime(5000, clip)).toBe(0);
    });

    it('returns 0 for game time exactly at clip position with no offset', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 0 });
      expect(CameraSyncService.gameTimeToVideoTime(5000, clip)).toBe(0);
    });
  });

  describe('videoTimeToGameTime', () => {
    it('converts video time to game time when clip is at position 0', () => {
      const clip = makeClip({ lanePositionMs: 0, startOffsetMs: 0 });
      expect(CameraSyncService.videoTimeToGameTime(7, clip)).toBe(7000);
    });

    it('accounts for clip lane position', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 0 });
      // (2 * 1000) - 0 + 5000 = 7000
      expect(CameraSyncService.videoTimeToGameTime(2, clip)).toBe(7000);
    });

    it('accounts for startOffsetMs', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 3000 });
      // (5 * 1000) - 3000 + 5000 = 7000
      expect(CameraSyncService.videoTimeToGameTime(5, clip)).toBe(7000);
    });

    it('round-trips with gameTimeToVideoTime', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 2000 });
      const gameTime = 10000;
      const videoTime = CameraSyncService.gameTimeToVideoTime(gameTime, clip);
      expect(CameraSyncService.videoTimeToGameTime(videoTime, clip)).toBe(gameTime);
    });
  });

  describe('gameTimeToVideoTimeLegacy', () => {
    it('converts with positive offset', () => {
      // (10000 - 5000) / 1000 = 5 seconds
      expect(CameraSyncService.gameTimeToVideoTimeLegacy(10000, 5)).toBe(5);
    });

    it('clamps to 0 with negative result', () => {
      expect(CameraSyncService.gameTimeToVideoTimeLegacy(2000, 5)).toBe(0);
    });

    it('returns same time with zero offset', () => {
      expect(CameraSyncService.gameTimeToVideoTimeLegacy(5000, 0)).toBe(5);
    });
  });

  describe('videoTimeToGameTimeLegacy', () => {
    it('converts with positive offset', () => {
      // (5 * 1000) + (5 * 1000) = 10000
      expect(CameraSyncService.videoTimeToGameTimeLegacy(5, 5)).toBe(10000);
    });

    it('returns same time with zero offset', () => {
      expect(CameraSyncService.videoTimeToGameTimeLegacy(5, 0)).toBe(5000);
    });

    it('round-trips with gameTimeToVideoTimeLegacy', () => {
      const gameTime = 10000;
      const offset = 3;
      const videoTime = CameraSyncService.gameTimeToVideoTimeLegacy(gameTime, offset);
      expect(CameraSyncService.videoTimeToGameTimeLegacy(videoTime, offset)).toBe(gameTime);
    });
  });

  describe('findClipForTime', () => {
    it('finds clip on preferred lane', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 60000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      const result = CameraSyncService.findClipForTime([lane], 30000, 1);

      expect(result.clip).toBe(clip);
      expect(result.isInGap).toBe(false);
      expect(result.videoId).toBe(clip.videoId);
      expect(result.laneNumber).toBe(1);
      expect(result.seekTimeSeconds).toBe(30); // 30000ms = 30s
    });

    it('returns gap info when preferred lane has no coverage', () => {
      const clip = makeClip({ lanePositionMs: 10000, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      const result = CameraSyncService.findClipForTime([lane], 5000, 1);

      expect(result.clip).toBeNull();
      expect(result.isInGap).toBe(true);
      expect(result.nextCoverageStartMs).toBe(10000);
      expect(result.laneNumber).toBe(1);
    });

    it('falls back to another lane when preferred has no coverage and no preferred specified', () => {
      const clip2 = makeClip({ id: 'c2', videoId: 'v2', lanePositionMs: 0, durationMs: 60000, cameraLane: 2 });
      const lane1 = makeLane(1, []);
      const lane2 = makeLane(2, [clip2]);

      const result = CameraSyncService.findClipForTime([lane1, lane2], 30000);

      expect(result.clip).toBe(clip2);
      expect(result.isInGap).toBe(false);
      expect(result.laneNumber).toBe(2);
    });

    it('returns global gap when no lane has coverage', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 50000, durationMs: 5000, cameraLane: 1 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 40000, durationMs: 5000, cameraLane: 2 });
      const lane1 = makeLane(1, [clip1]);
      const lane2 = makeLane(2, [clip2]);

      const result = CameraSyncService.findClipForTime([lane1, lane2], 10000);

      expect(result.clip).toBeNull();
      expect(result.isInGap).toBe(true);
      expect(result.nextCoverageStartMs).toBe(40000);
      expect(result.laneNumber).toBeNull();
    });

    it('returns null nextCoverageStartMs when no future clips', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      const result = CameraSyncService.findClipForTime([lane], 10000);

      expect(result.isInGap).toBe(true);
      expect(result.nextCoverageStartMs).toBeNull();
    });

    it('handles empty lanes array', () => {
      const result = CameraSyncService.findClipForTime([], 5000);

      expect(result.clip).toBeNull();
      expect(result.isInGap).toBe(true);
      expect(result.nextCoverageStartMs).toBeNull();
    });
  });

  describe('findNextCoverageStart', () => {
    it('finds earliest future clip start', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 20000, cameraLane: 1 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 15000, cameraLane: 2 });
      const lane1 = makeLane(1, [clip1]);
      const lane2 = makeLane(2, [clip2]);

      expect(CameraSyncService.findNextCoverageStart([lane1, lane2], 10000)).toBe(15000);
    });

    it('returns null when no future clips', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.findNextCoverageStart([lane], 10000)).toBeNull();
    });

    it('ignores clips at or before the given time', () => {
      const clip = makeClip({ lanePositionMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.findNextCoverageStart([lane], 5000)).toBeNull();
    });
  });

  describe('isVideoActiveAtTime', () => {
    it('returns true when video covers the time', () => {
      const clip = makeClip({ videoId: 'v1', lanePositionMs: 0, durationMs: 60000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.isVideoActiveAtTime([lane], 'v1', 30000)).toBe(true);
    });

    it('returns false when video exists but not at this time', () => {
      const clip = makeClip({ videoId: 'v1', lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.isVideoActiveAtTime([lane], 'v1', 10000)).toBe(false);
    });

    it('returns false when video not on any lane', () => {
      const clip = makeClip({ videoId: 'v1', cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.isVideoActiveAtTime([lane], 'v-unknown', 5000)).toBe(false);
    });
  });

  describe('getClipForVideo', () => {
    it('returns clip when video found and covers time', () => {
      const clip = makeClip({ videoId: 'v1', lanePositionMs: 0, durationMs: 60000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.getClipForVideo([lane], 'v1', 30000)).toBe(clip);
    });

    it('returns null when video not found', () => {
      const clip = makeClip({ videoId: 'v1', cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.getClipForVideo([lane], 'v-unknown', 30000)).toBeNull();
    });

    it('returns null when video found but not covering time', () => {
      const clip = makeClip({ videoId: 'v1', lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.getClipForVideo([lane], 'v1', 10000)).toBeNull();
    });
  });

  describe('getVideoOffset', () => {
    it('returns lane position when no startOffset', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 0 });
      expect(CameraSyncService.getVideoOffset(clip)).toBe(5000);
    });

    it('subtracts startOffset from lane position', () => {
      const clip = makeClip({ lanePositionMs: 5000, startOffsetMs: 2000 });
      expect(CameraSyncService.getVideoOffset(clip)).toBe(3000);
    });
  });

  describe('getClipEndTime', () => {
    it('returns lane position plus duration', () => {
      const clip = makeClip({ lanePositionMs: 5000, durationMs: 10000 });
      expect(CameraSyncService.getClipEndTime(clip)).toBe(15000);
    });
  });

  describe('findNextClipOnLane', () => {
    it('finds the next clip after current one ends', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 10000, durationMs: 5000, cameraLane: 1 });
      const clip3 = makeClip({ id: 'c3', lanePositionMs: 20000, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip1, clip2, clip3]);

      expect(CameraSyncService.findNextClipOnLane([lane], clip1)).toBe(clip2);
    });

    it('returns null when no next clip', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 5000, cameraLane: 1 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.findNextClipOnLane([lane], clip)).toBeNull();
    });

    it('returns null when lane not found', () => {
      const clip = makeClip({ cameraLane: 3 });
      const lane = makeLane(1, []);

      expect(CameraSyncService.findNextClipOnLane([lane], clip)).toBeNull();
    });
  });

  describe('calculateTimelineDuration', () => {
    it('calculates from single lane single clip', () => {
      const clip = makeClip({ lanePositionMs: 0, durationMs: 60000 });
      const lane = makeLane(1, [clip]);

      expect(CameraSyncService.calculateTimelineDuration([lane])).toBe(60000);
    });

    it('returns max end across multiple lanes', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 30000, cameraLane: 1 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 10000, durationMs: 50000, cameraLane: 2 });
      const lane1 = makeLane(1, [clip1]);
      const lane2 = makeLane(2, [clip2]);

      expect(CameraSyncService.calculateTimelineDuration([lane1, lane2])).toBe(60000);
    });

    it('returns 0 for empty lanes', () => {
      expect(CameraSyncService.calculateTimelineDuration([])).toBe(0);
    });

    it('returns 0 for lanes with no clips', () => {
      const lane = makeLane(1, []);
      expect(CameraSyncService.calculateTimelineDuration([lane])).toBe(0);
    });

    it('handles clips with gaps', () => {
      const clip1 = makeClip({ id: 'c1', lanePositionMs: 0, durationMs: 5000 });
      const clip2 = makeClip({ id: 'c2', lanePositionMs: 20000, durationMs: 5000 });
      const lane = makeLane(1, [clip1, clip2]);

      expect(CameraSyncService.calculateTimelineDuration([lane])).toBe(25000);
    });
  });
});
