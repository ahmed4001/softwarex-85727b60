
-- 1) Profiles: revoke sensitive columns from anon/authenticated.
REVOKE SELECT (email, last_login_at, is_banned, ban_reason) ON public.profiles FROM anon, authenticated;

-- Admin-only RPC to fetch emails by user_ids (used by admin pages).
CREATE OR REPLACE FUNCTION public.admin_get_user_emails(_user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT p.user_id, p.email FROM public.profiles p WHERE p.user_id = ANY(_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) TO authenticated;

-- 2) Referrals: hide referred_email column from regular users.
REVOKE SELECT (referred_email) ON public.referrals FROM anon, authenticated;

-- 3) Storage: restrict product-images uploads to admins only.
DROP POLICY IF EXISTS "Signed-in users can upload product images" ON storage.objects;
CREATE POLICY "Admins can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role))
);
