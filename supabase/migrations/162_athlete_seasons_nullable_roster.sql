-- Migration 162: Make roster_id nullable on athlete_seasons
-- Allows athlete profiles to exist without a roster link.
-- The roster link is added when the parent enters a join code or coach invites them.

ALTER TABLE athlete_seasons ALTER COLUMN roster_id DROP NOT NULL;
