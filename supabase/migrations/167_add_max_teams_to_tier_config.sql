-- Migration 167: Add max_teams column to tier_config
-- Limits how many teams a user can create based on their highest active paid subscription tier.
-- A user with no paid subscription defaults to 'basic' (1 team).

ALTER TABLE tier_config ADD COLUMN max_teams INTEGER NOT NULL DEFAULT 1;

UPDATE tier_config SET max_teams = 1 WHERE tier_key = 'basic';
UPDATE tier_config SET max_teams = 2 WHERE tier_key = 'plus';
UPDATE tier_config SET max_teams = 5 WHERE tier_key = 'premium';

ALTER TABLE tier_config ADD CONSTRAINT valid_max_teams CHECK (max_teams > 0);

COMMENT ON COLUMN tier_config.max_teams IS 'Maximum teams a user on this tier can own. Determined by their highest active paid subscription.';
