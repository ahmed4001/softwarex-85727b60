
CREATE TABLE public.deals_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  mode text NOT NULL DEFAULT 'scrape',
  urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  crawl_limit int NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'queued',
  stage text,
  pages_total int NOT NULL DEFAULT 0,
  pages_done int NOT NULL DEFAULT 0,
  deals_found int NOT NULL DEFAULT 0,
  page_progress jsonb NOT NULL DEFAULT '[]'::jsonb,
  deals jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals_import_jobs TO authenticated;
GRANT ALL ON public.deals_import_jobs TO service_role;

ALTER TABLE public.deals_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage deals import jobs"
ON public.deals_import_jobs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE TRIGGER deals_import_jobs_updated_at
BEFORE UPDATE ON public.deals_import_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.deals_import_jobs;
ALTER TABLE public.deals_import_jobs REPLICA IDENTITY FULL;
