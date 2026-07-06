
CREATE TABLE public.content_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url TEXT NOT NULL,
  page_type TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC,
  avg_position NUMERIC,
  gap_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggested_title TEXT,
  suggested_meta_description TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  generated_by TEXT DEFAULT 'analyze-page-gaps',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX content_recommendations_page_url_idx ON public.content_recommendations(page_url);
CREATE INDEX content_recommendations_status_idx ON public.content_recommendations(status);
CREATE INDEX content_recommendations_impressions_idx ON public.content_recommendations(impressions DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_recommendations TO authenticated;
GRANT ALL ON public.content_recommendations TO service_role;

ALTER TABLE public.content_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view content recommendations"
  ON public.content_recommendations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins can manage content recommendations"
  ON public.content_recommendations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE TRIGGER content_recommendations_updated_at
  BEFORE UPDATE ON public.content_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
