-- Migration 152: SMS Consent for Twilio Toll-Free Verification
-- ============================================================================
-- PURPOSE:
--   Add explicit SMS consent tracking to parent_profiles for TCPA compliance.
--   Parents can join teams without consenting to SMS — consent is optional.
--   Required for Twilio toll-free verification (error 30513 rejection).
--
-- SAFE TO RUN: Additive only, uses IF NOT EXISTS guards.
-- ============================================================================

-- 1. Add SMS consent columns to parent_profiles
ALTER TABLE parent_profiles
ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE parent_profiles
ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ NULL;

ALTER TABLE parent_profiles
ADD COLUMN IF NOT EXISTS sms_consent_ip TEXT NULL;

COMMENT ON COLUMN parent_profiles.sms_consent IS 'Explicit opt-in for SMS notifications. Must be true before sending any SMS via Twilio.';
COMMENT ON COLUMN parent_profiles.sms_consent_at IS 'Timestamp when the parent explicitly consented to SMS. NULL if never consented.';
COMMENT ON COLUMN parent_profiles.sms_consent_ip IS 'IP address at the time of SMS consent for audit trail.';

-- 2. Add 'sms_consent' to parent_consent_log consent_type CHECK constraint
-- Drop the old constraint and recreate with the new value
ALTER TABLE parent_consent_log
DROP CONSTRAINT IF EXISTS parent_consent_log_consent_type_check;

ALTER TABLE parent_consent_log
ADD CONSTRAINT parent_consent_log_consent_type_check
CHECK (consent_type IN ('account_creation', 'video_sharing', 'data_usage', 'sms_consent'));
