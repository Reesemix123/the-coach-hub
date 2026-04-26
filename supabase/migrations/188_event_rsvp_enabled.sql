-- ============================================================================
-- Migration 188: Add rsvp_enabled toggle to team_events
-- ============================================================================

ALTER TABLE team_events
  ADD COLUMN IF NOT EXISTS rsvp_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN team_events.rsvp_enabled IS 'Whether parents can RSVP to this event. Default true.';
