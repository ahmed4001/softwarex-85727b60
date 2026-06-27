
REVOKE EXECUTE ON FUNCTION public.notify_sitemap_change(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sitemap_blog() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sitemap_guides() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sitemap_glossary() FROM PUBLIC, anon, authenticated;
