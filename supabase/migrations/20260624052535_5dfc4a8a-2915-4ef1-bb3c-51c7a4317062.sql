
CREATE TABLE public.page_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text NOT NULL,
  is_helpful boolean NOT NULL,
  comment text,
  user_id uuid,
  session_id text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_feedback_path ON public.page_feedback (page_path);
CREATE INDEX idx_page_feedback_created ON public.page_feedback (created_at DESC);

GRANT SELECT, INSERT ON public.page_feedback TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_feedback TO authenticated;
GRANT ALL ON public.page_feedback TO service_role;

ALTER TABLE public.page_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can submit feedback
CREATE POLICY "Anyone can submit feedback"
  ON public.page_feedback FOR INSERT
  WITH CHECK (true);

-- Only admins read raw rows (which can contain comments / user_ids)
CREATE POLICY "Admins can read feedback"
  ON public.page_feedback FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "Admins can manage feedback"
  ON public.page_feedback FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

-- Public aggregate stats (counts only, no PII)
CREATE OR REPLACE VIEW public.page_feedback_stats
WITH (security_invoker = true) AS
SELECT
  page_path,
  COUNT(*) FILTER (WHERE is_helpful) AS helpful_count,
  COUNT(*) FILTER (WHERE NOT is_helpful) AS not_helpful_count,
  COUNT(*) AS total_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_helpful) / NULLIF(COUNT(*), 0),
    0
  ) AS helpful_pct,
  MAX(created_at) AS last_feedback_at
FROM public.page_feedback
GROUP BY page_path;

GRANT SELECT ON public.page_feedback_stats TO anon, authenticated;
