-- Fix profile creation trigger to ensure it works reliably
-- The existing trigger may be failing silently due to RLS or permission issues

-- First, ensure the profiles table has the created_at column (may be missing)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles with ON CONFLICT to handle any race conditions
  INSERT INTO public.profiles (id, email, full_name, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error details to help debug
    RAISE LOG 'Failed to create profile for user % (email: %): % - %',
      NEW.id, NEW.email, SQLSTATE, SQLERRM;
    -- Still return NEW so the auth.users insert succeeds
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add a policy to allow the trigger function to insert profiles
-- The trigger runs with SECURITY DEFINER, but we need INSERT permission
DROP POLICY IF EXISTS "Trigger can insert profiles" ON public.profiles;
CREATE POLICY "Trigger can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Also ensure update policy exists for the ON CONFLICT clause
DROP POLICY IF EXISTS "Trigger can update profiles" ON public.profiles;
CREATE POLICY "Trigger can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Backfill any missing profiles from auth.users
-- This will catch any users that were created but didn't get profiles
INSERT INTO public.profiles (id, email, full_name, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.handle_new_user() IS
  'Auto-creates profile record when new user signs up. Uses SECURITY DEFINER and ON CONFLICT to ensure reliability.';
