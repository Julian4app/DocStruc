-- =====================================================
-- FIX: Registration & Extended Profile Fields
-- Date: 2026-02-18
-- Purpose:
--   1. Add phone and position columns to profiles
--   2. Update handle_new_user() trigger to read all metadata
--   3. Ensure registration works with current schema
-- =====================================================

-- 1. Add missing columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS position TEXT;

-- 2. Recreate the handle_new_user trigger function
-- This replaces the original which only inserted id, email, first_name, last_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, company_name, phone, position)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'position'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    company_name = COALESCE(EXCLUDED.company_name, profiles.company_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    position = COALESCE(EXCLUDED.position, profiles.position),
    updated_at = now();
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block auth signup
  RAISE LOG 'handle_new_user error for %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Ensure there is an INSERT policy for profiles (in case trigger ever loses SECURITY DEFINER context)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
