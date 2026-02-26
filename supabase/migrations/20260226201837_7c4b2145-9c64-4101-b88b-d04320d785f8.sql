
-- =============================================
-- 1. REVIEW VERIFICATION SYSTEM
-- =============================================

-- Reviewer verifications table
CREATE TABLE public.reviewer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method text NOT NULL, -- 'linkedin', 'email_domain', 'purchase_proof'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  evidence text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, method)
);

ALTER TABLE public.reviewer_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own verifications" ON public.reviewer_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own verifications" ON public.reviewer_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own verifications" ON public.reviewer_verifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage verifications" ON public.reviewer_verifications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Add verification columns to reviews
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS is_verified_purchase boolean DEFAULT false;

-- =============================================
-- 2. PRODUCT CHANGELOG
-- =============================================

CREATE TABLE public.product_changelogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  version text,
  change_type text NOT NULL DEFAULT 'improvement', -- 'feature', 'improvement', 'bugfix', 'breaking'
  published_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_changelogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published changelogs are publicly readable" ON public.product_changelogs
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage changelogs" ON public.product_changelogs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Vendors who claimed a product can manage its changelogs
CREATE POLICY "Vendors can manage own product changelogs" ON public.product_changelogs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM product_claims
      WHERE product_claims.product_id = product_changelogs.product_id
        AND product_claims.user_id = auth.uid()
        AND product_claims.status = 'approved'
    )
  );

CREATE INDEX idx_changelogs_product ON public.product_changelogs(product_id, is_published);

-- Changelog subscriptions
CREATE TABLE public.changelog_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.changelog_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscriptions" ON public.changelog_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions" ON public.changelog_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions" ON public.changelog_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 3. AI RECOMMENDATIONS (no extra tables needed,
--    uses existing reviews/saved_products/profiles)
-- =============================================

-- Store recommendation cache
CREATE TABLE public.user_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  reason text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recommendations" ON public.user_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage recommendations" ON public.user_recommendations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Service role inserts (from edge function)
CREATE POLICY "Service can insert recommendations" ON public.user_recommendations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can delete recommendations" ON public.user_recommendations
  FOR DELETE USING (true);

-- =============================================
-- 4. AFFILIATE & REFERRAL SYSTEM
-- =============================================

CREATE TABLE public.referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral links" ON public.referral_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own referral links" ON public.referral_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own referral links" ON public.referral_links
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage referral links" ON public.referral_links
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE TABLE public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id uuid NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'click', 'signup', 'review', 'conversion'
  ip_hash text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral events" ON public.referral_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM referral_links
      WHERE referral_links.id = referral_events.referral_link_id
        AND referral_links.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert referral events" ON public.referral_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage referral events" ON public.referral_events
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE TABLE public.referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected'
  period_start date NOT NULL,
  period_end date NOT NULL,
  referral_count integer NOT NULL DEFAULT 0,
  admin_note text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payouts" ON public.referral_payouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage payouts" ON public.referral_payouts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE INDEX idx_referral_links_user ON public.referral_links(user_id);
CREATE INDEX idx_referral_links_code ON public.referral_links(code);
CREATE INDEX idx_referral_events_link ON public.referral_events(referral_link_id);
CREATE INDEX idx_referral_payouts_user ON public.referral_payouts(user_id);
