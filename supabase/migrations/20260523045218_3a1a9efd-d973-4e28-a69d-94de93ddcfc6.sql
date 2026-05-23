ALTER TABLE public.keyword_landing_pages
  ADD COLUMN IF NOT EXISTS featured_image text,
  ADD COLUMN IF NOT EXISTS excerpt text;