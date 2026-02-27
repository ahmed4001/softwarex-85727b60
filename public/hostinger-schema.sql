-- =============================================
-- FULL DATABASE SCHEMA FOR HOSTINGER MIGRATION
-- Generated from Lovable Cloud PostgreSQL
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CUSTOM ENUM TYPES
-- =============================================
CREATE TYPE ad_placement AS ENUM ('homepage', 'category', 'product', 'blog');
CREATE TYPE ad_type AS ENUM ('banner', 'sidebar', 'featured_slot');
CREATE TYPE app_role AS ENUM ('user', 'vendor', 'admin', 'superadmin');
CREATE TYPE blog_status AS ENUM ('draft', 'scheduled', 'published', 'archived');
CREATE TYPE pricing_model AS ENUM ('free', 'freemium', 'paid', 'subscription', 'one-time');
CREATE TYPE review_source AS ENUM ('organic', 'invited', 'imported');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected', 'spam', 'flagged');
CREATE TYPE sponsor_tier AS ENUM ('bronze', 'silver', 'gold');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

-- =============================================
-- TABLES
-- =============================================

-- Categories
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#4F46E5',
  banner_image TEXT,
  parent_id UUID REFERENCES public.categories(id),
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  product_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  category_id UUID REFERENCES public.categories(id),
  pricing_model pricing_model,
  starting_price NUMERIC,
  avg_rating NUMERIC DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  integrations JSONB DEFAULT '[]'::jsonb,
  screenshots JSONB DEFAULT '[]'::jsonb,
  pros_summary TEXT,
  cons_summary TEXT,
  founded_year INTEGER,
  headquarters TEXT,
  company_size TEXT,
  employee_count INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  seo_title TEXT,
  seo_description TEXT,
  vendor_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id),
  user_id UUID,
  title TEXT,
  body TEXT,
  pros TEXT,
  cons TEXT,
  overall_rating INTEGER NOT NULL,
  ease_of_use INTEGER,
  customer_support INTEGER,
  value_for_money INTEGER,
  features_rating INTEGER,
  reviewer_role TEXT,
  company_size TEXT,
  industry TEXT,
  usage_duration TEXT,
  use_case TEXT,
  recommendation_likelihood INTEGER,
  status review_status DEFAULT 'pending',
  source review_source DEFAULT 'organic',
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comparisons
CREATE TABLE public.comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT,
  slug TEXT,
  summary TEXT,
  winner_verdict TEXT,
  winner_product_id UUID REFERENCES public.products(id),
  category_id UUID REFERENCES public.categories(id),
  product_a_score NUMERIC DEFAULT 0,
  product_b_score NUMERIC DEFAULT 0,
  feature_scores JSONB DEFAULT '[]'::jsonb,
  pros_a JSONB DEFAULT '[]'::jsonb,
  cons_a JSONB DEFAULT '[]'::jsonb,
  pros_b JSONB DEFAULT '[]'::jsonb,
  cons_b JSONB DEFAULT '[]'::jsonb,
  best_for_a TEXT,
  best_for_b TEXT,
  seo_title TEXT,
  seo_description TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alternatives
CREATE TABLE public.alternatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  alternative_product_id UUID NOT NULL REFERENCES public.products(id),
  similarity_score NUMERIC DEFAULT 0
);

-- Alternative Pages
CREATE TABLE public.alternative_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  meta_description TEXT,
  intro_text TEXT,
  faq_schema JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Advertisements
CREATE TABLE public.advertisements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type ad_type NOT NULL,
  placement ad_placement NOT NULL,
  image_url TEXT,
  target_url TEXT,
  alt_text TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity Logs
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alert History
CREATE TABLE public.alert_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  alert_type TEXT NOT NULL,
  old_value NUMERIC,
  new_value NUMERIC,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Price Alerts
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  alert_type TEXT DEFAULT 'price_change',
  threshold_value NUMERIC,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK for alert_history after price_alerts exists
ALTER TABLE public.alert_history ADD CONSTRAINT alert_history_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.price_alerts(id);

-- Award Categories
CREATE TABLE public.award_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  year INTEGER DEFAULT 2026,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Award Nominations
CREATE TABLE public.award_nominations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_category_id UUID NOT NULL REFERENCES public.award_categories(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  nominated_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Award Votes
CREATE TABLE public.award_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_category_id UUID NOT NULL REFERENCES public.award_categories(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Badges
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'award',
  color TEXT DEFAULT '#4F46E5',
  tier TEXT DEFAULT 'bronze',
  criteria_type TEXT NOT NULL,
  criteria_threshold INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Blog Posts
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  author_id UUID,
  category TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  featured_image TEXT,
  reading_time INTEGER DEFAULT 0,
  status blog_status DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  og_image TEXT,
  canonical_url TEXT,
  view_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Brevo Accounts
CREATE TABLE public.brevo_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  daily_credit_limit INTEGER DEFAULT 300,
  credits_used_today INTEGER DEFAULT 0,
  credits_reset_at TIMESTAMPTZ DEFAULT now(),
  total_emails_sent INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Brevo Campaigns
CREATE TABLE public.brevo_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brevo_account_id UUID NOT NULL REFERENCES public.brevo_accounts(id),
  subject TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT DEFAULT 'SoftwareHub',
  html_content TEXT,
  brevo_campaign_id TEXT,
  status TEXT DEFAULT 'draft',
  recipients_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Buyer Guides
CREATE TABLE public.buyer_guides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id),
  steps JSONB DEFAULT '[]'::jsonb,
  result_product_ids JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Buyer Guide Completions
CREATE TABLE public.buyer_guide_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id UUID NOT NULL REFERENCES public.buyer_guides(id),
  user_id UUID,
  answers JSONB DEFAULT '[]'::jsonb,
  recommended_product_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Category Trend Reports
CREATE TABLE public.category_trend_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id),
  period TEXT DEFAULT 'monthly',
  report_date DATE DEFAULT CURRENT_DATE,
  summary TEXT,
  rising_products JSONB DEFAULT '[]'::jsonb,
  falling_products JSONB DEFAULT '[]'::jsonb,
  stats JSONB DEFAULT '{}'::jsonb,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Changelog Subscriptions
