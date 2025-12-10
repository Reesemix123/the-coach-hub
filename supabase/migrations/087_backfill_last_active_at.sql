-- Backfill last_active_at for existing profiles
-- Set it to updated_at as a reasonable approximation of last activity

UPDATE public.profiles
SET last_active_at = COALESCE(updated_at, NOW())
WHERE last_active_at IS NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.last_active_at IS 'Timestamp of last user activity, updated on login and API calls';
