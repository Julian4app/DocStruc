-- Fix project_timeline table - handle existing table or create new one

-- Drop existing table if it exists with wrong schema
DROP TABLE IF EXISTS public.project_timeline CASCADE;

-- Create project_timeline table for milestones with correct schema
CREATE TABLE public.project_timeline (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  event_date date NOT NULL,
  eventType text NOT NULL CHECK (eventType IN ('milestone', 'deadline', 'meeting', 'delivery')),
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_timeline ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Project members can view timeline" ON public.project_timeline
  FOR SELECT USING (public.has_project_access(project_id));

CREATE POLICY "Project members can create timeline events" ON public.project_timeline
  FOR INSERT WITH CHECK (public.has_project_access(project_id));

CREATE POLICY "Project members can update timeline events" ON public.project_timeline
  FOR UPDATE USING (public.has_project_access(project_id));

CREATE POLICY "Project members can delete timeline events" ON public.project_timeline
  FOR DELETE USING (public.has_project_access(project_id));

-- Create indexes for performance
CREATE INDEX project_timeline_project_id_idx ON public.project_timeline(project_id);
CREATE INDEX project_timeline_event_date_idx ON public.project_timeline(event_date);
