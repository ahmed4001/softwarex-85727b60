CREATE TABLE public.backfill_match_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  source_query text NOT NULL,
  matched_domain text,
  matched_url text,
  previous_url text,
  confidence numeric(4,3),
  status text NOT NULL,
  reason text,
  candidates jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backfill_match_log TO authenticated;
GRANT ALL ON public.backfill_match_log TO service_role;

ALTER TABLE public.backfill_match_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backfill log"
  ON public.backfill_match_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE INDEX idx_backfill_match_log_product ON public.backfill_match_log(product_id);
CREATE INDEX idx_backfill_match_log_created ON public.backfill_match_log(created_at DESC);
CREATE INDEX idx_backfill_match_log_status ON public.backfill_match_log(status);