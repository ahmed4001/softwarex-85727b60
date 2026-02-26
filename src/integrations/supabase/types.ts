export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          alt_text: string | null
          clicks: number | null
          created_at: string | null
          ctr: number | null
          end_date: string | null
          id: string
          image_url: string | null
          impressions: number | null
          is_active: boolean | null
          name: string
          placement: Database["public"]["Enums"]["ad_placement"]
          start_date: string | null
          target_url: string | null
          type: Database["public"]["Enums"]["ad_type"]
        }
        Insert: {
          alt_text?: string | null
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          is_active?: boolean | null
          name: string
          placement: Database["public"]["Enums"]["ad_placement"]
          start_date?: string | null
          target_url?: string | null
          type: Database["public"]["Enums"]["ad_type"]
        }
        Update: {
          alt_text?: string | null
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          impressions?: number | null
          is_active?: boolean | null
          name?: string
          placement?: Database["public"]["Enums"]["ad_placement"]
          start_date?: string | null
          target_url?: string | null
          type?: Database["public"]["Enums"]["ad_type"]
        }
        Relationships: []
      }
      alert_history: {
        Row: {
          alert_id: string
          alert_type: string
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          new_value: number | null
          old_value: number | null
          product_id: string
          user_id: string
        }
        Insert: {
          alert_id: string
          alert_type: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          new_value?: number | null
          old_value?: number | null
          product_id: string
          user_id: string
        }
        Update: {
          alert_id?: string
          alert_type?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          new_value?: number | null
          old_value?: number | null
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "price_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      alternatives: {
        Row: {
          alternative_product_id: string
          id: string
          product_id: string
          similarity_score: number | null
        }
        Insert: {
          alternative_product_id: string
          id?: string
          product_id: string
          similarity_score?: number | null
        }
        Update: {
          alternative_product_id?: string
          id?: string
          product_id?: string
          similarity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alternatives_alternative_product_id_fkey"
            columns: ["alternative_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alternatives_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      award_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          year: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          year?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          year?: number
        }
        Relationships: []
      }
      award_nominations: {
        Row: {
          award_category_id: string
          created_at: string
          id: string
          nominated_by: string
          product_id: string
        }
        Insert: {
          award_category_id: string
          created_at?: string
          id?: string
          nominated_by: string
          product_id: string
        }
        Update: {
          award_category_id?: string
          created_at?: string
          id?: string
          nominated_by?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_nominations_award_category_id_fkey"
            columns: ["award_category_id"]
            isOneToOne: false
            referencedRelation: "award_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_nominations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      award_votes: {
        Row: {
          award_category_id: string
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          award_category_id: string
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          award_category_id?: string
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "award_votes_award_category_id_fkey"
            columns: ["award_category_id"]
            isOneToOne: false
            referencedRelation: "award_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "award_votes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          color: string
          created_at: string
          criteria_threshold: number
          criteria_type: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          slug: string
          tier: string
        }
        Insert: {
          color?: string
          created_at?: string
          criteria_threshold?: number
          criteria_type: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          tier?: string
        }
        Update: {
          color?: string
          created_at?: string
          criteria_threshold?: number
          criteria_type?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          tier?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          body: string | null
          canonical_url: string | null
          category: string | null
          created_at: string | null
          excerpt: string | null
          featured_image: string | null
          id: string
          is_featured: boolean | null
          is_pinned: boolean | null
          og_image: string | null
          published_at: string | null
          reading_time: number | null
          scheduled_at: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_status"] | null
          tags: Json | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          canonical_url?: string | null
          category?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_featured?: boolean | null
          is_pinned?: boolean | null
          og_image?: string | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_status"] | null
          tags?: Json | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          body?: string | null
          canonical_url?: string | null
          category?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_featured?: boolean | null
          is_pinned?: boolean | null
          og_image?: string | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_status"] | null
          tags?: Json | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      brevo_accounts: {
        Row: {
          api_key: string
          created_at: string
          credits_reset_at: string | null
          credits_used_today: number | null
          daily_credit_limit: number | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
          total_emails_sent: number | null
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          credits_reset_at?: string | null
          credits_used_today?: number | null
          daily_credit_limit?: number | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
          total_emails_sent?: number | null
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          credits_reset_at?: string | null
          credits_used_today?: number | null
          daily_credit_limit?: number | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
          total_emails_sent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      brevo_campaigns: {
        Row: {
          brevo_account_id: string
          brevo_campaign_id: string | null
          created_at: string
          html_content: string | null
          id: string
          recipients_count: number | null
          sender_email: string
          sender_name: string
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          brevo_account_id: string
          brevo_campaign_id?: string | null
          created_at?: string
          html_content?: string | null
          id?: string
          recipients_count?: number | null
          sender_email: string
          sender_name?: string
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          brevo_account_id?: string
          brevo_campaign_id?: string | null
          created_at?: string
          html_content?: string | null
          id?: string
          recipients_count?: number | null
          sender_email?: string
          sender_name?: string
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brevo_campaigns_brevo_account_id_fkey"
            columns: ["brevo_account_id"]
            isOneToOne: false
            referencedRelation: "brevo_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_guide_completions: {
        Row: {
          answers: Json
          created_at: string
          guide_id: string
          id: string
          recommended_product_ids: Json | null
          user_id: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          guide_id: string
          id?: string
          recommended_product_ids?: Json | null
          user_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          guide_id?: string
          id?: string
          recommended_product_ids?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_guide_completions_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "buyer_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_guides: {
        Row: {
          category_id: string | null
          completion_count: number
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          result_product_ids: Json | null
          slug: string
          steps: Json
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category_id?: string | null
          completion_count?: number
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          result_product_ids?: Json | null
          slug: string
          steps?: Json
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category_id?: string | null
          completion_count?: number
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          result_product_ids?: Json | null
          slug?: string
          steps?: Json
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "buyer_guides_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_image: string | null
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          parent_id: string | null
          product_count: number | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          short_description: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          banner_image?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          parent_id?: string | null
          product_count?: number | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          banner_image?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          parent_id?: string | null
          product_count?: number | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_subscriptions: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          best_for_a: string | null
          best_for_b: string | null
          category_id: string | null
          cons_a: Json | null
          cons_b: Json | null
          created_at: string | null
          feature_scores: Json | null
          id: string
          is_published: boolean | null
          product_a_score: number | null
          product_b_score: number | null
          product_ids: Json
          pros_a: Json | null
          pros_b: Json | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          summary: string | null
          title: string | null
          view_count: number | null
          winner_product_id: string | null
          winner_verdict: string | null
        }
        Insert: {
          best_for_a?: string | null
          best_for_b?: string | null
          category_id?: string | null
          cons_a?: Json | null
          cons_b?: Json | null
          created_at?: string | null
          feature_scores?: Json | null
          id?: string
          is_published?: boolean | null
          product_a_score?: number | null
          product_b_score?: number | null
          product_ids?: Json
          pros_a?: Json | null
          pros_b?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          summary?: string | null
          title?: string | null
          view_count?: number | null
          winner_product_id?: string | null
          winner_verdict?: string | null
        }
        Update: {
          best_for_a?: string | null
          best_for_b?: string | null
          category_id?: string | null
          cons_a?: Json | null
          cons_b?: Json | null
          created_at?: string | null
          feature_scores?: Json | null
          id?: string
          is_published?: boolean | null
          product_a_score?: number | null
          product_b_score?: number | null
          product_ids?: Json
          pros_a?: Json | null
          pros_b?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          summary?: string | null
          title?: string | null
          view_count?: number | null
          winner_product_id?: string | null
          winner_verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_winner_product_id_fkey"
            columns: ["winner_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      competitive_battlecards: {
        Row: {
          competitor_product_id: string
          created_at: string
          generated_at: string | null
          id: string
          objection_handling: Json | null
          product_id: string
          strengths: Json | null
          talking_points: Json | null
          updated_at: string
          vendor_user_id: string
          weaknesses: Json | null
          win_rate: number | null
        }
        Insert: {
          competitor_product_id: string
          created_at?: string
          generated_at?: string | null
          id?: string
          objection_handling?: Json | null
          product_id: string
          strengths?: Json | null
          talking_points?: Json | null
          updated_at?: string
          vendor_user_id: string
          weaknesses?: Json | null
          win_rate?: number | null
        }
        Update: {
          competitor_product_id?: string
          created_at?: string
          generated_at?: string | null
          id?: string
          objection_handling?: Json | null
          product_id?: string
          strengths?: Json | null
          talking_points?: Json | null
          updated_at?: string
          vendor_user_id?: string
          weaknesses?: Json | null
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitive_battlecards_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitive_battlecards_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_logs: {
        Row: {
          id: string
          recipient_count: number
          sent_at: string
          status: string
        }
        Insert: {
          id?: string
          recipient_count?: number
          sent_at?: string
          status?: string
        }
        Update: {
          id?: string
          recipient_count?: number
          sent_at?: string
          status?: string
        }
        Relationships: []
      }
      discussion_replies: {
        Row: {
          body: string
          created_at: string
          discussion_id: string
          id: string
          is_vendor_answer: boolean
          parent_id: string | null
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          discussion_id: string
          id?: string
          is_vendor_answer?: boolean
          parent_id?: string | null
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          discussion_id?: string
          id?: string
          is_vendor_answer?: boolean
          parent_id?: string | null
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_replies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "discussion_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_votes: {
        Row: {
          created_at: string
          discussion_id: string | null
          id: string
          reply_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          discussion_id?: string | null
          id?: string
          reply_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          discussion_id?: string | null
          id?: string
          reply_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_votes_discussion_id_fkey"
            columns: ["discussion_id"]
            isOneToOne: false
            referencedRelation: "discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_votes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "discussion_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      discussions: {
        Row: {
          body: string
          category_id: string | null
          created_at: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          product_id: string | null
          reply_count: number
          title: string
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          body: string
          category_id?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          product_id?: string | null
          reply_count?: number
          title: string
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          body?: string
          category_id?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          product_id?: string | null
          reply_count?: number
          title?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          thumbnail_html: string | null
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          thumbnail_html?: string | null
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          thumbnail_html?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      list_items: {
        Row: {
          created_at: string
          id: string
          list_id: string
          note: string | null
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          note?: string | null
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          note?: string | null
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      list_votes: {
        Row: {
          created_at: string
          id: string
          list_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_votes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          product_count: number
          slug: string
          title: string
          updated_at: string
          upvote_count: number
          user_id: string
          view_count: number
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          product_count?: number
          slug: string
          title: string
          updated_at?: string
          upvote_count?: number
          user_id: string
          view_count?: number
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          product_count?: number
          slug?: string
          title?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      media_library: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string | null
          file_size: number | null
          file_type: string | null
          filename: string
          folder: string | null
          id: string
          mime_type: string | null
          original_name: string | null
          thumbnail_url: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename: string
          folder?: string | null
          id?: string
          mime_type?: string | null
          original_name?: string | null
          thumbnail_url?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string
          folder?: string | null
          id?: string
          mime_type?: string | null
          original_name?: string | null
          thumbnail_url?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          moderator_id: string | null
          moderator_note: string | null
          reason: string
          reported_by: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          moderator_note?: string | null
          reason?: string
          reported_by?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          moderator_note?: string | null
          reason?: string
          reported_by?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          badge_earned: boolean
          created_at: string
          id: string
          new_followers: boolean
          product_updates: boolean
          review_replies: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          badge_earned?: boolean
          created_at?: string
          id?: string
          new_followers?: boolean
          product_updates?: boolean
          review_replies?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          badge_earned?: boolean
          created_at?: string
          id?: string
          new_followers?: boolean
          product_updates?: boolean
          review_replies?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          body: string | null
          canonical_url: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          og_image: string | null
          robots: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          show_in_footer: boolean | null
          show_in_nav: boolean | null
          slug: string
          template: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          canonical_url?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          og_image?: string | null
          robots?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          show_in_footer?: boolean | null
          show_in_nav?: boolean | null
          slug: string
          template?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          canonical_url?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          og_image?: string | null
          robots?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          show_in_footer?: boolean | null
          show_in_nav?: boolean | null
          slug?: string
          template?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          points: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          product_id: string
          threshold_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          product_id: string
          threshold_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          product_id?: string
          threshold_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_features: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_features_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tier_features: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          tier_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          tier_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          tier_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tier_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "pricing_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_tier_features_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "product_pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_changelogs: {
        Row: {
          body: string | null
          change_type: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          product_id: string
          published_at: string | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          body?: string | null
          change_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          product_id: string
          published_at?: string | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          body?: string | null
          change_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          product_id?: string
          published_at?: string | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_changelogs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_claims: {
        Row: {
          admin_note: string | null
          created_at: string
          evidence: string | null
          id: string
          product_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          product_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          evidence?: string | null
          id?: string
          product_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_claims_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_integrations: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          integrates_with_product_id: string
          product_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          integrates_with_product_id: string
          product_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          integrates_with_product_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_integrations_integrates_with_product_id_fkey"
            columns: ["integrates_with_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_integrations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_tiers: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          description: string | null
          id: string
          is_enterprise: boolean | null
          is_popular: boolean | null
          name: string
          period: string | null
          price: number | null
          product_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          id?: string
          is_enterprise?: boolean | null
          is_popular?: boolean | null
          name: string
          period?: string | null
          price?: number | null
          product_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          id?: string
          is_enterprise?: boolean | null
          is_popular?: boolean | null
          name?: string
          period?: string | null
          price?: number | null
          product_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_watches: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          product_id: string | null
          user_id: string
          watch_type: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          user_id: string
          watch_type?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          user_id?: string
          watch_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_watches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_watches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_rating: number | null
          canonical_url: string | null
          category_id: string | null
          click_count: number | null
          company_size: string | null
          comparison_count: number | null
          cons_summary: string | null
          created_at: string | null
          demo_url: string | null
          description: string | null
          employee_count: number | null
          features: Json | null
          founded_year: number | null
          headquarters: string | null
          id: string
          integrations: Json | null
          is_active: boolean | null
          is_claimed: boolean | null
          is_featured: boolean | null
          is_sponsored: boolean | null
          is_verified: boolean | null
          logo_url: string | null
          meta_og_image: string | null
          monthly_visitors: number | null
          name: string
          pricing_description: string | null
          pricing_model: Database["public"]["Enums"]["pricing_model"] | null
          pricing_tiers: Json | null
          pros_summary: string | null
          published_at: string | null
          schema_org: Json | null
          screenshots: Json | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string
          sponsor_end_date: string | null
          sponsor_start_date: string | null
          sponsor_tier: Database["public"]["Enums"]["sponsor_tier"] | null
          starting_price: number | null
          subcategory_id: string | null
          tagline: string | null
          total_reviews: number | null
          total_users: number | null
          updated_at: string | null
          view_count: number | null
          website_url: string | null
        }
        Insert: {
          avg_rating?: number | null
          canonical_url?: string | null
          category_id?: string | null
          click_count?: number | null
          company_size?: string | null
          comparison_count?: number | null
          cons_summary?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          employee_count?: number | null
          features?: Json | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          integrations?: Json | null
          is_active?: boolean | null
          is_claimed?: boolean | null
          is_featured?: boolean | null
          is_sponsored?: boolean | null
          is_verified?: boolean | null
          logo_url?: string | null
          meta_og_image?: string | null
          monthly_visitors?: number | null
          name: string
          pricing_description?: string | null
          pricing_model?: Database["public"]["Enums"]["pricing_model"] | null
          pricing_tiers?: Json | null
          pros_summary?: string | null
          published_at?: string | null
          schema_org?: Json | null
          screenshots?: Json | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug: string
          sponsor_end_date?: string | null
          sponsor_start_date?: string | null
          sponsor_tier?: Database["public"]["Enums"]["sponsor_tier"] | null
          starting_price?: number | null
          subcategory_id?: string | null
          tagline?: string | null
          total_reviews?: number | null
          total_users?: number | null
          updated_at?: string | null
          view_count?: number | null
          website_url?: string | null
        }
        Update: {
          avg_rating?: number | null
          canonical_url?: string | null
          category_id?: string | null
          click_count?: number | null
          company_size?: string | null
          comparison_count?: number | null
          cons_summary?: string | null
          created_at?: string | null
          demo_url?: string | null
          description?: string | null
          employee_count?: number | null
          features?: Json | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          integrations?: Json | null
          is_active?: boolean | null
          is_claimed?: boolean | null
          is_featured?: boolean | null
          is_sponsored?: boolean | null
          is_verified?: boolean | null
          logo_url?: string | null
          meta_og_image?: string | null
          monthly_visitors?: number | null
          name?: string
          pricing_description?: string | null
          pricing_model?: Database["public"]["Enums"]["pricing_model"] | null
          pricing_tiers?: Json | null
          pros_summary?: string | null
          published_at?: string | null
          schema_org?: Json | null
          screenshots?: Json | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string
          sponsor_end_date?: string | null
          sponsor_start_date?: string | null
          sponsor_tier?: Database["public"]["Enums"]["sponsor_tier"] | null
          starting_price?: number | null
          subcategory_id?: string | null
          tagline?: string | null
          total_reviews?: number | null
          total_users?: number | null
          updated_at?: string | null
          view_count?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          bio: string | null
          company: string | null
          company_size: string | null
          created_at: string | null
          email: string | null
          helpful_votes_received: number | null
          id: string
          industry: string | null
          is_banned: boolean | null
          is_verified_reviewer: boolean | null
          job_title: string | null
          last_login_at: string | null
          linkedin_verified: boolean | null
          name: string | null
          preferred_language: string | null
          review_count: number | null
          total_points: number
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string | null
          email?: string | null
          helpful_votes_received?: number | null
          id?: string
          industry?: string | null
          is_banned?: boolean | null
          is_verified_reviewer?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          linkedin_verified?: boolean | null
          name?: string | null
          preferred_language?: string | null
          review_count?: number | null
          total_points?: number
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string | null
          email?: string | null
          helpful_votes_received?: number | null
          id?: string
          industry?: string | null
          is_banned?: boolean | null
          is_verified_reviewer?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          linkedin_verified?: boolean | null
          name?: string | null
          preferred_language?: string | null
          review_count?: number | null
          total_points?: number
          user_id?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          referral_link_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          referral_link_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          referral_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          clicks: number
          code: string
          conversions: number
          created_at: string
          id: string
          is_active: boolean
          product_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number
          code: string
          conversions?: number
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clicks?: number
          code?: string
          conversions?: number
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_payouts: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          referral_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          referral_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          referral_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_digests: {
        Row: {
          avg_sub_ratings: Json | null
          cons_summary: string | null
          created_at: string
          id: string
          overall_verdict: string | null
          product_id: string
          pros_summary: string | null
          review_count: number | null
          sentiment_pct: Json | null
          top_themes: Json | null
          updated_at: string
        }
        Insert: {
          avg_sub_ratings?: Json | null
          cons_summary?: string | null
          created_at?: string
          id?: string
          overall_verdict?: string | null
          product_id: string
          pros_summary?: string | null
          review_count?: number | null
          sentiment_pct?: Json | null
          top_themes?: Json | null
          updated_at?: string
        }
        Update: {
          avg_sub_ratings?: Json | null
          cons_summary?: string | null
          created_at?: string
          id?: string
          overall_verdict?: string | null
          product_id?: string
          pros_summary?: string | null
          review_count?: number | null
          sentiment_pct?: Json | null
          top_themes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_digests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      review_media: {
        Row: {
          alt_text: string | null
          created_at: string
          file_size: number | null
          file_type: string | null
          id: string
          review_id: string
          sort_order: number | null
          url: string
          user_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          review_id: string
          sort_order?: number | null
          url: string
          user_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          review_id?: string
          sort_order?: number | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_media_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_qa: {
        Row: {
          body: string
          created_at: string
          id: string
          is_vendor_answer: boolean
          parent_id: string | null
          product_id: string
          status: string
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_vendor_answer?: boolean
          parent_id?: string | null
          product_id: string
          status?: string
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_vendor_answer?: boolean
          parent_id?: string | null
          product_id?: string
          status?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_qa_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "review_qa"
            referencedColumns: ["id"]
          },
        ]
      }
      review_qa_votes: {
        Row: {
          created_at: string
          id: string
          qa_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          qa_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          qa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_qa_votes_qa_id_fkey"
            columns: ["qa_id"]
            isOneToOne: false
            referencedRelation: "review_qa"
            referencedColumns: ["id"]
          },
        ]
      }
      review_votes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_verifications: {
        Row: {
          created_at: string
          evidence: string | null
          id: string
          method: string
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          evidence?: string | null
          id?: string
          method: string
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          evidence?: string | null
          id?: string
          method?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          company_size: string | null
          cons: string | null
          cons_tags: Json
          created_at: string | null
          customer_support: number | null
          ease_of_use: number | null
          features_rating: number | null
          helpful_count: number | null
          id: string
          industry: string | null
          is_featured_review: boolean | null
          is_pinned: boolean | null
          is_verified_purchase: boolean | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          not_helpful_count: number | null
          overall_rating: number
          product_id: string
          pros: string | null
          pros_tags: Json
          recommendation_likelihood: number | null
          rejection_reason: string | null
          reviewer_role: string | null
          source: Database["public"]["Enums"]["review_source"] | null
          status: Database["public"]["Enums"]["review_status"] | null
          title: string | null
          updated_at: string | null
          usage_duration: string | null
          use_case: string | null
          user_id: string
          value_for_money: number | null
          verification_method: string | null
          verified_purchase: boolean | null
          verified_reviewer: boolean | null
        }
        Insert: {
          body?: string | null
          company_size?: string | null
          cons?: string | null
          cons_tags?: Json
          created_at?: string | null
          customer_support?: number | null
          ease_of_use?: number | null
          features_rating?: number | null
          helpful_count?: number | null
          id?: string
          industry?: string | null
          is_featured_review?: boolean | null
          is_pinned?: boolean | null
          is_verified_purchase?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          not_helpful_count?: number | null
          overall_rating: number
          product_id: string
          pros?: string | null
          pros_tags?: Json
          recommendation_likelihood?: number | null
          rejection_reason?: string | null
          reviewer_role?: string | null
          source?: Database["public"]["Enums"]["review_source"] | null
          status?: Database["public"]["Enums"]["review_status"] | null
          title?: string | null
          updated_at?: string | null
          usage_duration?: string | null
          use_case?: string | null
          user_id: string
          value_for_money?: number | null
          verification_method?: string | null
          verified_purchase?: boolean | null
          verified_reviewer?: boolean | null
        }
        Update: {
          body?: string | null
          company_size?: string | null
          cons?: string | null
          cons_tags?: Json
          created_at?: string | null
          customer_support?: number | null
          ease_of_use?: number | null
          features_rating?: number | null
          helpful_count?: number | null
          id?: string
          industry?: string | null
          is_featured_review?: boolean | null
          is_pinned?: boolean | null
          is_verified_purchase?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          not_helpful_count?: number | null
          overall_rating?: number
          product_id?: string
          pros?: string | null
          pros_tags?: Json
          recommendation_likelihood?: number | null
          rejection_reason?: string | null
          reviewer_role?: string | null
          source?: Database["public"]["Enums"]["review_source"] | null
          status?: Database["public"]["Enums"]["review_status"] | null
          title?: string | null
          updated_at?: string | null
          usage_duration?: string | null
          use_case?: string | null
          user_id?: string
          value_for_money?: number | null
          verification_method?: string | null
          verified_purchase?: boolean | null
          verified_reviewer?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_landing_pages: {
        Row: {
          audience: string | null
          body: string | null
          category_id: string | null
          created_at: string
          id: string
          is_published: boolean
          meta_description: string | null
          product_ids: Json
          slug: string
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          audience?: string | null
          body?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          meta_description?: string | null
          product_ids?: Json
          slug: string
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          audience?: string | null
          body?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          meta_description?: string | null
          product_ids?: Json
          slug?: string
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_landing_pages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string | null
          description: string | null
          group: string | null
          id: string
          key: string
          label: string | null
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          group?: string | null
          id?: string
          key: string
          label?: string | null
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          group?: string | null
          id?: string
          key?: string
          label?: string | null
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      sponsored_bids: {
        Row: {
          bid_amount: number
          category_id: string | null
          clicks: number
          created_at: string
          daily_budget: number
          end_date: string | null
          id: string
          impressions: number
          product_id: string
          start_date: string | null
          status: string
          updated_at: string
          vendor_user_id: string
        }
        Insert: {
          bid_amount?: number
          category_id?: string | null
          clicks?: number
          created_at?: string
          daily_budget?: number
          end_date?: string | null
          id?: string
          impressions?: number
          product_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
          vendor_user_id: string
        }
        Update: {
          bid_amount?: number
          category_id?: string | null
          clicks?: number
          created_at?: string
          daily_budget?: number
          end_date?: string | null
          id?: string
          impressions?: number
          product_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_bids_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_bids_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_stack_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          role_description: string | null
          sort_order: number
          stack_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          role_description?: string | null
          sort_order?: number
          stack_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          role_description?: string | null
          sort_order?: number
          stack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_stack_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_stack_items_stack_id_fkey"
            columns: ["stack_id"]
            isOneToOne: false
            referencedRelation: "tech_stacks"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_stack_votes: {
        Row: {
          created_at: string
          id: string
          stack_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stack_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stack_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_stack_votes_stack_id_fkey"
            columns: ["stack_id"]
            isOneToOne: false
            referencedRelation: "tech_stacks"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_stacks: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
          upvote_count: number
          user_id: string
          view_count: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
          upvote_count?: number
          user_id: string
          view_count?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      ui_translations: {
        Row: {
          created_at: string
          id: string
          lang_code: string
          translations: Json
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          lang_code: string
          translations?: Json
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          id?: string
          lang_code?: string
          translations?: Json
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_recommendations: {
        Row: {
          generated_at: string
          id: string
          product_id: string
          reason: string | null
          score: number
          user_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          product_id: string
          reason?: string | null
          score?: number
          user_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          product_id?: string
          reason?: string | null
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_deals: {
        Row: {
          closed_at: string | null
          competitor_product_id: string | null
          created_at: string
          deal_name: string
          deal_value: number | null
          id: string
          loss_reason: string | null
          notes: string | null
          outcome: string
          product_id: string
          updated_at: string
          vendor_user_id: string
        }
        Insert: {
          closed_at?: string | null
          competitor_product_id?: string | null
          created_at?: string
          deal_name: string
          deal_value?: number | null
          id?: string
          loss_reason?: string | null
          notes?: string | null
          outcome?: string
          product_id: string
          updated_at?: string
          vendor_user_id: string
        }
        Update: {
          closed_at?: string | null
          competitor_product_id?: string | null
          created_at?: string
          deal_name?: string
          deal_value?: number | null
          id?: string
          loss_reason?: string | null
          notes?: string | null
          outcome?: string
          product_id?: string
          updated_at?: string
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_deals_competitor_product_id_fkey"
            columns: ["competitor_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          notes: string | null
          product_id: string
          source: string
          status: string
          updated_at: string
          vendor_user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          product_id: string
          source?: string
          status?: string
          updated_at?: string
          vendor_user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          product_id?: string
          source?: string
          status?: string
          updated_at?: string
          vendor_user_id?: string
        }
        Relationships: []
      }
      vendor_responses: {
        Row: {
          body: string
          created_at: string
          id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_review_responses: {
        Row: {
          body: string
          created_at: string
          id: string
          is_official: boolean
          review_id: string
          updated_at: string
          vendor_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_official?: boolean
          review_id: string
          updated_at?: string
          vendor_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_official?: boolean
          review_id?: string
          updated_at?: string
          vendor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_sponsored_requests: {
        Row: {
          budget: number | null
          created_at: string
          end_date: string | null
          id: string
          product_id: string
          start_date: string | null
          status: string
          tier: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          product_id: string
          start_date?: string | null
          status?: string
          tier: string
          user_id: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          product_id?: string
          start_date?: string | null
          status?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      vendor_submissions: {
        Row: {
          created_at: string | null
          id: string
          product_data: Json
          review_notes: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_data: Json
          review_notes?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_data?: Json
          review_notes?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          user_id?: string
        }
        Relationships: []
      }
      vendor_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          plan: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          plan?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          plan?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_comparisons: {
        Row: {
          best_for_a: string | null
          best_for_b: string | null
          category_id: string | null
          cons_a: Json | null
          cons_b: Json | null
          created_at: string | null
          feature_scores: Json | null
          id: string | null
          is_published: boolean | null
          product_a_score: number | null
          product_b_score: number | null
          product_ids: Json | null
          pros_a: Json | null
          pros_b: Json | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          summary: string | null
          title: string | null
          view_count: number | null
          winner_product_id: string | null
          winner_verdict: string | null
        }
        Insert: {
          best_for_a?: string | null
          best_for_b?: string | null
          category_id?: string | null
          cons_a?: Json | null
          cons_b?: Json | null
          created_at?: string | null
          feature_scores?: Json | null
          id?: string | null
          is_published?: boolean | null
          product_a_score?: number | null
          product_b_score?: number | null
          product_ids?: Json | null
          pros_a?: Json | null
          pros_b?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          summary?: string | null
          title?: string | null
          view_count?: number | null
          winner_product_id?: string | null
          winner_verdict?: string | null
        }
        Update: {
          best_for_a?: string | null
          best_for_b?: string | null
          category_id?: string | null
          cons_a?: Json | null
          cons_b?: Json | null
          created_at?: string | null
          feature_scores?: Json | null
          id?: string | null
          is_published?: boolean | null
          product_a_score?: number | null
          product_b_score?: number | null
          product_ids?: Json | null
          pros_a?: Json | null
          pros_b?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          summary?: string | null
          title?: string | null
          view_count?: number | null
          winner_product_id?: string | null
          winner_verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparisons_winner_product_id_fkey"
            columns: ["winner_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      award_points: {
        Args: {
          _entity_id?: string
          _points: number
          _reason: string
          _user_id: string
        }
        Returns: undefined
      }
      get_best_brevo_account: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_view: { Args: { post_slug: string }; Returns: undefined }
      reset_brevo_daily_credits: { Args: never; Returns: undefined }
    }
    Enums: {
      ad_placement: "homepage" | "category" | "product" | "blog"
      ad_type: "banner" | "sidebar" | "featured_slot"
      app_role: "user" | "vendor" | "admin" | "superadmin"
      blog_status: "draft" | "scheduled" | "published" | "archived"
      pricing_model: "free" | "freemium" | "paid" | "subscription" | "one-time"
      review_source: "organic" | "invited" | "imported"
      review_status: "pending" | "approved" | "rejected" | "spam" | "flagged"
      sponsor_tier: "bronze" | "silver" | "gold"
      submission_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ad_placement: ["homepage", "category", "product", "blog"],
      ad_type: ["banner", "sidebar", "featured_slot"],
      app_role: ["user", "vendor", "admin", "superadmin"],
      blog_status: ["draft", "scheduled", "published", "archived"],
      pricing_model: ["free", "freemium", "paid", "subscription", "one-time"],
      review_source: ["organic", "invited", "imported"],
      review_status: ["pending", "approved", "rejected", "spam", "flagged"],
      sponsor_tier: ["bronze", "silver", "gold"],
      submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const
