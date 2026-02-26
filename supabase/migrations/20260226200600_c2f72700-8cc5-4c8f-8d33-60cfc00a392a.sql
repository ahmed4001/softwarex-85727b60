
-- =============================================
-- 1. INTEGRATION MARKETPLACE
-- =============================================
CREATE TABLE public.product_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  integrates_with_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  description text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, integrates_with_product_id)
);

ALTER TABLE public.product_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Integrations are publicly readable"
  ON public.product_integrations FOR SELECT USING (true);

CREATE POLICY "Admins can manage integrations"
  ON public.product_integrations FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- =============================================
-- 2. REVIEW INCENTIVE PROGRAM (Points System)
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_points integer NOT NULL DEFAULT 0;

CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  entity_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own points"
  ON public.point_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage points"
  ON public.point_transactions FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- Function to award points
CREATE OR REPLACE FUNCTION public.award_points(
  _user_id uuid,
  _points integer,
  _reason text,
  _entity_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO point_transactions (user_id, points, reason, entity_id)
  VALUES (_user_id, _points, _reason, _entity_id);
  
  UPDATE profiles SET total_points = total_points + _points
  WHERE user_id = _user_id;
END;
$$;

-- Trigger: award points on review insert
CREATE OR REPLACE FUNCTION public.trigger_award_review_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_points(NEW.user_id, 50, 'review_posted', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_review_points
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_award_review_points();

-- Trigger: award points on comment insert
CREATE OR REPLACE FUNCTION public.trigger_award_comment_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_points(NEW.user_id, 10, 'comment_added', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_comment_points
  AFTER INSERT ON public.review_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_award_comment_points();

-- Trigger: award points on Q&A insert
CREATE OR REPLACE FUNCTION public.trigger_award_qa_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_points(NEW.user_id, 10, 'qa_posted', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_qa_points
  AFTER INSERT ON public.review_qa
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_award_qa_points();

-- =============================================
-- 3. VENDOR BIDDING / SPONSORED SLOTS
-- =============================================
CREATE TABLE public.sponsored_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  bid_amount numeric NOT NULL DEFAULT 0,
  daily_budget numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  start_date date,
  end_date date,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsored_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage own bids"
  ON public.sponsored_bids FOR ALL
  USING (auth.uid() = vendor_user_id);

CREATE POLICY "Admins can manage all bids"
  ON public.sponsored_bids FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Active bids are publicly readable"
  ON public.sponsored_bids FOR SELECT
  USING (status = 'active');

CREATE TRIGGER update_sponsored_bids_updated_at
  BEFORE UPDATE ON public.sponsored_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. COMMUNITY DISCUSSION FORUMS
-- =============================================
CREATE TABLE public.discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  user_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  upvote_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Discussions are publicly readable"
  ON public.discussions FOR SELECT USING (true);

CREATE POLICY "Users can create discussions"
  ON public.discussions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discussions"
  ON public.discussions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own discussions"
  ON public.discussions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage discussions"
  ON public.discussions FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER update_discussions_updated_at
  BEFORE UPDATE ON public.discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  is_vendor_answer boolean NOT NULL DEFAULT false,
  upvote_count integer NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.discussion_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Replies are publicly readable"
  ON public.discussion_replies FOR SELECT USING (true);

CREATE POLICY "Users can create replies"
  ON public.discussion_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own replies"
  ON public.discussion_replies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies"
  ON public.discussion_replies FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage replies"
  ON public.discussion_replies FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER update_discussion_replies_updated_at
  BEFORE UPDATE ON public.discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update reply_count on discussions
CREATE OR REPLACE FUNCTION public.update_discussion_reply_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE discussions SET reply_count = (SELECT COUNT(*) FROM discussion_replies WHERE discussion_id = OLD.discussion_id) WHERE id = OLD.discussion_id;
    RETURN OLD;
  ELSE
    UPDATE discussions SET reply_count = (SELECT COUNT(*) FROM discussion_replies WHERE discussion_id = NEW.discussion_id) WHERE id = NEW.discussion_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_update_discussion_reply_count
  AFTER INSERT OR DELETE ON public.discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_discussion_reply_count();

CREATE TABLE public.discussion_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  discussion_id uuid REFERENCES public.discussions(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.discussion_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, discussion_id),
  UNIQUE(user_id, reply_id)
);

ALTER TABLE public.discussion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are publicly readable"
  ON public.discussion_votes FOR SELECT USING (true);

CREATE POLICY "Users can insert own votes"
  ON public.discussion_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON public.discussion_votes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage votes"
  ON public.discussion_votes FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- Update upvote counts on vote changes
CREATE OR REPLACE FUNCTION public.update_discussion_upvote_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_discussion_id uuid;
  target_reply_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_discussion_id := OLD.discussion_id;
    target_reply_id := OLD.reply_id;
  ELSE
    target_discussion_id := NEW.discussion_id;
    target_reply_id := NEW.reply_id;
  END IF;

  IF target_discussion_id IS NOT NULL THEN
    UPDATE discussions SET upvote_count = (SELECT COUNT(*) FROM discussion_votes WHERE discussion_id = target_discussion_id) WHERE id = target_discussion_id;
  END IF;

  IF target_reply_id IS NOT NULL THEN
    UPDATE discussion_replies SET upvote_count = (SELECT COUNT(*) FROM discussion_votes WHERE reply_id = target_reply_id) WHERE id = target_reply_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_discussion_upvote_count
  AFTER INSERT OR DELETE ON public.discussion_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_discussion_upvote_count();

-- =============================================
-- 5. SEO LANDING PAGES
-- =============================================
CREATE TABLE public.seo_landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  meta_description text,
  body text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  audience text,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published landing pages are publicly readable"
  ON public.seo_landing_pages FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage landing pages"
  ON public.seo_landing_pages FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER update_seo_landing_pages_updated_at
  BEFORE UPDATE ON public.seo_landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
