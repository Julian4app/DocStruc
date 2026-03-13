-- ============================================================
-- Website Contact Leads
-- Stores contact form submissions from the DocStruc website.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.website_leads (
    id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    topic           text NOT NULL DEFAULT 'general'
                        CHECK (topic IN ('general','demo','sales','support','partnership')),
    first_name      text NOT NULL,
    last_name       text NOT NULL,
    email           text NOT NULL,
    phone           text,
    company         text,
    company_size    text CHECK (
                        company_size IN ('1-10','11-50','51-200','200+','individual')
                        OR company_size IS NULL
                    ),
    subject         text NOT NULL,
    message         text NOT NULL,
    status          text NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new','read','in_progress','replied','closed','spam')),
    admin_notes     text,
    assigned_to     text,
    replied_at      timestamptz,
    source_url      text,
    created_at      timestamptz DEFAULT now() NOT NULL,
    updated_at      timestamptz DEFAULT now() NOT NULL
);

CREATE OR REPLACE FUNCTION public.touch_website_leads()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS website_leads_updated_at ON public.website_leads;
CREATE TRIGGER website_leads_updated_at
  BEFORE UPDATE ON public.website_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_website_leads();

CREATE INDEX IF NOT EXISTS website_leads_status_idx  ON public.website_leads (status);
CREATE INDEX IF NOT EXISTS website_leads_topic_idx   ON public.website_leads (topic);
CREATE INDEX IF NOT EXISTS website_leads_created_idx ON public.website_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS website_leads_email_idx   ON public.website_leads (email);

ALTER TABLE public.website_leads ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can INSERT via the website contact form
CREATE POLICY "website_leads_public_insert"
  ON public.website_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can SELECT / UPDATE / DELETE
CREATE POLICY "website_leads_admin_select"
  ON public.website_leads FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "website_leads_admin_update"
  ON public.website_leads FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "website_leads_admin_delete"
  ON public.website_leads FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
