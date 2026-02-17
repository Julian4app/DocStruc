-- =====================================================
-- VISIBILITY HELPER FUNCTIONS
-- Shared logic for checking content visibility
-- =====================================================

-- Drop existing function if it exists (with CASCADE to drop dependent policies)
DROP FUNCTION IF EXISTS can_user_see_content(UUID, UUID, TEXT, UUID, UUID) CASCADE;

-- Function to check if a user can see specific content based on visibility rules
CREATE FUNCTION can_user_see_content(
  p_user_id UUID,
  p_project_id UUID,
  p_module_key TEXT,
  p_content_id UUID,
  p_creator_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_visibility TEXT;
  v_user_team_id UUID;
  v_is_creator BOOLEAN;
BEGIN
  -- Get the effective visibility for this content
  SELECT COALESCE(
    (
      SELECT visibility 
      FROM content_visibility_overrides 
      WHERE module_key = p_module_key 
      AND content_id = p_content_id
    ),
    (
      SELECT default_visibility 
      FROM project_content_defaults 
      WHERE project_id = p_project_id 
      AND module_key = p_module_key
    ),
    'all_participants'  -- Default if neither is set
  ) INTO v_visibility;

  -- If all_participants, everyone can see it
  IF v_visibility = 'all_participants' THEN
    RETURN true;
  END IF;

  -- If owner_only, only project owner can see (already checked in RLS policy)
  IF v_visibility = 'owner_only' THEN
    RETURN false;
  END IF;

  -- For team_only, check team membership
  IF v_visibility = 'team_only' THEN
    -- Get user's team (prefer member_team_id from project_members, fallback to profile team_id)
    SELECT COALESCE(
      (SELECT member_team_id FROM project_members WHERE project_id = p_project_id AND user_id = p_user_id),
      (SELECT team_id FROM profiles WHERE id = p_user_id)
    ) INTO v_user_team_id;

    -- User must have a team and it must match creator's team
    IF v_user_team_id IS NOT NULL AND v_user_team_id = p_creator_team_id THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  -- Unknown visibility level - default to false for security
  RETURN false;
END;
$$;

COMMENT ON FUNCTION can_user_see_content IS 
'Checks if a user can see specific content based on visibility overrides and defaults. Used by RLS policies.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION can_user_see_content TO authenticated;
