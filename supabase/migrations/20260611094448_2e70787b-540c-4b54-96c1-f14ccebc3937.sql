
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS canonical_url text;

CREATE OR REPLACE FUNCTION public.sync_deal_canonical_and_structured()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_url text := 'https://softwarex.lovable.app';
  expected_canonical text;
BEGIN
  expected_canonical := base_url || '/deals/' || NEW.slug;

  -- Auto-fill canonical_url when missing, or when slug changed and canonical still points to old slug
  IF NEW.canonical_url IS NULL OR NEW.canonical_url = '' THEN
    NEW.canonical_url := expected_canonical;
  ELSIF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug
        AND NEW.canonical_url = (base_url || '/deals/' || OLD.slug) THEN
    NEW.canonical_url := expected_canonical;
  END IF;

  -- Regenerate structured_data.url when slug or canonical_url changes (or on insert)
  IF NEW.structured_data IS NOT NULL AND jsonb_typeof(NEW.structured_data) = 'object' THEN
    IF TG_OP = 'INSERT'
       OR OLD.slug IS DISTINCT FROM NEW.slug
       OR OLD.canonical_url IS DISTINCT FROM NEW.canonical_url
       OR OLD.structured_data IS DISTINCT FROM NEW.structured_data THEN
      NEW.structured_data := jsonb_set(NEW.structured_data, '{url}', to_jsonb(NEW.canonical_url), true);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_sync_canonical ON public.deals;
CREATE TRIGGER deals_sync_canonical
BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.sync_deal_canonical_and_structured();

-- Backfill canonical_url for existing rows and refresh structured_data.url
UPDATE public.deals
SET canonical_url = 'https://softwarex.lovable.app/deals/' || slug
WHERE canonical_url IS NULL OR canonical_url = '';
