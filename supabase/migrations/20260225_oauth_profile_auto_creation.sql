-- ============================================================
-- Migration: OAuth profile auto-creation
-- When a new user signs up via Google / Apple OAuth, Supabase
-- creates a row in auth.users but NOT in public.profiles.
-- This trigger creates the profile row automatically, using
-- the metadata that Google/Apple provide (given_name, family_name,
-- full_name, avatar_url, picture, email).
-- ============================================================

-- Function called by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name  TEXT;
  v_last_name   TEXT;
  v_avatar_url  TEXT;
  v_email       TEXT;
BEGIN
  -- Derive first name: Google uses "given_name", Apple uses "first_name",
  -- fallback: split the "full_name" or "name" field, or use the email prefix.
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'given_name',
    NEW.raw_user_meta_data->>'first_name',
    CASE
      WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL
        THEN split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1)
      WHEN NEW.raw_user_meta_data->>'name' IS NOT NULL
        THEN split_part(NEW.raw_user_meta_data->>'name', ' ', 1)
      ELSE split_part(COALESCE(NEW.email, ''), '@', 1)
    END
  );

  -- Derive last name: Google "family_name", Apple "last_name",
  -- fallback: everything after the first space in full_name/name.
  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'family_name',
    NEW.raw_user_meta_data->>'last_name',
    CASE
      WHEN NEW.raw_user_meta_data->>'full_name' IS NOT NULL
           AND position(' ' IN NEW.raw_user_meta_data->>'full_name') > 0
        THEN substring(NEW.raw_user_meta_data->>'full_name'
                       FROM position(' ' IN NEW.raw_user_meta_data->>'full_name') + 1)
      WHEN NEW.raw_user_meta_data->>'name' IS NOT NULL
           AND position(' ' IN NEW.raw_user_meta_data->>'name') > 0
        THEN substring(NEW.raw_user_meta_data->>'name'
                       FROM position(' ' IN NEW.raw_user_meta_data->>'name') + 1)
      ELSE ''
    END
  );

  -- Avatar URL: Google uses "picture" or "avatar_url"
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Email
  v_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');

  -- Upsert the profile row.
  -- ON CONFLICT DO NOTHING means email-signup users who already have a profile
  -- (created explicitly in application code) are left untouched.
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    avatar_url,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_email,
    v_first_name,
    v_last_name,
    v_avatar_url,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop old trigger if it already exists (idempotent re-run safety)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger: fires AFTER every INSERT on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;
