
CREATE TABLE IF NOT EXISTS public.web_vitals (
  id BIGSERIAL PRIMARY KEY,
  metric TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  rating TEXT,
  navigation_type TEXT,
  path TEXT NOT NULL,
  user_agent TEXT,
  connection TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_vitals_created_at_idx ON public.web_vitals (created_at DESC);
CREATE INDEX IF NOT EXISTS web_vitals_metric_path_idx ON public.web_vitals (metric, path);

GRANT INSERT ON public.web_vitals TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.web_vitals_id_seq TO anon, authenticated;
GRANT ALL ON public.web_vitals TO service_role;
GRANT ALL ON SEQUENCE public.web_vitals_id_seq TO service_role;

ALTER TABLE public.web_vitals ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a beacon (write-only).
CREATE POLICY "anyone can insert web vitals" ON public.web_vitals
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Only admins can read aggregated vitals.
CREATE POLICY "admins can read web vitals" ON public.web_vitals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
