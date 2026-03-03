-- ============================================================
-- GDPR Compliance: Account Deletion & Data Export
-- GDPR Art. 17 (Right to Erasure) & Art. 20 (Data Portability)
-- ============================================================

-- -------------------------------------------------------
-- FUNCTION: delete_my_account()
-- Allows authenticated users to delete their own account
-- data. Profile is anonymized (not deleted) to preserve
-- referential integrity with projects, diary entries, etc.
-- The actual auth.users record must be deleted via an
-- Edge Function that uses the service-role key.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- 1. Delete notifications
  DELETE FROM public.notifications WHERE user_id = v_user_id;

  -- 2. Delete project member permissions (via project_members FK)
  DELETE FROM public.project_member_permissions
  WHERE project_member_id IN (
    SELECT id FROM public.project_members WHERE user_id = v_user_id
  );

  -- 3. Remove from projects (member entries)
  DELETE FROM public.project_members WHERE user_id = v_user_id;

  -- 4. Delete user_accessor entries where this user is the owner
  DELETE FROM public.user_accessors WHERE owner_id = v_user_id;

  -- 5. Remove as accessor in other users' lists
  DELETE FROM public.user_accessors
  WHERE registered_user_id = v_user_id;

  -- 6. Anonymize diary entries (keep structure, remove personal content)
  UPDATE public.diary_entries
  SET
    title = '[Gelöschter Benutzer]',
    description = NULL,
    weather = NULL
  WHERE created_by = v_user_id;

  -- 7. Anonymize the profile (preserve row for FK integrity)
  UPDATE public.profiles
  SET
    email            = 'deleted_' || v_user_id::text || '@deleted.invalid',
    first_name       = 'Gelöschter',
    last_name        = 'Benutzer',
    avatar_url       = NULL,
    phone            = NULL,
    team_id          = NULL,
    team_role        = NULL,
    is_superuser     = false
  WHERE id = v_user_id;

  -- 8. Log the deletion event in the audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    table_name,
    record_id,
    new_values
  ) VALUES (
    v_user_id,
    'GDPR_DELETE',
    'profiles',
    v_user_id,
    jsonb_build_object('deleted_at', now()::text, 'reason', 'user_requested')
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Only authenticated users may call this on their own data
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon;

-- -------------------------------------------------------
-- FUNCTION: export_my_data()
-- Returns a JSON document of all personal data held for
-- the calling user (GDPR Art. 20 data portability).
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'profile', (
      SELECT row_to_json(p)
      FROM public.profiles p
      WHERE p.id = v_user_id
    ),
    'projects', (
      SELECT jsonb_agg(row_to_json(pm))
      FROM public.project_members pm
      WHERE pm.user_id = v_user_id
    ),
    'diary_entries', (
      SELECT jsonb_agg(row_to_json(de))
      FROM public.diary_entries de
      WHERE de.created_by = v_user_id
    ),
    'notifications', (
      SELECT jsonb_agg(row_to_json(n))
      FROM public.notifications n
      WHERE n.user_id = v_user_id
    ),
    'accessors', (
      SELECT jsonb_agg(row_to_json(ua))
      FROM public.user_accessors ua
      WHERE ua.owner_id = v_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.export_my_data() FROM anon;

-- -------------------------------------------------------
-- RLS: Ensure only the owning user can invoke these
-- functions (enforced by auth.uid() check inside functions)
-- -------------------------------------------------------
COMMENT ON FUNCTION public.delete_my_account() IS
  'GDPR Art. 17 – Right to Erasure. Anonymises the calling user''s data and logs the deletion in audit_logs.';

COMMENT ON FUNCTION public.export_my_data() IS
  'GDPR Art. 20 – Data Portability. Returns all personal data held for the calling user as JSON.';
