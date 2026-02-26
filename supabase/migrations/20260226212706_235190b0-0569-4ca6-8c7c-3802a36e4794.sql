
-- 1. Review Reactions (emoji reactions on reviews)
CREATE TABLE public.review_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('👍', '🔥', '💡', '🤔')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id, emoji)
);
ALTER TABLE public.review_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions are publicly readable" ON public.review_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert own reactions" ON public.review_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.review_reactions FOR DELETE USING (auth.uid() = user_id);

-- 2. User Achievements (milestone titles/frames)
CREATE TABLE public.user_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  title text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'trophy',
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Achievements are publicly readable" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "System can insert achievements" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add display_title to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_title text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid DEFAULT NULL;

-- 3. Referrals table
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_email text,
  referred_user_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'qualified', 'rewarded')),
  points_awarded integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Users can create referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_id);
CREATE POLICY "Admins can manage referrals" ON public.referrals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 4. Alternative Pages (SEO)
CREATE TABLE public.alternative_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  meta_description text,
  intro_text text,
  faq_schema jsonb DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alternative_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published alt pages are publicly readable" ON public.alternative_pages FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage alt pages" ON public.alternative_pages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 5. Glossary Terms
CREATE TABLE public.glossary_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term text NOT NULL,
  slug text NOT NULL UNIQUE,
  definition text NOT NULL,
  extended_description text,
  related_terms jsonb DEFAULT '[]'::jsonb,
  category text,
  is_published boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published terms are publicly readable" ON public.glossary_terms FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage glossary" ON public.glossary_terms FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 6. Category Trend Reports
CREATE TABLE public.category_trend_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  period text NOT NULL DEFAULT 'monthly',
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  rising_products jsonb DEFAULT '[]'::jsonb,
  falling_products jsonb DEFAULT '[]'::jsonb,
  summary text,
  stats jsonb DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.category_trend_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published reports are publicly readable" ON public.category_trend_reports FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage trend reports" ON public.category_trend_reports FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- 7. Add intent_score to vendor_leads
ALTER TABLE public.vendor_leads ADD COLUMN IF NOT EXISTS intent_score integer DEFAULT 0;
ALTER TABLE public.vendor_leads ADD COLUMN IF NOT EXISTS intent_signals jsonb DEFAULT '[]'::jsonb;

-- Indexes
CREATE INDEX idx_review_reactions_review ON public.review_reactions(review_id);
CREATE INDEX idx_review_reactions_user ON public.review_reactions(user_id);
CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_alternative_pages_product ON public.alternative_pages(product_id);
CREATE INDEX idx_glossary_terms_slug ON public.glossary_terms(slug);
CREATE INDEX idx_category_trend_reports_category ON public.category_trend_reports(category_id);
