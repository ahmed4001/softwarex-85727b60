
-- Enum for page type
DO $$ BEGIN
  CREATE TYPE public.landing_page_type AS ENUM ('keyword', 'feature', 'use_case', 'industry', 'template');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.keyword_landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  page_type public.landing_page_type NOT NULL DEFAULT 'keyword',
  focus_keyword text,
  h1 text NOT NULL,
  meta_title text,
  meta_description text,
  hero_body text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_product_id uuid,
  related_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_category_id uuid,
  related_comparison_slugs jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_blog_slugs jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_jsonld jsonb,
  canonical_override text,
  is_published boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_type, slug)
);

CREATE INDEX IF NOT EXISTS idx_klp_slug ON public.keyword_landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_klp_type_published ON public.keyword_landing_pages(page_type, is_published);

ALTER TABLE public.keyword_landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published landing pages are publicly readable"
  ON public.keyword_landing_pages FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage landing pages"
  ON public.keyword_landing_pages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE TRIGGER update_keyword_landing_pages_updated_at
  BEFORE UPDATE ON public.keyword_landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
