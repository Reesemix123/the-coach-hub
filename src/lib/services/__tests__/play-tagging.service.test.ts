import './helpers/supabase-mock';
import { describe, it, expect } from 'vitest';
import { PlayTaggingService } from '@/lib/services/play-tagging.service';

const service = new PlayTaggingService();
const cleanData = (service as any).cleanData.bind(service);
const formatError = (service as any).formatError.bind(service);

describe('PlayTaggingService', () => {
  describe('cleanData', () => {
    it('converts empty strings to null', () => {
      const result = cleanData({ name: '', value: 'test' });
      expect(result.name).toBeNull();
      expect(result.value).toBe('test');
    });

    it('converts undefined values to null', () => {
      const result = cleanData({ name: undefined, value: 'test' });
      expect(result.name).toBeNull();
    });

    it('preserves valid strings', () => {
      const result = cleanData({ name: 'hello' });
      expect(result.name).toBe('hello');
    });

    it('preserves numbers, booleans, and arrays', () => {
      const result = cleanData({
        count: 0,
        flag: false,
        tags: ['a', 'b'],
        nullNum: null,
      });
      expect(result.count).toBe(0);
      expect(result.flag).toBe(false);
      expect(result.tags).toEqual(['a', 'b']);
      expect(result.nullNum).toBeNull();
    });

    it('handles mixed object with multiple empty/undefined values', () => {
      const result = cleanData({
        play_code: 'P-001',
        formation: '',
        notes: undefined,
        yards_gained: 5,
        is_turnover: false,
      });
      expect(result).toEqual({
        play_code: 'P-001',
        formation: null,
        notes: null,
        yards_gained: 5,
        is_turnover: false,
      });
    });
  });

  describe('formatError', () => {
    it('returns friendly message for duplicate key violation (23505)', () => {
      expect(formatError({ message: 'duplicate key', code: '23505' }))
        .toBe('A play with this timestamp already exists.');
    });

    it('returns friendly message for foreign key violation (23503)', () => {
      expect(formatError({ message: 'foreign key', code: '23503' }))
        .toBe('Invalid reference (video, team, or player not found).');
    });

    it('returns friendly message for check constraint violation (23514)', () => {
      expect(formatError({ message: 'check constraint', code: '23514' }))
        .toBe('Invalid data format. Please check your entries.');
    });

    it('returns error message for unknown codes', () => {
      expect(formatError({ message: 'Something went wrong', code: '99999' }))
        .toBe('Something went wrong');
    });

    it('returns fallback when message is empty', () => {
      expect(formatError({ message: '' }))
        .toBe('An unexpected error occurred.');
    });
  });
});
