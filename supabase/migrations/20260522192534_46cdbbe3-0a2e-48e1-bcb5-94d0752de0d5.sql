DO $$ BEGIN
  CREATE TYPE public.landing_page_status AS ENUM ('draft','in_progress','ready','published','needs_update');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.landing_page_intent AS ENUM ('high','medium','low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.keyword_landing_pages
  ADD COLUMN IF NOT EXISTS status public.landing_page_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS intent public.landing_page_intent NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS related_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS internal_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

-- Backfill: published rows get status='published'
UPDATE public.keyword_landing_pages SET status = 'published' WHERE is_published = true AND status = 'draft';

CREATE INDEX IF NOT EXISTS idx_klp_status ON public.keyword_landing_pages(status);
CREATE INDEX IF NOT EXISTS idx_klp_intent ON public.keyword_landing_pages(intent);

-- Keep is_published in sync with status for backward compat
CREATE OR REPLACE FUNCTION public.sync_klp_published()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.is_published := (NEW.status = 'published');
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status <> 'published') THEN
    NEW.last_reviewed_at := COALESCE(NEW.last_reviewed_at, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_klp_sync_published ON public.keyword_landing_pages;
CREATE TRIGGER trg_klp_sync_published
  BEFORE INSERT OR UPDATE ON public.keyword_landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.sync_klp_published();