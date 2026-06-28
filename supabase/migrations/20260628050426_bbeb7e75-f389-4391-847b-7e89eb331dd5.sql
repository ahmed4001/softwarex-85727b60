
CREATE TABLE public.sitemap_resubmission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sitemap_type text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  target_url text,
  status_code integer,
  success boolean NOT NULL DEFAULT false,
  error text,
  trigger_slug text,
  results jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sitemap_resub_log_created ON public.sitemap_resubmission_log (created_at DESC);
CREATE INDEX idx_sitemap_resub_log_type_created ON public.sitemap_resubmission_log (sitemap_type, created_at DESC);

GRANT SELECT ON public.sitemap_resubmission_log TO authenticated;
GRANT ALL ON public.sitemap_resubmission_log TO service_role;

ALTER TABLE public.sitemap_resubmission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sitemap resubmission log"
  ON public.sitemap_resubmission_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role));