CREATE TABLE public.changelog_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Competitive Battlecards
CREATE TABLE public.competitive_battlecards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  competitor_product_id UUID NOT NULL REFERENCES public.products(id),
  vendor_user_id UUID NOT NULL,
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  talking_points JSONB DEFAULT '[]'::jsonb,
  objection_handling JSONB DEFAULT '[]'::jsonb,
  win_rate NUMERIC DEFAULT 0,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Digest Logs
CREATE TABLE public.digest_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT DEFAULT 'sent',
  recipient_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Discussions
CREATE TABLE public.discussions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  category_id UUID REFERENCES public.categories(id),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  upvote_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Discussion Replies
CREATE TABLE public.discussion_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discussion_id UUID NOT NULL REFERENCES public.discussions(id),
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  parent_id UUID REFERENCES public.discussion_replies(id),
  is_vendor_answer BOOLEAN DEFAULT FALSE,
  upvote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Discussion Votes
CREATE TABLE public.discussion_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  discussion_id UUID REFERENCES public.discussions(id),
  reply_id UUID REFERENCES public.discussion_replies(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email Templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  blocks JSONB DEFAULT '[]'::jsonb,
  thumbnail_html TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Glossary Terms
CREATE TABLE public.glossary_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL,
  slug TEXT NOT NULL,
  definition TEXT NOT NULL,
  extended_description TEXT,
  category TEXT,
  related_terms JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lists
CREATE TABLE public.lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  product_count INTEGER DEFAULT 0,
  upvote_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- List Items
CREATE TABLE public.list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.lists(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- List Votes
CREATE TABLE public.list_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.lists(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Media Library
CREATE TABLE public.media_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  file_type TEXT,
  file_size INTEGER,
  alt_text TEXT,
  caption TEXT,
  folder TEXT DEFAULT 'general',
  thumbnail_url TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Moderation Queue
CREATE TABLE public.moderation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  reason TEXT DEFAULT 'flagged',
  status TEXT DEFAULT 'pending',
  reported_by UUID,
  moderator_id UUID,
  moderator_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Newsletter Subscribers
CREATE TABLE public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification Preferences
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  review_replies BOOLEAN DEFAULT TRUE,
  badge_earned BOOLEAN DEFAULT TRUE,
  new_followers BOOLEAN DEFAULT TRUE,
  product_updates BOOLEAN DEFAULT FALSE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pages
CREATE TABLE public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  template TEXT DEFAULT 'default',
  is_active BOOLEAN DEFAULT TRUE,
  show_in_nav BOOLEAN DEFAULT FALSE,
  show_in_footer BOOLEAN DEFAULT FALSE,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  canonical_url TEXT,
  og_image TEXT,
  robots TEXT DEFAULT 'index, follow',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Point Transactions
CREATE TABLE public.point_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  entity_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pricing Features
CREATE TABLE public.pricing_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  name TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Product Pricing Tiers
CREATE TABLE public.product_pricing_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  name TEXT NOT NULL,
  price NUMERIC,
  billing_period TEXT DEFAULT 'monthly',
  is_popular BOOLEAN DEFAULT FALSE,
  cta_text TEXT DEFAULT 'Get Started',
  cta_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pricing Tier Features
CREATE TABLE public.pricing_tier_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id UUID NOT NULL REFERENCES public.product_pricing_tiers(id),
  feature_id UUID NOT NULL REFERENCES public.pricing_features(id),
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Product Changelogs
CREATE TABLE public.product_changelogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  title TEXT NOT NULL,
  body TEXT,
  version TEXT,
  change_type TEXT DEFAULT 'update',
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role app_role DEFAULT 'user',
  reputation_score INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES (recommended)
-- =============================================
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_reviews_product ON public.reviews(product_id);
CREATE INDEX idx_reviews_status ON public.reviews(status);
CREATE INDEX idx_comparisons_slug ON public.comparisons(slug);
CREATE INDEX idx_comparisons_published ON public.comparisons(is_published);
CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_glossary_slug ON public.glossary_terms(slug);
CREATE INDEX idx_discussions_product ON public.discussions(product_id);

-- =============================================
-- DONE! Now import your data using the 
-- export-database edge function INSERT statements.
-- =============================================
