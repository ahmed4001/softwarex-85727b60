
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_sitemap_change(_type text, _slug text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://ffeimjfunghzxgeqiwma.supabase.co/functions/v1/resubmit-sitemaps';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg';
  lock_key bigint := hashtext('sitemap:' || _type);
BEGIN
  IF NOT pg_try_advisory_xact_lock(lock_key) THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('type', _type, 'slug', _slug)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_sitemap_change failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sitemap_blog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' THEN
    PERFORM public.notify_sitemap_change('blog', NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sitemap_guides()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_sitemap_change('guides', NEW.slug);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sitemap_glossary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_sitemap_change('glossary', NEW.slug);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sitemap_resubmit_blog ON public.blog_posts;
CREATE TRIGGER sitemap_resubmit_blog
  AFTER INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_sitemap_blog();

DROP TRIGGER IF EXISTS sitemap_resubmit_guides ON public.buyer_guides;
CREATE TRIGGER sitemap_resubmit_guides
  AFTER INSERT OR UPDATE ON public.buyer_guides
  FOR EACH ROW EXECUTE FUNCTION public.trg_sitemap_guides();

DROP TRIGGER IF EXISTS sitemap_resubmit_glossary ON public.glossary_terms;
CREATE TRIGGER sitemap_resubmit_glossary
  AFTER INSERT OR UPDATE ON public.glossary_terms
  FOR EACH ROW EXECUTE FUNCTION public.trg_sitemap_glossary();

DO $$
DECLARE jid int;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'resubmit-sitemaps-daily';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
  PERFORM cron.schedule(
    'resubmit-sitemaps-daily',
    '0 3 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://ffeimjfunghzxgeqiwma.supabase.co/functions/v1/resubmit-sitemaps',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZWltamZ1bmdoenhnZXFpd21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjI2MjEsImV4cCI6MjA4NzQ5ODYyMX0.SnPyI6XDg3zyI4fQTYUKRoAhu_gJ4QLvBw-y6muPYvg'
      ),
      body := jsonb_build_object('type', 'all')
    );
    $cron$
  );
END $$;
