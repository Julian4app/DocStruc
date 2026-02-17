-- Fix superuser UPDATE policy to avoid infinite recursion
-- This allows superusers to assign team admins

-- Drop the existing recursive policy
DROP POLICY IF EXISTS "Superusers can update any profile" ON public.profiles;

-- Create non-recursive policy using a simple approach
-- We allow authenticated users to UPDATE profiles, but add a WITH CHECK
-- that prevents abuse. The actual authorization happens at the app level.
CREATE POLICY "Superusers can update any profile" ON public.profiles
    FOR UPDATE
    USING (
        -- Allow if updating own profile
        auth.uid() = id
        OR
        -- Allow if current user's is_superuser field is true
        -- Use auth.role() to avoid recursion
        auth.role() = 'authenticated'
    )
    WITH CHECK (
        -- Same conditions for WITH CHECK
        auth.uid() = id
        OR
        auth.role() = 'authenticated'
    );

-- Note: We're opening this up but the app code in Accessors.tsx
-- already checks if the user is a superuser before allowing team admin assignment.
-- The RLS just needs to not block the UPDATE operation.

-- Alternative: Use a function that caches the superuser status
-- This is the better approach long-term
CREATE OR REPLACE FUNCTION public.is_current_user_superuser()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_superuser FROM public.profiles WHERE id = auth.uid() LIMIT 1),
        false
    );
$$;

-- Now use this function in the policy (recreate)
DROP POLICY IF EXISTS "Superusers can update any profile" ON public.profiles;

CREATE POLICY "Superusers can update any profile" ON public.profiles
    FOR UPDATE
    USING (
        auth.uid() = id
        OR
        public.is_current_user_superuser()
    );

COMMENT ON POLICY "Superusers can update any profile" ON public.profiles IS 
'Allows superusers to update any profile (e.g., to assign team admins). Uses a security definer function to avoid infinite recursion.';
