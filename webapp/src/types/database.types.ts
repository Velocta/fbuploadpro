export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      auth_attempts: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
          success: boolean
          type: Database["public"]["Enums"]["auth_attempt_type"]
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
          type: Database["public"]["Enums"]["auth_attempt_type"]
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          type?: Database["public"]["Enums"]["auth_attempt_type"]
        }
        Relationships: []
      }
      facebook_accounts: {
        Row: {
          id: string
          agency_id: string
          fb_user_id: string
          fb_user_name: string | null
          fb_user_image: string | null
          fb_user_access_token: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          agency_id: string
          fb_user_id: string
          fb_user_name?: string | null
          fb_user_image?: string | null
          fb_user_access_token: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          agency_id?: string
          fb_user_id?: string
          fb_user_name?: string | null
          fb_user_image?: string | null
          fb_user_access_token?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facebook_accounts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      pages: {
        Row: {
          agency_id: string
          created_at: string | null
          facebook_account_id: string | null
          fb_page_access_token: string | null
          fb_page_id: string
          fb_page_image: string | null
          followers_count: number | null
          followers_gained: number | null
          id: string
          page_name: string
          posting_times: Json | null
          posts_per_day: number | null
          schedule_type: Database["public"]["Enums"]["schedule_type_enum"] | null
          source_platform:
          | Database["public"]["Enums"]["source_platform_enum"]
          | null
          source_username: string
          status: Database["public"]["Enums"]["profile_status_enum"] | null
          sync_status: Database["public"]["Enums"]["sync_status_enum"] | null
          timezone: string
          updated_at: string | null
          pending_reels_count: number | null
          posted_reels_count: number | null
          failed_reels_count: number | null
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          facebook_account_id?: string | null
          fb_page_access_token?: string | null
          fb_page_id: string
          fb_page_image?: string | null
          followers_count?: number | null
          followers_gained?: number | null
          id?: string
          page_name: string
          posting_times?: Json | null
          posts_per_day?: number | null
          schedule_type?: Database["public"]["Enums"]["schedule_type_enum"] | null
          source_platform?:
          | Database["public"]["Enums"]["source_platform_enum"]
          | null
          source_username: string
          status?: Database["public"]["Enums"]["profile_status_enum"] | null
          sync_status?: Database["public"]["Enums"]["sync_status_enum"] | null
          timezone?: string
          updated_at?: string | null
          pending_reels_count?: number | null
          posted_reels_count?: number | null
          failed_reels_count?: number | null
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          facebook_account_id?: string | null
          fb_page_access_token?: string | null
          fb_page_id?: string
          fb_page_image?: string | null
          followers_count?: number | null
          followers_gained?: number | null
          id?: string
          page_name?: string
          posting_times?: Json | null
          posts_per_day?: number | null
          schedule_type?: Database["public"]["Enums"]["schedule_type_enum"] | null
          source_platform?:
          | Database["public"]["Enums"]["source_platform_enum"]
          | null
          source_username?: string
          status?: Database["public"]["Enums"]["profile_status_enum"] | null
          sync_status?: Database["public"]["Enums"]["sync_status_enum"] | null
          timezone?: string
          updated_at?: string | null
          pending_reels_count?: number | null
          posted_reels_count?: number | null
          failed_reels_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_facebook_account_id_fkey"
            columns: ["facebook_account_id"]
            isOneToOne: false
            referencedRelation: "facebook_accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      reels: {
        Row: {
          id: number
          platform: Database["public"]["Enums"]["platform_enum"] | null
          page_id: string
          reel_id: string
          status: Database["public"]["Enums"]["reel_status_enum"] | null
          username: string
        }
        Insert: {
          id?: number
          platform?: Database["public"]["Enums"]["platform_enum"] | null
          page_id: string
          reel_id: string
          status?: Database["public"]["Enums"]["reel_status_enum"] | null
          username: string
        }
        Update: {
          id?: number
          platform?: Database["public"]["Enums"]["platform_enum"] | null
          page_id?: string
          reel_id?: string
          status?: Database["public"]["Enums"]["reel_status_enum"] | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "reels_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_logs: {
        Row: {
          agency_id: string | null
          amount_paid: number
          created_at: string | null
          id: string
          tokens_allocated_snapshot: number | null
          notes: string | null
          previous_tokens_snapshot: number | null
          type: Database["public"]["Enums"]["subscription_type_enum"]
          agency_name_snapshot: string | null
        }
        Insert: {
          agency_id: string
          amount_paid?: number
          created_at?: string | null
          id?: string
          tokens_allocated_snapshot?: number | null
          notes?: string | null
          previous_tokens_snapshot?: number | null
          type: Database["public"]["Enums"]["subscription_type_enum"]
          agency_name_snapshot?: string | null
        }
        Update: {
          agency_id?: string
          amount_paid?: number
          created_at?: string | null
          id?: string
          tokens_allocated_snapshot?: number | null
          notes?: string | null
          previous_tokens_snapshot?: number | null
          type?: Database["public"]["Enums"]["subscription_type_enum"]
          agency_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          id: number
          token_price_pkr: number
          updated_at: string | null
        }
        Insert: {
          id?: number
          token_price_pkr?: number
          updated_at?: string | null
        }
        Update: {
          id?: number
          token_price_pkr?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          fb_app_id: string | null
          fb_app_name: string | null
          fb_app_secret: string | null
          id: string
          is_active_override: boolean | null
          name: string | null
          phone_number: string
          role: Database["public"]["Enums"]["user_role_enum"]
          tokens_balance: number | null
          subdomain: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          fb_app_id?: string | null
          fb_app_name?: string | null
          fb_app_secret?: string | null
          id: string
          is_active_override?: boolean | null
          name?: string | null
          phone_number?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          tokens_balance?: number | null
          subdomain?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          fb_app_id?: string | null
          fb_app_name?: string | null
          fb_app_secret?: string | null
          id?: string
          is_active_override?: boolean | null
          name?: string | null
          phone_number?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          tokens_balance?: number | null
          subdomain?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      token_cost_rules: {
        Row: {
          id: string
          feature: string
          platform: string
          media_type: string
          source_platform: string | null
          token_cost: number
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          feature: string
          platform: string
          media_type?: string
          source_platform?: string | null
          token_cost?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          feature?: string
          platform?: string
          media_type?: string
          source_platform?: string | null
          token_cost?: number
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      facebook_direct_posts: {
        Row: {
          id: string
          agency_id: string
          facebook_account_id: string | null
          fb_page_id: string
          fb_page_name: string | null
          media_type: string
          caption: string | null
          first_comment: string | null
          graph_post_id: string | null
          status: string
          error_message: string | null
          tokens_charged: number
          created_at: string | null
        }
        Insert: {
          id?: string
          agency_id: string
          facebook_account_id?: string | null
          fb_page_id: string
          fb_page_name?: string | null
          media_type: string
          caption?: string | null
          first_comment?: string | null
          graph_post_id?: string | null
          status?: string
          error_message?: string | null
          tokens_charged?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          agency_id?: string
          facebook_account_id?: string | null
          fb_page_id?: string
          fb_page_name?: string | null
          media_type?: string
          caption?: string | null
          first_comment?: string | null
          graph_post_id?: string | null
          status?: string
          error_message?: string | null
          tokens_charged?: number
          created_at?: string | null
        }
        Relationships: []
      }
      facebook_direct_schedule_pages: {
        Row: {
          id: string
          agency_id: string
          facebook_account_id: string
          fb_page_id: string
          fb_page_name: string | null
          fb_page_image: string | null
          fb_page_access_token: string
          created_at: string | null
        }
        Insert: {
          id?: string
          agency_id: string
          facebook_account_id: string
          fb_page_id: string
          fb_page_name?: string | null
          fb_page_image?: string | null
          fb_page_access_token: string
          created_at?: string | null
        }
        Update: {
          id?: string
          agency_id?: string
          facebook_account_id?: string
          fb_page_id?: string
          fb_page_name?: string | null
          fb_page_image?: string | null
          fb_page_access_token?: string
          created_at?: string | null
        }
        Relationships: []
      }
      facebook_direct_schedule_posts: {
        Row: {
          id: string
          agency_id: string
          page_id: string
          fb_page_id: string
          media_type: string
          media_object_key: string | null
          caption: string | null
          scheduled_publish_time: string
          timezone: string
          status: string
          graph_post_id: string | null
          facebook_schedule_id: string | null
          tokens_charged: number
          error_message: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          agency_id: string
          page_id: string
          fb_page_id: string
          media_type: string
          media_object_key?: string | null
          caption?: string | null
          scheduled_publish_time: string
          timezone?: string
          status?: string
          graph_post_id?: string | null
          facebook_schedule_id?: string | null
          tokens_charged?: number
          error_message?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          agency_id?: string
          page_id?: string
          fb_page_id?: string
          media_type?: string
          media_object_key?: string | null
          caption?: string | null
          scheduled_publish_time?: string
          timezone?: string
          status?: string
          graph_post_id?: string | null
          facebook_schedule_id?: string | null
          tokens_charged?: number
          error_message?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      facebook_inapp_schedule_pages: {
        Row: {
          id: string
          agency_id: string
          facebook_account_id: string
          fb_page_id: string
          fb_page_name: string | null
          fb_page_image: string | null
          fb_page_access_token: string
          created_at: string | null
        }
        Insert: {
          id?: string
          agency_id: string
          facebook_account_id: string
          fb_page_id: string
          fb_page_name?: string | null
          fb_page_image?: string | null
          fb_page_access_token: string
          created_at?: string | null
        }
        Update: {
          id?: string
          agency_id?: string
          facebook_account_id?: string
          fb_page_id?: string
          fb_page_name?: string | null
          fb_page_image?: string | null
          fb_page_access_token?: string
          created_at?: string | null
        }
        Relationships: []
      }
      facebook_inapp_schedule_posts: {
        Row: {
          id: string
          agency_id: string
          page_id: string
          fb_page_id: string
          fb_page_access_token: string
          media_type: string
          media_object_key: string | null
          caption: string | null
          first_comment: string | null
          scheduled_at: string
          timezone: string
          status: string
          retry_count: number
          graph_post_id: string | null
          tokens_charged: number
          published_at: string | null
          error_message: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          agency_id: string
          page_id: string
          fb_page_id: string
          fb_page_access_token: string
          media_type: string
          media_object_key?: string | null
          caption?: string | null
          first_comment?: string | null
          scheduled_at: string
          timezone?: string
          status?: string
          retry_count?: number
          graph_post_id?: string | null
          tokens_charged?: number
          published_at?: string | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          agency_id?: string
          page_id?: string
          fb_page_id?: string
          fb_page_access_token?: string
          media_type?: string
          media_object_key?: string | null
          caption?: string | null
          first_comment?: string | null
          scheduled_at?: string
          timezone?: string
          status?: string
          retry_count?: number
          graph_post_id?: string | null
          tokens_charged?: number
          published_at?: string | null
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role_enum"]
      }
      get_tokens_used_since: {
        Args: { p_since: string }
        Returns: number
      }
      claim_due_facebook_inapp_schedule_posts: {
        Args: { p_limit?: number }
        Returns: Database['public']['Tables']['facebook_inapp_schedule_posts']['Row'][]
      }
    }
    Enums: {
      auth_attempt_type: "login" | "forgot_password" | "otp" | "signup" | "resend"
      platform_enum: "instagram" | "youtube" | "tiktok" | "facebook"
      profile_status_enum:
      | "active"
      | "inactive"
      | "fb_verification_required"
      | "invalid_token"
      | "invalid_username"
      | "completed"
      | "2fa_required_on_BM"
      | "check_developer_app"
      | "account_suspended"
      reel_status_enum: "pending" | "posted" | "failed"
      schedule_type_enum: "fixed" | "randomfixed" | "dailyrandom"
      source_platform_enum: "instagram" | "youtube" | "tiktok" | "facebook"
      subscription_type_enum: "new" | "renewal" | "upgrade" | "correction"
      sync_status_enum: "pending" | "synced" | "processing" | "error"
      user_role_enum: "super_admin" | "agency"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
  | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
  | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
  ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
    Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
    PublicSchema["Views"])
  ? (PublicSchema["Tables"] &
    PublicSchema["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never



