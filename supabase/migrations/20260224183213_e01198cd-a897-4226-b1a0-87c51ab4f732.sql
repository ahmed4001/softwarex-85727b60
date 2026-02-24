
INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true);

CREATE POLICY "Admins can upload email assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)));

CREATE POLICY "Admins can delete email assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'email-assets' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role)));

CREATE POLICY "Email assets are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');
