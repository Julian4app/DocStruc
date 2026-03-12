-- ============================================================
-- Personal ToDo System
-- Each user has a private ToDo list, optionally shared with
-- exactly one colleague from the same project.
-- ============================================================

-- ── todos ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.todos (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            text        NOT NULL,
    description     text,           -- stored as HTML
    status          text        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','in_progress','waiting','done')),
    due_date        timestamptz,
    location        text,
    owner_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_user_id uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── todo_links ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.todo_links (
    id          uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
    todo_id     uuid    NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
    entity_type text    NOT NULL
                        CHECK (entity_type IN ('defect','task','milestone','document','object','note','message')),
    entity_id   uuid    NOT NULL,
    project_id  uuid    NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_todos_owner          ON public.todos(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_todos_shared         ON public.todos(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_todos_status         ON public.todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_due            ON public.todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_links_todo      ON public.todo_links(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_links_project   ON public.todo_links(project_id);
CREATE INDEX IF NOT EXISTS idx_todo_links_entity    ON public.todo_links(entity_type, entity_id);

-- ── updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS todos_updated_at ON public.todos;
CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.todos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_links  ENABLE ROW LEVEL SECURITY;

-- todos: owner OR shared colleague
DROP POLICY IF EXISTS "todos_access" ON public.todos;
CREATE POLICY "todos_access" ON public.todos
  FOR ALL TO authenticated
  USING  (owner_user_id = auth.uid() OR shared_with_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());   -- only owner can insert/update/delete

-- todo_links: follows todo access
DROP POLICY IF EXISTS "todo_links_access" ON public.todo_links;
CREATE POLICY "todo_links_access" ON public.todo_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.todos t
      WHERE t.id = todo_id
        AND (t.owner_user_id = auth.uid() OR t.shared_with_user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.todos t
      WHERE t.id = todo_id
        AND t.owner_user_id = auth.uid()
    )
  );

-- ── Helper: get project members the current user can share with ───────────

CREATE OR REPLACE FUNCTION public.get_todo_shareable_users(p_project_id uuid)
RETURNS TABLE (user_id uuid, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    pm.user_id,
    concat(pr.first_name, ' ', pr.last_name) AS display_name,
    pr.avatar_url
  FROM project_members pm
  JOIN profiles pr ON pr.id = pm.user_id
  WHERE pm.project_id = p_project_id
    AND pm.user_id != auth.uid()
    AND pm.status = 'active'
  ORDER BY display_name;
$$;
