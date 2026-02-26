
-- Create review_digests table
CREATE TABLE public.review_digests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  overall_verdict text,
  pros_summary text,
  cons_summary text,
  top_themes jsonb DEFAULT '[]'::jsonb,
  sentiment_pct jsonb DEFAULT '{"positive": 0, "neutral": 0, "negative": 0}'::jsonb,
  avg_sub_ratings jsonb DEFAULT '{}'::jsonb,
  review_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_digests ENABLE ROW LEVEL SECURITY;

-- Publicly readable
CREATE POLICY "Review digests are publicly readable"
  ON public.review_digests FOR SELECT
  USING (true);

-- Admin-only writes
CREATE POLICY "Admins can manage review digests"
  ON public.review_digests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Auto-update timestamp
CREATE TRIGGER update_review_digests_updated_at
  BEFORE UPDATE ON public.review_digests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
