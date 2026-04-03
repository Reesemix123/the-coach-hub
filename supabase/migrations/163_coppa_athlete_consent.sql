-- Migration 163: Add 'athlete_profile_creation' to parent_consent_log consent_type
-- Allows COPPA consent to be recorded when a parent creates an athlete profile
-- for a child under 13 (inferred from graduation year)

ALTER TABLE parent_consent_log
DROP CONSTRAINT IF EXISTS parent_consent_log_consent_type_check;

ALTER TABLE parent_consent_log
ADD CONSTRAINT parent_consent_log_consent_type_check
CHECK (consent_type IN ('account_creation', 'video_sharing', 'data_usage', 'sms_consent', 'athlete_profile_creation'));
