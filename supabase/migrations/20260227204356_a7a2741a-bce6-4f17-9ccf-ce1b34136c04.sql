
CREATE TABLE public.partner_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  website_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit partner application"
  ON public.partner_applications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage partner applications"
  ON public.partner_applications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));
