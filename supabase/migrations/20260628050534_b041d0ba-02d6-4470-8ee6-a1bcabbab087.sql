
CREATE OR REPLACE FUNCTION public.notify_sitemap_change(_type text, _slug text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    body := jsonb_build_object('type', _type, 'slug', _slug, 'source', 'trigger')
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_sitemap_change failed: %', SQLERRM;
END;
$function$;
