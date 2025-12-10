-- Migration: 089_cascade_delete_profiles.sql
-- Ensures profiles are automatically deleted when auth.users are deleted
-- Prevents orphaned profile records

-- Drop existing constraint if it exists
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Add foreign key with CASCADE DELETE
ALTER TABLE profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Also clean up any existing orphaned profiles (profiles without matching auth.users)
DELETE FROM profiles
WHERE id NOT IN (SELECT id FROM auth.users);
