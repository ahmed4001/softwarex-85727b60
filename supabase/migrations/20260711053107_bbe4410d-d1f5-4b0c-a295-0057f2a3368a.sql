
-- Tighten site_settings SELECT policy: hide sensitive keys from anon/authenticated users.
DROP POLICY IF EXISTS "Settings are publicly readable" ON public.site_settings;

CREATE POLICY "Public settings are readable"
ON public.site_settings
FOR SELECT
USING (
  key NOT IN ('ai_config', 'ai_keys', 'api_keys', 'secrets')
);

CREATE POLICY "Admins can read all settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);
