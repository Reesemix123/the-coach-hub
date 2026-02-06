import './helpers/supabase-mock';
import { describe, it, expect } from 'vitest';
import { AnalyticsService } from '@/lib/services/analytics.service';

const service = new AnalyticsService();
const isPlaySuccessful = (service as any).isPlaySuccessful.bind(service);

describe('AnalyticsService', () => {
  describe('isPlaySuccessful', () => {
    it('returns true when explicitly marked as first down', () => {
      expect(isPlaySuccessful(1, 10, 2, true)).toBe(true);
    });

    it('returns false when down/distance/yards are null', () => {
      expect(isPlaySuccessful(null, null, null, null)).toBe(false);
      expect(isPlaySuccessful(1, null, 5, null)).toBe(false);
      expect(isPlaySuccessful(1, 10, null, null)).toBe(false);
    });

    // 1st down: need 40% of distance
    it('1st-and-10: gain 4 yards (40%) = success', () => {
      expect(isPlaySuccessful(1, 10, 4, false)).toBe(true);
    });

    it('1st-and-10: gain 3 yards (30%) = failure', () => {
      expect(isPlaySuccessful(1, 10, 3, false)).toBe(false);
    });

    // 2nd down: need 60% of distance
    it('2nd-and-8: gain 5 yards (62.5%) = success', () => {
      expect(isPlaySuccessful(2, 8, 5, false)).toBe(true);
    });

    it('2nd-and-8: gain 4 yards (50%) = failure', () => {
      expect(isPlaySuccessful(2, 8, 4, false)).toBe(false);
    });

    // 3rd down: need 100% of distance
    it('3rd-and-5: gain 5 yards = success', () => {
      expect(isPlaySuccessful(3, 5, 5, false)).toBe(true);
    });

    it('3rd-and-5: gain 4 yards = failure', () => {
      expect(isPlaySuccessful(3, 5, 4, false)).toBe(false);
    });

    // 4th down: need 100% of distance
    it('4th-and-1: gain 1 yard = success', () => {
      expect(isPlaySuccessful(4, 1, 1, false)).toBe(true);
    });

    it('4th-and-1: gain 0 yards = failure', () => {
      expect(isPlaySuccessful(4, 1, 0, false)).toBe(false);
    });

    it('returns false for invalid down number', () => {
      expect(isPlaySuccessful(5, 10, 10, false)).toBe(false);
    });
  });
});
