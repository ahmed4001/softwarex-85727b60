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
      comparisons: {
        Row: {
          created_at: string | null
          id: string
          is_published: boolean | null
          product_ids: Json
          title: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          product_ids?: Json
          title?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          product_ids?: Json
          title?: string | null
          view_count?: number | null
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
          created_at: string | null
          id: string
          is_active: boolean | null
          seo_description: string | null
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
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          seo_description?: string | null
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
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          seo_description?: string | null
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
          name: string | null
          review_count: number | null
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
          name?: string | null
          review_count?: number | null
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
          name?: string | null
          review_count?: number | null
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
      reviews: {
        Row: {
          body: string | null
          company_size: string | null
          cons: string | null
          created_at: string | null
          customer_support: number | null
          ease_of_use: number | null
          features_rating: number | null
          helpful_count: number | null
          id: string
          industry: string | null
          is_featured_review: boolean | null
          is_pinned: boolean | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          not_helpful_count: number | null
          overall_rating: number
          product_id: string
          pros: string | null
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
          verified_purchase: boolean | null
          verified_reviewer: boolean | null
        }
        Insert: {
          body?: string | null
          company_size?: string | null
          cons?: string | null
          created_at?: string | null
          customer_support?: number | null
          ease_of_use?: number | null
          features_rating?: number | null
          helpful_count?: number | null
          id?: string
          industry?: string | null
          is_featured_review?: boolean | null
          is_pinned?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          not_helpful_count?: number | null
          overall_rating: number
          product_id: string
          pros?: string | null
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
          verified_purchase?: boolean | null
          verified_reviewer?: boolean | null
        }
        Update: {
          body?: string | null
          company_size?: string | null
          cons?: string | null
          created_at?: string | null
          customer_support?: number | null
          ease_of_use?: number | null
          features_rating?: number | null
          helpful_count?: number | null
          id?: string
          industry?: string | null
          is_featured_review?: boolean | null
          is_pinned?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          not_helpful_count?: number | null
          overall_rating?: number
          product_id?: string
          pros?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
