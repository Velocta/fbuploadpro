export interface DatabaseUserRow {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'seller' | 'admin';
  status: 'active' | 'suspended';
  phone: string | null;
  normalized_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseWorkspaceRow {
  id: string;
  owner_id: string;
  name: string;
  subdomain: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseWorkspaceByocCredentialsRow {
  id: string;
  workspace_id: string;
  user_id: string;
  fb_app_id: string;
  encrypted_fb_app_secret: string;
  status: 'unverified' | 'valid' | 'invalid';
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseFacebookAccountRow {
  id: string;
  user_id: string;
  workspace_id: string;
  fb_account_id: string;
  display_name: string;
  status: 'active' | 'disconnected' | 'expired';
  encrypted_access_token: string;
  token_expires_at: string | null;
  profile_picture_url: string | null;
  gender: string | null;
  account_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseFacebookPageRow {
  id: string;
  user_id: string;
  workspace_id: string;
  facebook_account_id: string;
  fb_page_id: string;
  page_name: string;
  status: 'active' | 'paused' | 'fb_rate_limited' | 'page_checkpoint' | 'invalid_token' | 'disconnected';
  encrypted_access_token: string;
  category: string | null;
  tasks: unknown[];
  profile_picture_url: string | null;
  starting_followers: number;
  current_followers: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMediaFolderRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMediaItemRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  folder_id: string | null;
  name: string;
  file_size: number;
  mime_type: string;
  media_type: 'video' | 'image';
  storage_key: string;
  url: string;
  thumbnail_key: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  aspect_ratio: string;
  caption_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabasePageQueueSlotRow {
  id: string;
  user_id: string;
  fb_page_id: string;
  slot_time: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseQueueItemRow {
  id: string;
  user_id: string;
  fb_page_id: string;
  slot_id: string | null;
  media_id: string;
  scheduled_time: string;
  caption: string;
  first_comment: string | null;
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'skipped';
  retry_count: number;
  max_retries: number;
  fb_post_id: string | null;
  fb_comment_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabasePublishLogRow {
  id: string;
  user_id: string;
  queue_item_id: string;
  fb_page_id: string;
  status: 'success' | 'failure' | 'retry';
  attempt_number: number;
  fb_response_code: number | null;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  created_at: string;
}

export interface DatabasePageInsightsDailySnapshotRow {
  id: string;
  user_id: string;
  fb_page_id: string;
  snapshot_date: string;
  fan_count: number | string;
  followers_count: number | string;
  daily_follows: number;
  daily_unfollows: number;
  media_views: number;
  video_views: number;
  video_complete_views_30s: number;
  video_view_time_seconds: number | string;
  reactions_summary: Record<string, number>;
  demographics_summary: {
    topCountries?: Array<{ name: string; count: number; percentage: number }>;
    topCities?: Array<{ name: string; count: number; percentage: number }>;
  };
  created_at: string;
  updated_at: string;
}

export interface ClaimedQueueItemRpcResult {
  id: string;
  user_id: string;
  fb_page_id: string;
  media_id: string;
  caption: string;
  first_comment: string | null;
  retry_count: number;
  max_retries: number;
  media_type: 'video' | 'image';
  media_url: string;
  storage_key: string;
  external_page_id: string;
  encrypted_access_token: string;
  page_name: string;
}

/**
 * Generic Supabase Database type mapping for type-safe SupabaseClient<Database>
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: DatabaseUserRow;
        Insert: Partial<DatabaseUserRow> & { email: string };
        Update: Partial<DatabaseUserRow>;
      };
      workspaces: {
        Row: DatabaseWorkspaceRow;
        Insert: Partial<DatabaseWorkspaceRow> & { owner_id: string; name: string; subdomain: string };
        Update: Partial<DatabaseWorkspaceRow>;
      };
      workspace_byoc_credentials: {
        Row: DatabaseWorkspaceByocCredentialsRow;
        Insert: Partial<DatabaseWorkspaceByocCredentialsRow> & {
          workspace_id: string;
          user_id: string;
          fb_app_id: string;
          encrypted_fb_app_secret: string;
        };
        Update: Partial<DatabaseWorkspaceByocCredentialsRow>;
      };
      facebook_accounts: {
        Row: DatabaseFacebookAccountRow;
        Insert: Partial<DatabaseFacebookAccountRow> & {
          user_id: string;
          workspace_id?: string;
          fb_account_id: string;
          display_name: string;
          encrypted_access_token: string;
        };
        Update: Partial<DatabaseFacebookAccountRow>;
      };
      facebook_pages: {
        Row: DatabaseFacebookPageRow;
        Insert: Partial<DatabaseFacebookPageRow> & {
          user_id: string;
          workspace_id?: string;
          facebook_account_id: string;
          fb_page_id: string;
          page_name: string;
          encrypted_access_token: string;
        };
        Update: Partial<DatabaseFacebookPageRow>;
      };
      media_folders: {
        Row: DatabaseMediaFolderRow;
        Insert: Partial<DatabaseMediaFolderRow> & { user_id: string; workspace_id?: string; name: string };
        Update: Partial<DatabaseMediaFolderRow>;
      };
      media_items: {
        Row: DatabaseMediaItemRow;
        Insert: Partial<DatabaseMediaItemRow> & {
          user_id: string;
          workspace_id?: string;
          name: string;
          file_size: number;
          mime_type: string;
          media_type: 'video' | 'image';
          storage_key: string;
          url: string;
        };
        Update: Partial<DatabaseMediaItemRow>;
      };
      page_queue_slots: {
        Row: DatabasePageQueueSlotRow;
        Insert: Partial<DatabasePageQueueSlotRow> & {
          user_id: string;
          fb_page_id: string;
          slot_time: string;
        };
        Update: Partial<DatabasePageQueueSlotRow>;
      };
      queue_items: {
        Row: DatabaseQueueItemRow;
        Insert: Partial<DatabaseQueueItemRow> & {
          user_id: string;
          fb_page_id: string;
          media_id: string;
          scheduled_time: string;
        };
        Update: Partial<DatabaseQueueItemRow>;
      };
      publish_logs: {
        Row: DatabasePublishLogRow;
        Insert: Partial<DatabasePublishLogRow> & {
          user_id: string;
          queue_item_id: string;
          fb_page_id: string;
          status: 'success' | 'failure' | 'retry';
        };
        Update: Partial<DatabasePublishLogRow>;
      };
      page_insights_daily_snapshots: {
        Row: DatabasePageInsightsDailySnapshotRow;
        Insert: Partial<DatabasePageInsightsDailySnapshotRow> & {
          user_id: string;
          fb_page_id: string;
          snapshot_date: string;
        };
        Update: Partial<DatabasePageInsightsDailySnapshotRow>;
      };
    };
    Functions: {
      claim_due_queue_items: {
        Args: { p_limit?: number };
        Returns: ClaimedQueueItemRpcResult[];
      };
    };
  };
}

export interface DatabaseClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
  withTransaction?<T>(callback: (client: any) => Promise<T>): Promise<T>;
  upsertPageInsightsSnapshot?(snapshot: import('./insights.js').PageInsightsDailySnapshot): Promise<void>;
  getPageInsightsSnapshots?(userId: string, fbPageId: string, sinceDate: string, untilDate: string): Promise<DatabasePageInsightsDailySnapshotRow[]>;
  close?(): Promise<void>;
}
