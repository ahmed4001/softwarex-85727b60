
CREATE INDEX IF NOT EXISTS idx_products_active_info_created
  ON public.products (is_active, info_score DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comparisons_published_missing_summary
  ON public.comparisons (is_published)
  WHERE summary IS NULL;
