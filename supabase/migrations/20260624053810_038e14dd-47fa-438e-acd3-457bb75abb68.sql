ALTER TABLE public.faq_cache ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS idx_faq_cache_entity ON public.faq_cache (entity_type, entity_slug);
CREATE INDEX IF NOT EXISTS idx_faq_cache_source ON public.faq_cache (source);