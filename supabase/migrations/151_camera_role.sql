-- Migration 151: Camera Role Designation
-- ============================================================================
-- PURPOSE:
--   Add camera_role to the videos table so the system knows what each camera
--   is pointed at. Required for future Gemini OCR phase to identify the
--   scoreboard camera automatically.
--
-- SAFE TO RUN: Additive only, uses IF NOT EXISTS guards.
-- ============================================================================

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS camera_role VARCHAR(20) DEFAULT 'sideline';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'videos_camera_role_check'
  ) THEN
    ALTER TABLE videos
    ADD CONSTRAINT videos_camera_role_check
    CHECK (camera_role IN ('sideline', 'end_zone', 'press_box', 'scoreboard', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN videos.camera_role IS 'Semantic role of this camera angle: sideline, end_zone, press_box, scoreboard, other. Used by Gemini OCR to identify the scoreboard camera.';
