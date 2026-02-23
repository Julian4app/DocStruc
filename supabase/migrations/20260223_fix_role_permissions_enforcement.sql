-- ============================================================================
-- FIX: Role-based permission enforcement
-- Date: 2026-02-23
-- ============================================================================
--
-- ROOT CAUSE:
-- The current COALESCE logic:
--   COALESCE(pmp.can_view, rp.can_view, TRUE)
-- ...always falls back to TRUE when:
--   (a) member has a role assigned, but that role has NO row in role_permissions
--       for a given module_key (= no explicit entry → NULL → COALESCE → TRUE)
--   (b) member has no role at all (role_id IS NULL, LEFT JOIN returns NULL)
--
-- This means:
--   • A member with role "Niet" (can_view=false for most modules) still sees
--     all modules that don't have an explicit role_permissions row.
--   • Roles only work if they have an explicit FALSE row — a missing row
--     is treated as "allowed", making deny-by-default impossible.
--
-- CORRECT LOGIC:
--   • Member has NO role (role_id IS NULL)
--       → default can_view = TRUE  (member sees everything, no restrictions)
--       → default can_create/edit/delete = FALSE
--   • Member HAS a role
--       → if the role has an explicit row for the module:  use that value
--       → if the role has NO row for the module:           default can_view = FALSE
--         (absence of an explicit grant = no access)
--   • Per-member override (pmp) always wins over the role value
--
-- This means roles are ADDITIVE/EXPLICIT GRANT lists.
-- "Niet" with only general_info=true → user sees ONLY general_info.
--
-- ADDITIONALLY:
-- Team admins currently bypass role checks and get full access.
-- They should respect the same role-based permission logic.
-- Only the project owner and superusers get unconditional full access.
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_project_permissions(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_user_project_permissions(
    p_user_id UUID,
    p_project_id UUID
)
RETURNS TABLE (
    module_key TEXT,
    can_view   BOOLEAN,
    can_create BOOLEAN,
    can_edit   BOOLEAN,
    can_delete BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    user_is_owner     BOOLEAN;
    user_is_superuser BOOLEAN;
    member_record     RECORD;
BEGIN
    -- ── 1. Project owner check ────────────────────────────────────────────
    SELECT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;

    -- ── 2. Superuser check ────────────────────────────────────────────────
    SELECT COALESCE(p.is_superuser, FALSE)
    INTO user_is_superuser
    FROM public.profiles p
    WHERE p.id = p_user_id;

    -- Owner and superuser → full access to all modules
    IF user_is_owner OR COALESCE(user_is_superuser, FALSE) THEN
        RETURN QUERY
        SELECT pm.module_key,
               TRUE::BOOLEAN,
               TRUE::BOOLEAN,
               TRUE::BOOLEAN,
               TRUE::BOOLEAN
        FROM public.permission_modules pm
        WHERE pm.is_active = true;
        RETURN;
    END IF;

    -- ── 3. Find project_members record ────────────────────────────────────
    -- Includes team admins — they follow role-based permissions just like
    -- regular members. Only owner/superuser get unconditional full access.
    SELECT * INTO member_record
    FROM public.project_members pmr
    WHERE pmr.project_id = p_project_id
      AND pmr.user_id    = p_user_id
      AND pmr.status IN ('open', 'active', 'invited');

    IF NOT FOUND THEN
        -- Not a member → no access
        RETURN QUERY
        SELECT pm.module_key,
               FALSE::BOOLEAN,
               FALSE::BOOLEAN,
               FALSE::BOOLEAN,
               FALSE::BOOLEAN
        FROM public.permission_modules pm
        WHERE pm.is_active = true;
        RETURN;
    END IF;

    -- ── 4. Apply permissions ──────────────────────────────────────────────
    --
    -- CASE A: Member has NO role assigned (role_id IS NULL)
    --   → All modules visible (can_view = TRUE), no write access by default.
    --   Per-member overrides still apply.
    --
    -- CASE B: Member HAS a role
    --   → Per-member override wins if present.
    --   → Otherwise: use the role's explicit can_view value for modules that
    --     have a row in role_permissions.
    --   → For modules with NO role_permissions row: default = FALSE.
    --     (Absence of an explicit grant = denied. Roles are allow-lists.)
    --
    -- The CASE expression differentiates A vs B:
    --   COALESCE(pmp.can_view, rp.can_view, <default>)
    --   where <default> = TRUE  when role_id IS NULL  (no role → open)
    --                   = FALSE when role_id NOT NULL (role → must grant explicitly)

    RETURN QUERY
    SELECT
        pm.module_key,
        COALESCE(
            pmp.can_view,
            rp.can_view,
            CASE WHEN member_record.role_id IS NULL THEN TRUE ELSE FALSE END
        )::BOOLEAN AS can_view,
        COALESCE(
            pmp.can_create,
            rp.can_create,
            FALSE
        )::BOOLEAN AS can_create,
        COALESCE(
            pmp.can_edit,
            rp.can_edit,
            FALSE
        )::BOOLEAN AS can_edit,
        COALESCE(
            pmp.can_delete,
            rp.can_delete,
            FALSE
        )::BOOLEAN AS can_delete
    FROM public.permission_modules pm
    LEFT JOIN public.role_permissions rp
           ON rp.role_id    = member_record.role_id
          AND rp.module_key = pm.module_key
    LEFT JOIN public.project_member_permissions pmp
           ON pmp.project_member_id = member_record.id
          AND pmp.module_key        = pm.module_key
    WHERE pm.is_active = true;
END;
$$;


-- ============================================================================
-- Also fix check_user_permission to use the same logic
-- ============================================================================

DROP FUNCTION IF EXISTS public.check_user_permission(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.check_user_permission(
    p_user_id       UUID,
    p_project_id    UUID,
    p_module_key    TEXT,
    p_permission_type TEXT  -- 'view' | 'create' | 'edit' | 'delete'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    user_is_owner     BOOLEAN;
    user_is_superuser BOOLEAN;
    member_record     RECORD;
    role_perm         RECORD;
    member_perm       RECORD;
    has_role          BOOLEAN;
    default_value     BOOLEAN;
    role_value        BOOLEAN;
    member_value      BOOLEAN;
BEGIN
    -- Owner check
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
        -- Role exists but has no entry for this module → denied
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


-- ============================================================================
-- Diagnostic queries (run manually after applying to verify):
-- ============================================================================
--
-- 1. Check permissions for a specific user+project:
--    SELECT * FROM get_user_project_permissions('<user_id>', '<project_id>');
--
-- 2. Check role_permissions for the "Niet" role:
--    SELECT rp.module_key, rp.can_view, rp.can_create, rp.can_edit, rp.can_delete
--    FROM role_permissions rp
--    JOIN roles r ON r.id = rp.role_id
--    WHERE r.id = '50209a8e-d280-451a-9ae8-2666d0c9261f';
--
-- 3. Verify a user assigned the "Niet" role only sees general_info:
--    SELECT * FROM get_user_project_permissions('<niet_user_id>', '<project_id>');
--    -- Expected: only general_info has can_view=true
-- ============================================================================
