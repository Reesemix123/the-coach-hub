-- Migration 058: Ensure profiles table has all expected columns
-- Some columns may not have been created if migration 018 wasn't fully applied

-- Add full_name if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add avatar_url if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add organization_id if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add is_platform_admin if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

-- Add last_active_at if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Create index on organization_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- Create index on is_platform_admin for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_platform_admin ON profiles(is_platform_admin) WHERE is_platform_admin = true;
