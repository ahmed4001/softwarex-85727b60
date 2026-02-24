
-- Product claims: vendors claim ownership of a product
CREATE TABLE public.product_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  evidence text,
  admin_note text,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(product_id, user_id)
);

ALTER TABLE public.product_claims ENABLE ROW LEVEL SECURITY;

-- Users can create claims
CREATE POLICY "Users can create claims" ON public.product_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view own claims
CREATE POLICY "Users can view own claims" ON public.product_claims
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage claims
CREATE POLICY "Admins can manage claims" ON public.product_claims
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Vendor responses to reviews
CREATE TABLE public.vendor_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id)
);

ALTER TABLE public.vendor_responses ENABLE ROW LEVEL SECURITY;

-- Vendor responses are publicly readable
CREATE POLICY "Vendor responses are publicly readable" ON public.vendor_responses
  FOR SELECT USING (true);

-- Vendors can create responses for their claimed products
CREATE POLICY "Vendors can create responses" ON public.vendor_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Vendors can update own responses
CREATE POLICY "Vendors can update own responses" ON public.vendor_responses
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can manage responses
CREATE POLICY "Admins can manage vendor responses" ON public.vendor_responses
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Add trigger for updated_at on vendor_responses
CREATE TRIGGER update_vendor_responses_updated_at
  BEFORE UPDATE ON public.vendor_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
