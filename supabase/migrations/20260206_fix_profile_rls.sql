-- Enable RLS on profiles if not already enabled
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
ON "public"."profiles"
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON "public"."profiles"
FOR UPDATE
USING (auth.uid() = id);

-- Allow users to view their own profile (and maybe others if needed)
CREATE POLICY "Users can view own profile"
ON "public"."profiles"
FOR SELECT
USING (auth.uid() = id);

-- Allow admins (optional, if you have a role system) or public reading of profiles is often useful
CREATE POLICY "Public profiles are visible"
ON "public"."profiles"
FOR SELECT
USING (true);
