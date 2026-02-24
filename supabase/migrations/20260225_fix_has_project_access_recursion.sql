-- ============================================================
-- CRITICAL FIX: has_project_access() infinite recursion
-- ============================================================
-- Root cause: has_project_access() queries the 'projects' table.
-- That table has a SELECT RLS policy that calls has_project_access().
-- => infinite recursion (PostgreSQL error 42P17).
--
-- Fix: add `SET row_security = off` to the function so the
-- internal `projects` query bypasses RLS and breaks the loop.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off        -- ← bypass RLS inside this function
AS $$
BEGIN
  -- Owner check: directly queries projects without triggering RLS
  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_id AND owner_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Member check: query project_members (no circular dependency)
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Team access check: check if user's team has access to this project
  IF EXISTS (
    SELECT 1
    FROM public.team_project_access tpa
    JOIN public.profiles pr ON pr.team_id = tpa.team_id
    WHERE tpa.project_id = p_id
      AND pr.id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Grant execute to authenticated users (needed for RLS policies)
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO anon;


-- ============================================================
-- Also fix get_my_project_ids() for the same reason
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off        -- ← bypass RLS inside this function
AS $$
  SELECT id FROM public.projects WHERE owner_id = auth.uid()
  UNION
  SELECT project_id FROM public.project_members
    WHERE user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  UNION
  SELECT tpa.project_id
  FROM public.team_project_access tpa
  JOIN public.profiles pr ON pr.team_id = tpa.team_id
  WHERE pr.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_project_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_project_ids() TO anon;


-- ============================================================
-- Also fix check_user_permission() – it queries projects internally
-- and needs the same SET row_security = off treatment
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_user_permission(
    p_user_id         UUID,
    p_project_id      UUID,
    p_module_key      TEXT,
    p_permission_type TEXT  -- 'view' | 'create' | 'edit' | 'delete'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off        -- ← bypass RLS inside this function
AS $$
DECLARE
    user_is_owner     BOOLEAN;
    user_is_superuser BOOLEAN;
    member_record     RECORD;
    role_perm         RECORD;
    member_perm       RECORD;
BEGIN
    -- Owner check (direct query, row_security=off prevents recursion)
    SELECT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;

    SELECT COALESCE(p.is_superuser, FALSE) INTO user_is_superuser
    FROM public.profiles p WHERE p.id = p_user_id;

    IF user_is_owner OR COALESCE(user_is_superuser, FALSE) THEN
        RETURN TRUE;
    END IF;

    -- Get member record
    SELECT * INTO member_record
    FROM public.project_members pmr
    WHERE pmr.project_id = p_project_id
      AND pmr.user_id    = p_user_id
      AND pmr.status IN ('open', 'active', 'invited');

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Per-member override takes priority
    SELECT * INTO member_perm
    FROM public.project_member_permissions pmp
    WHERE pmp.project_member_id = member_record.id
      AND pmp.module_key        = p_module_key;

    IF FOUND THEN
        CASE p_permission_type
            WHEN 'view'   THEN RETURN COALESCE(member_perm.can_view,   FALSE);
            WHEN 'create' THEN RETURN COALESCE(member_perm.can_create, FALSE);
            WHEN 'edit'   THEN RETURN COALESCE(member_perm.can_edit,   FALSE);
            WHEN 'delete' THEN RETURN COALESCE(member_perm.can_delete, FALSE);
            ELSE RETURN FALSE;
        END CASE;
    END IF;

    -- No role assigned → open access for 'view', no write access
    IF member_record.role_id IS NULL THEN
        RETURN CASE p_permission_type WHEN 'view' THEN TRUE ELSE FALSE END;
    END IF;

    -- Role assigned → check role_permissions explicitly
    SELECT * INTO role_perm
    FROM public.role_permissions rp
    WHERE rp.role_id    = member_record.role_id
      AND rp.module_key = p_module_key;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    CASE p_permission_type
        WHEN 'view'   THEN RETURN COALESCE(role_perm.can_view,   FALSE);
        WHEN 'create' THEN RETURN COALESCE(role_perm.can_create, FALSE);
        WHEN 'edit'   THEN RETURN COALESCE(role_perm.can_edit,   FALSE);
        WHEN 'delete' THEN RETURN COALESCE(role_perm.can_delete, FALSE);
        ELSE RETURN FALSE;
    END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_permission(UUID, UUID, TEXT, TEXT) TO authenticated;
