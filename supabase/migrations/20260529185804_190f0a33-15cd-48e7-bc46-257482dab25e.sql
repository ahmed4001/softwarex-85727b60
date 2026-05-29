
-- 1. Profiles email exposure
DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;

CREATE POLICY "Public profile fields are viewable"
ON public.profiles FOR SELECT
USING (true);

REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, user_id, name, avatar_url, bio, job_title, company, industry, company_size,
  is_verified_reviewer, is_banned, ban_reason, review_count, helpful_votes_received,
  last_login_at, created_at, preferred_language, linkedin_verified, total_points,
  display_title, referral_code, referred_by, verification_type, verified_domain, verified_at
) ON public.profiles TO anon, authenticated;

CREATE OR REPLACE VIEW public.my_profile WITH (security_invoker = true) AS
SELECT * FROM public.profiles WHERE user_id = auth.uid();
GRANT SELECT ON public.my_profile TO authenticated;

-- 2. Storage product-images admin-only update/delete
DROP POLICY IF EXISTS "Signed-in users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Signed-in users can update product images" ON storage.objects;

CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
);

CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
);

-- 3. Public bucket listing — restrict to admins
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Review media files are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Email assets are publicly readable" ON storage.objects;

CREATE POLICY "Admins can list product images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'product-images'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
);

CREATE POLICY "Admins can list review media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'review-media'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
);

CREATE POLICY "Admins can list email assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'email-assets'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'superadmin'::public.app_role))
);

-- 4. Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.update_list_upvote_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_qa_upvote_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_discussion_reply_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_best_brevo_account() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_category_product_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reset_brevo_daily_credits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_klp_published() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_award_qa_points() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_product_rating() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_stack_upvote_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_discussion_upvote_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_product_click() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_product_info_score() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, integer, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_award_review_points() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trigger_award_comment_points() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_product_watchers() FROM anon, authenticated, public;
