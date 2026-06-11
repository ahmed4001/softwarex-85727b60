
CREATE TABLE public.homepage_sections (
  key text PRIMARY KEY,
  label text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.homepage_sections TO anon, authenticated;
GRANT ALL ON public.homepage_sections TO service_role;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view homepage sections" ON public.homepage_sections FOR SELECT USING (true);
CREATE POLICY "Admins manage homepage sections" ON public.homepage_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TABLE public.homepage_section_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL REFERENCES public.homepage_sections(key) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(section_key, product_id)
);
CREATE INDEX idx_hsp_section ON public.homepage_section_products(section_key, position);
GRANT SELECT ON public.homepage_section_products TO anon, authenticated;
GRANT ALL ON public.homepage_section_products TO service_role;
ALTER TABLE public.homepage_section_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view section products" ON public.homepage_section_products FOR SELECT USING (true);
CREATE POLICY "Admins manage section products" ON public.homepage_section_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

INSERT INTO public.homepage_sections (key, label, sort_order) VALUES
  ('editors_choice', 'Editor''s Choice', 1),
  ('trending', 'Trending Products', 2),
  ('recently_added', 'Recently Added', 3),
  ('deals_showcase', 'Deals Showcase', 4)
ON CONFLICT (key) DO NOTHING;
