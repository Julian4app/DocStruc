-- Add missing columns to profiles table for Profile page
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Note: We are NOT adding address fields as per user request
-- (address, city, postal_code, country are not needed)

-- Ensure RLS policies allow insert for new users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile" 
    ON public.profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Create feedback table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  rating integer check (rating >= 1 and rating <= 5),
  category text not null,
  message text not null,
  email text,
  created_at timestamptz default now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own feedback
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'feedback' 
    AND policyname = 'Users can insert feedback'
  ) THEN
    CREATE POLICY "Users can insert feedback" 
    ON public.feedback
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Allow users to view their own feedback
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'feedback' 
    AND policyname = 'Users can view their own feedback'
  ) THEN
    CREATE POLICY "Users can view their own feedback" 
    ON public.feedback
    FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create user_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null unique,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_settings' 
    AND policyname = 'Users can manage their own settings'
  ) THEN
    CREATE POLICY "Users can manage their own settings" 
    ON public.user_settings
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
