CREATE TABLE public.keyword_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  category_name TEXT,
  seed_keyword TEXT NOT NULL,
  keyword TEXT NOT NULL,
  search_volume INTEGER NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,
  competition NUMERIC NOT NULL DEFAULT 0,
  difficulty NUMERIC NOT NULL DEFAULT 0,
  opportunity_score NUMERIC NOT NULL DEFAULT 0,
  database_code TEXT NOT NULL DEFAULT 'us',
  source TEXT NOT NULL DEFAULT 'semrush',
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (keyword, database_code, category_id)
);

GRANT SELECT ON public.keyword_opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keyword_opportunities TO authenticated;
GRANT ALL ON public.keyword_opportunities TO service_role;

ALTER TABLE public.keyword_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Keyword opportunities are viewable by everyone"
  ON public.keyword_opportunities FOR SELECT USING (true);

CREATE POLICY "Admins manage keyword opportunities"
  ON public.keyword_opportunities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_keyword_opportunities_score ON public.keyword_opportunities (opportunity_score DESC);
CREATE INDEX idx_keyword_opportunities_category ON public.keyword_opportunities (category_id);

CREATE TRIGGER update_keyword_opportunities_updated_at
  BEFORE UPDATE ON public.keyword_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();