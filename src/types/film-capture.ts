/**
 * Film Capture Feature Types
 * Matches database schema from migration 172
 */

// TODO: MULTI-SPORT — Sport type will be shared across sport hubs when they're built
export interface Sport {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  status: 'active' | 'internal' | 'disabled';
  display_order: number;
  created_at: string;
}

export interface FilmCapture {
  id: string;
  sport_id: string;
  game_date: string;
  opponent: string | null;
  age_group: string | null;
  storage_path: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploader_id: string;
  uploader_role: 'coach' | 'parent';
  created_at: string;
  updated_at: string;
}

export interface FilmCaptureWithSport extends FilmCapture {
  sport_name: string;
  sport_icon: string | null;
  playback_url?: string | null;
  uploader_name?: string | null; // Admin only — populated from profiles
}

export const AGE_GROUPS = ['Youth', 'JV', 'Varsity', 'College'] as const;
export type AgeGroup = typeof AGE_GROUPS[number];

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-m4v',
  'video/mpeg',
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB
