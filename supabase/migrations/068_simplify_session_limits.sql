-- Migration 068: Simplify Session Limits
-- Purpose: Set device limit to 3 for all users regardless of tier
-- Date: 2024-12-03

-- Update session limits config to use 3 devices for everyone
UPDATE platform_config
SET value = '{
  "default_limit": 3,
  "tier_limits": {
    "free": 3,
    "basic": 3,
    "plus": 3,
    "premium": 3,
    "ai_powered": 3,
    "little_league": 3,
    "hs_basic": 3,
    "hs_advanced": 3
  },
  "session_timeout_hours": 720,
  "enforce_limits": true
}',
description = 'Device/session limits per user. All users get 3 devices. session_timeout_hours is how long inactive sessions remain valid.',
updated_at = NOW()
WHERE key = 'session_limits';
