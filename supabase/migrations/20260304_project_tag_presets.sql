-- ============================================================================
-- Project Tag Presets System
-- Superusers can create a personal library of tags, connect them to projects,
-- and optionally restrict files in that project to only use those tags.
-- ============================================================================

-- 1. Superuser tag library — personal collection of reusable tags
CREATE TABLE IF NOT EXISTS public.superuser_tags (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT superuser_tags_name_not_empty CHECK (char_length(trim(name)) > 0)
);

ALTER TABLE public.superuser_tags ENABLE ROW LEVEL SECURITY;

-- Only the owning superuser can access their own tags
CREATE POLICY "superuser_tags_own_all"
  ON public.superuser_tags
  FOR ALL
  TO authenticated
  USING  (owner_id = auth.uid() AND public.is_current_user_superuser())
  WITH CHECK (owner_id = auth.uid() AND public.is_current_user_superuser());


-- 2. Project-level tag settings — connects superuser tags to a specific project
--    and holds the restrict_to_preset flag
CREATE TABLE IF NOT EXISTS public.project_tag_settings (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tag_id             uuid NOT NULL REFERENCES public.superuser_tags(id) ON DELETE CASCADE,
  restrict_to_preset boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_tag_settings_unique UNIQUE (project_id, tag_id)
);

ALTER TABLE public.project_tag_settings ENABLE ROW LEVEL SECURITY;

-- Project members can SELECT so they can see the available tags in the files page
CREATE POLICY "project_tag_settings_member_select"
  ON public.project_tag_settings
  FOR SELECT
  TO authenticated
  USING (public.has_project_access(project_id));

-- Only the project owner (who must also be a superuser) can INSERT / UPDATE / DELETE
CREATE POLICY "project_tag_settings_owner_manage"
  ON public.project_tag_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND owner_id = auth.uid()
    )
    AND public.is_current_user_superuser()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND owner_id = auth.uid()
    )
    AND public.is_current_user_superuser()
  );


-- 3. Helper view — returns tags for a project together with the restrict flag
--    (the restrict flag is stored per assignment row; in practice we treat the
--    project-level flag as the MAX across all rows to keep it simple, but each
--    row carries the same flag so the superuser can toggle it once and it applies
--    to all connected tags).
--    We expose a separate per-project boolean view for convenience.
CREATE OR REPLACE VIEW public.project_tag_presets AS
  SELECT
    pts.project_id,
    st.id   AS tag_id,
    st.name AS tag_name,
    st.color,
    st.owner_id,
    pts.restrict_to_preset
  FROM public.project_tag_settings pts
  JOIN public.superuser_tags st ON st.id = pts.tag_id;

-- Grant select on the view to authenticated role
GRANT SELECT ON public.project_tag_presets TO authenticated;


-- 4. Convenience RPC: returns the effective restrict_to_preset flag for a project
--    (true if ANY assignment row has restrict_to_preset = true)
CREATE OR REPLACE FUNCTION public.get_project_restrict_tags(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT bool_or(restrict_to_preset)
     FROM public.project_tag_settings
     WHERE project_id = p_project_id),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_project_restrict_tags(uuid) TO authenticated;
