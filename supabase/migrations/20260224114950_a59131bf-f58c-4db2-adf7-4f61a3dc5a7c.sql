
-- Create badges table for badge definitions
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'award',
  color text NOT NULL DEFAULT '#4F46E5',
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  criteria_type text NOT NULL CHECK (criteria_type IN ('review_count', 'helpful_votes', 'verified', 'manual')),
  criteria_threshold integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create user_badges junction table
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Badges are publicly readable
CREATE POLICY "Badges are publicly readable" ON public.badges FOR SELECT USING (true);

-- Admins can manage badges
CREATE POLICY "Admins can manage badges" ON public.badges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- User badges are publicly readable (for leaderboard/profiles)
CREATE POLICY "User badges are publicly readable" ON public.user_badges FOR SELECT USING (true);

-- Admins can manage user badges
CREATE POLICY "Admins can manage user badges" ON public.user_badges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Seed default badges
INSERT INTO public.badges (slug, name, description, icon, color, tier, criteria_type, criteria_threshold) VALUES
  ('first-review', 'First Review', 'Wrote your first review', 'pen-tool', '#3B82F6', 'bronze', 'review_count', 1),
  ('prolific-reviewer', 'Prolific Reviewer', 'Wrote 5 or more reviews', 'edit-3', '#8B5CF6', 'silver', 'review_count', 5),
  ('top-reviewer', 'Top Reviewer', 'Wrote 15 or more reviews', 'crown', '#F59E0B', 'gold', 'review_count', 15),
  ('review-master', 'Review Master', 'Wrote 50 or more reviews', 'trophy', '#EF4444', 'platinum', 'review_count', 50),
  ('helpful-contributor', 'Helpful Contributor', 'Received 10 helpful votes', 'heart', '#EC4899', 'bronze', 'helpful_votes', 10),
  ('community-hero', 'Community Hero', 'Received 50 helpful votes', 'star', '#F59E0B', 'gold', 'helpful_votes', 50),
  ('verified-expert', 'Verified Expert', 'Verified industry expert', 'shield-check', '#10B981', 'gold', 'verified', 0),
  ('rising-star', 'Rising Star', 'Received 5 helpful votes', 'zap', '#6366F1', 'bronze', 'helpful_votes', 5);
