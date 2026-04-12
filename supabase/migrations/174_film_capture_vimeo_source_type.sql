-- Migration 174: Add 'film_capture' to external_video_shares source_type
-- Enables Vimeo export from the film capture feature.

-- Drop existing constraint
ALTER TABLE external_video_shares
DROP CONSTRAINT IF EXISTS external_video_shares_source_type_check;

-- Re-add with film_capture included
ALTER TABLE external_video_shares
ADD CONSTRAINT external_video_shares_source_type_check
CHECK (source_type IN ('shared_video', 'film_session', 'highlight_reel', 'film_capture'));

COMMENT ON CONSTRAINT external_video_shares_source_type_check ON external_video_shares IS 'Allowed source types for external video shares including film capture';
