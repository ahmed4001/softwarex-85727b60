
CREATE TABLE public.faq_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_slug text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  source text NOT NULL DEFAULT 'ai',
  is_edited boolean NOT NULL DEFAULT false,
  edited_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_slug)
);

CREATE INDEX idx_faq_cache_lookup ON public.faq_cache (entity_type, entity_slug);

GRANT SELECT ON public.faq_cache TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_cache TO authenticated;
GRANT ALL ON public.faq_cache TO service_role;

ALTER TABLE public.faq_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read FAQs"
  ON public.faq_cache FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert FAQs"
  ON public.faq_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "Admins can update FAQs"
  ON public.faq_cache FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "Admins can delete FAQs"
  ON public.faq_cache FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE TRIGGER trg_faq_cache_updated_at
  BEFORE UPDATE ON public.faq_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
