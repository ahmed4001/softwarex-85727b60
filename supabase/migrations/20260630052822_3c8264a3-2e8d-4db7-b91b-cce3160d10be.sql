
-- 1) Profiles: revoke sensitive columns from anon/authenticated
REVOKE SELECT (email, last_login_at, is_banned, ban_reason) ON public.profiles FROM anon, authenticated;

-- Self-service accessor so users can still fetch their own email
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 2) paddle_webhook_events: revoke public access; service_role bypasses RLS
DROP POLICY IF EXISTS "service role only" ON public.paddle_webhook_events;
CREATE POLICY "Deny all client access to webhook events"
  ON public.paddle_webhook_events FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 3) Trigger-only SECURITY DEFINER functions: revoke EXECUTE from PUBLIC/anon/authenticated.
--    These run as triggers under the table owner; clients never need to call them directly.
DO $$
DECLARE
  fn text;
  trigger_only_fns text[] := ARRAY[
    'update_profile_backfill_settings_updated_at()',
    'sync_deal_canonical_and_structured()',
    'profiles_set_username()',
    'discussions_set_slug()',
    'update_list_upvote_count()',
    'update_qa_upvote_count()',
    'update_discussion_reply_count()',
    'sync_category_product_count()',
    'sync_klp_published()',
    'trigger_award_qa_points()',
    'trigger_award_review_points()',
    'trigger_award_comment_points()',
    'update_product_rating()',
    'trg_sitemap_blog()',
    'trg_sitemap_guides()',
    'trg_sitemap_glossary()',
    'update_discussion_upvote_count()',
    'update_updated_at_column()',
    'handle_new_user()',
    'update_stack_upvote_count()',
    'increment_product_click()',
    'update_product_info_score()',
    'notify_product_watchers()',
    'notify_sitemap_change(text, text)',
    'award_points(uuid, integer, text, text)',
    'admin_get_user_emails(uuid[])',
    'admin_list_profiles()',
    'get_best_brevo_account()',
    'reset_brevo_daily_credits()'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip revoke %: %', fn, SQLERRM;
    END;
  END LOOP;
END $$;

-- Re-grant the admin RPCs to authenticated (they self-gate via has_role internally)
GRANT EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
