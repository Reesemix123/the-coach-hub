import './helpers/supabase-mock';
import { describe, it, expect } from 'vitest';
import { FilmSessionService } from '@/lib/services/film-session.service';

const service = new FilmSessionService();
const formatTimestamp = (service as any).formatTimestamp.bind(service);

describe('FilmSessionService', () => {
  describe('formatTimestamp', () => {
    it('formats 0ms as 0:00', () => {
      expect(formatTimestamp(0)).toBe('0:00');
    });

    it('formats seconds only', () => {
      expect(formatTimestamp(5000)).toBe('0:05');
    });

    it('formats minutes and seconds', () => {
      expect(formatTimestamp(65000)).toBe('1:05');
    });

    it('formats hours, minutes, seconds', () => {
      expect(formatTimestamp(3661000)).toBe('1:01:01');
    });

    it('formats 2 hours exactly', () => {
      expect(formatTimestamp(7200000)).toBe('2:00:00');
    });
  });
});
