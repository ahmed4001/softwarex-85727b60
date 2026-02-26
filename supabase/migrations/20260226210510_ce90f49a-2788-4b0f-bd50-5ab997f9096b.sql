
-- =============================================
-- 1. SMART ALERTS & MONITORING
-- =============================================

CREATE TABLE public.price_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  alert_type text NOT NULL DEFAULT 'price_drop', -- price_drop, rating_change, new_review
  threshold_value numeric, -- e.g. price threshold or rating threshold
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, alert_type)
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own alerts" ON public.price_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own alerts" ON public.price_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.price_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON public.price_alerts FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.alert_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES public.price_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  old_value numeric,
  new_value numeric,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own alert history" ON public.alert_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own alert history" ON public.alert_history FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- 2. USER-GENERATED TECH STACKS
-- =============================================

CREATE TABLE public.tech_stacks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  category text, -- e.g. "DevOps", "Marketing", "Startup"
  is_published boolean NOT NULL DEFAULT true,
  upvote_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tech_stacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published stacks are publicly readable" ON public.tech_stacks FOR SELECT USING (is_published = true);
CREATE POLICY "Owners can read own stacks" ON public.tech_stacks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create stacks" ON public.tech_stacks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update own stacks" ON public.tech_stacks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owners can delete own stacks" ON public.tech_stacks FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.tech_stack_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stack_id uuid NOT NULL REFERENCES public.tech_stacks(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  role_description text, -- "We use this for CI/CD"
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tech_stack_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stack items readable via published stack" ON public.tech_stack_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM tech_stacks WHERE tech_stacks.id = tech_stack_items.stack_id AND tech_stacks.is_published = true)
);
CREATE POLICY "Owner can read own stack items" ON public.tech_stack_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM tech_stacks WHERE tech_stacks.id = tech_stack_items.stack_id AND tech_stacks.user_id = auth.uid())
);
CREATE POLICY "Owner can insert stack items" ON public.tech_stack_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM tech_stacks WHERE tech_stacks.id = tech_stack_items.stack_id AND tech_stacks.user_id = auth.uid())
);
CREATE POLICY "Owner can update stack items" ON public.tech_stack_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM tech_stacks WHERE tech_stacks.id = tech_stack_items.stack_id AND tech_stacks.user_id = auth.uid())
);
CREATE POLICY "Owner can delete stack items" ON public.tech_stack_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM tech_stacks WHERE tech_stacks.id = tech_stack_items.stack_id AND tech_stacks.user_id = auth.uid())
);

CREATE TABLE public.tech_stack_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  stack_id uuid NOT NULL REFERENCES public.tech_stacks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, stack_id)
);

ALTER TABLE public.tech_stack_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stack votes are publicly readable" ON public.tech_stack_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert own votes" ON public.tech_stack_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.tech_stack_votes FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update upvote_count
CREATE OR REPLACE FUNCTION public.update_stack_upvote_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE tech_stacks SET upvote_count = (SELECT COUNT(*) FROM tech_stack_votes WHERE stack_id = OLD.stack_id) WHERE id = OLD.stack_id;
    RETURN OLD;
  ELSE
    UPDATE tech_stacks SET upvote_count = (SELECT COUNT(*) FROM tech_stack_votes WHERE stack_id = NEW.stack_id) WHERE id = NEW.stack_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_stack_votes
AFTER INSERT OR DELETE ON public.tech_stack_votes
FOR EACH ROW EXECUTE FUNCTION public.update_stack_upvote_count();

-- =============================================
-- 3. VENDOR WAR ROOM
-- =============================================

CREATE TABLE public.competitive_battlecards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  talking_points jsonb DEFAULT '[]'::jsonb,
  objection_handling jsonb DEFAULT '[]'::jsonb,
  win_rate numeric DEFAULT 0,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitive_battlecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can read own battlecards" ON public.competitive_battlecards FOR SELECT USING (auth.uid() = vendor_user_id);
CREATE POLICY "Vendors can create own battlecards" ON public.competitive_battlecards FOR INSERT WITH CHECK (auth.uid() = vendor_user_id);
CREATE POLICY "Vendors can update own battlecards" ON public.competitive_battlecards FOR UPDATE USING (auth.uid() = vendor_user_id);
CREATE POLICY "Vendors can delete own battlecards" ON public.competitive_battlecards FOR DELETE USING (auth.uid() = vendor_user_id);
CREATE POLICY "Admins can manage battlecards" ON public.competitive_battlecards FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.vendor_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  competitor_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  deal_name text NOT NULL,
  outcome text NOT NULL DEFAULT 'pending', -- won, lost, pending
  deal_value numeric,
  loss_reason text,
  notes text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can read own deals" ON public.vendor_deals FOR SELECT USING (auth.uid() = vendor_user_id);
CREATE POLICY "Vendors can create own deals" ON public.vendor_deals FOR INSERT WITH CHECK (auth.uid() = vendor_user_id);
CREATE POLICY "Vendors can update own deals" ON public.vendor_deals FOR UPDATE USING (auth.uid() = vendor_user_id);
CREATE POLICY "Vendors can delete own deals" ON public.vendor_deals FOR DELETE USING (auth.uid() = vendor_user_id);
CREATE POLICY "Admins can manage deals" ON public.vendor_deals FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

-- =============================================
-- 4. INTERACTIVE BUYER GUIDES
-- =============================================

CREATE TABLE public.buyer_guides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of {question, options: [{label, filter}]}
  result_product_ids jsonb DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  completion_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published guides are publicly readable" ON public.buyer_guides FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage guides" ON public.buyer_guides FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

CREATE TABLE public.buyer_guide_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id uuid NOT NULL REFERENCES public.buyer_guides(id) ON DELETE CASCADE,
  user_id uuid,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_product_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_guide_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert completions" ON public.buyer_guide_completions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can read own completions" ON public.buyer_guide_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all completions" ON public.buyer_guide_completions FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));
