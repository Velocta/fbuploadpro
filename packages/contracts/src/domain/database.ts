import { z } from 'zod';

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
  timezone?: string;
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
  timezone?: string;
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

/** Platforms supported by the unified schema (spec 119 §4.1, spec 120). */
export const PlatformSchema = z.enum([
  'facebook',
  'instagram',
  'threads',
  'youtube',
  'x',
  'tiktok',
]);

export type Platform = z.infer<typeof PlatformSchema>;

export interface DatabasePlatformCredentialsRow {
  id: string;
  workspace_id: string;
  platform: Platform;
  client_id: string;
  encrypted_client_secret: string;
  status: 'unverified' | 'valid' | 'invalid';
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Runtime schema for a `social_accounts` row (migration
 * 20261022120000 §4b). Snake-case keys mirror the real table exactly:
 * `scopes` is TEXT[] (nullable), `metadata` is JSONB NOT NULL, and
 * `status` uses the unified account vocabulary
 * ('active' | 'expired' | 'revoked' | 'error').
 */
export const DatabaseSocialAccountRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  platform: PlatformSchema,
  external_account_id: z.string().min(1).max(255),
  display_name: z.string().min(1).max(255),
  avatar_url: z.string().nullable(),
  encrypted_access_token: z.string().min(1),
  encrypted_refresh_token: z.string().nullable(),
  token_expires_at: z.string().datetime({ offset: true }).nullable(),
  scopes: z.array(z.string()).nullable(),
  status: z.enum(['active', 'expired', 'revoked', 'error']),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type DatabaseSocialAccountRow = z.infer<typeof DatabaseSocialAccountRowSchema>;

/**
 * Runtime schema for a `destinations` row (migration
 * 20261022120000 §4c). `rate_usage_pct` is SMALLINT with a 0–100 CHECK,
 * `timezone` is VARCHAR(50), and `encrypted_destination_token` is the
 * only nullable token column.
 */
export const DatabaseDestinationRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  account_id: z.string().uuid(),
  platform: PlatformSchema,
  external_destination_id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  handle: z.string().max(255).nullable(),
  avatar_url: z.string().nullable(),
  timezone: z.string().min(1).max(50),
  status: z.enum(['active', 'rate_limited', 'disconnected', 'error']),
  encrypted_destination_token: z.string().nullable(),
  next_allowed_publish_at: z.string().datetime({ offset: true }).nullable(),
  rate_usage_pct: z.number().int().min(0).max(100),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type DatabaseDestinationRow = z.infer<typeof DatabaseDestinationRowSchema>;

export interface DatabasePostingSlotRow {
  id: string;
  destination_id: string;
  /** Format coverage, carried verbatim from page_queue_slots.allowed_formats. */
  kind: string[];
  time_of_day: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Runtime schema for a unified `queue_items` row (migration
 * 20261022120000 §4e). Snake-case keys mirror the real table exactly.
 * Note the drift this guards: the unified status vocabulary has NO
 * 'skipped' (legacy 'skipped' backfilled to 'cancelled'), `kind` has
 * NO 'reel' (reels are kind 'video' with platform_format 'reel'), and
 * the error columns are TEXT, not numeric.
 */
export const DatabaseUnifiedQueueItemRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  destination_id: z.string().uuid(),
  platform: PlatformSchema,
  kind: z.enum(['text', 'image', 'video', 'story', 'carousel']),
  platform_format: z.string().max(50).nullable(),
  caption: z.string(),
  title: z.string().nullable(),
  first_comment: z.string().nullable(),
  media_item_id: z.string().uuid().nullable(),
  media_url: z.string().nullable(),
  media_storage_key: z.string().max(500).nullable(),
  link_url: z.string().nullable(),
  platform_options: z.record(z.unknown()),
  scheduled_time: z.string().datetime({ offset: true }),
  slot_id: z.string().uuid().nullable(),
  status: z.enum(['queued', 'publishing', 'published', 'failed', 'cancelled']),
  claimed_at: z.string().datetime({ offset: true }).nullable(),
  retry_count: z.number().int().nonnegative(),
  max_retries: z.number().int().nonnegative(),
  error_code: z.string().nullable(),
  error_subcode: z.string().nullable(),
  error_message: z.string().nullable(),
  external_post_id: z.string().max(255).nullable(),
  external_comment_id: z.string().max(255).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type DatabaseUnifiedQueueItemRow = z.infer<typeof DatabaseUnifiedQueueItemRowSchema>;

export interface DatabaseUnifiedPublishLogRow {
  id: string;
  queue_item_id: string;
  destination_id: string;
  platform: Platform;
  attempt_no: number;
  result: 'success' | 'retry' | 'failure';
  external_post_id: string | null;
  response_code: number | null;
  response_message: string | null;
  duration_ms: number | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface ClaimedUnifiedQueueItemRpcResult {
  id: string;
  workspace_id: string;
  destination_id: string;
  account_id: string;
  media_item_id: string | null;
  kind: string;
  platform_format: string | null;
  link_url: string | null;
  caption: string;
  title: string | null;
  first_comment: string | null;
  platform_options: Record<string, unknown>;
  scheduled_time: string;
  status: string;
  claimed_at: string | null;
  retry_count: number;
  max_retries: number;
  external_post_id: string | null;
  external_comment_id: string | null;
  created_at: string;
  updated_at: string;
  external_destination_id: string;
  encrypted_access_token: string;
  encrypted_destination_token: string | null;
  destination_name: string;
  media_type: string | null;
  media_url: string | null;
  media_storage_key: string | null;
}

/**
 * Argument shapes for the NEW unified-schema RPC overloads (spec 119 §4.2,
 * migrations 20261022120000 §6 + 20261022140000). `Database.Functions`
 * below records THESE unified signatures, because production call sites
 * (worker claimer/consumers) call the unified overloads. A single
 * `Functions` record cannot express two overloads under one name, so
 * the legacy overload shapes are kept as the named `*LegacyArgs`
 * interfaces below — the legacy RPCs are still present in the database
 * (spec 117 locked them; spec 120 re-pointed them at the legacy tables)
 * and are still exercised by raw-SQL checks.
 */
export interface ClaimDueQueueItemsUnifiedArgs {
  p_platform: Platform;
  /**
   * Required in the real signature: `p_lane_kind_set TEXT[]` has NO
   * default in the migration (unlike p_limit / p_max_per_destination).
   * It is nullable — NULL (or an empty array) claims every kind.
   */
  p_lane_kind_set: string[] | null;
  p_limit?: number;
  p_max_per_destination?: number;
}

export interface SettleQueueItemOutcomeUnifiedArgs {
  p_queue_item_id: string;
  p_workspace_id: string;
  p_destination_id: string;
  p_outcome_status: string;
  p_external_post_id?: string | null;
  p_external_comment_id?: string | null;
  p_retry_count?: number;
  p_retry_delay_seconds?: number;
  p_error_code?: string | null;
  p_error_subcode?: string | null;
  p_error_message?: string | null;
  p_comment_warning?: string | null;
  p_target_destination_status?: string | null;
  p_target_account_status?: string | null;
  p_destination_cooldown_seconds?: number | null;
  p_rate_usage_pct?: number | null;
  /**
   * Platform session state persisted to `publish_logs.detail`
   * (PublishOutcome.detail). Optional: a parallel migration adds the
   * `p_detail` parameter with a NULL default, so passing it is safe
   * against both the current and the extended RPC.
   */
  p_detail?: Record<string, unknown> | null;
}

export interface RecoverStuckPublishingItemsUnifiedArgs {
  p_platform: Platform;
  p_timeout_minutes?: number;
}

/** Legacy claim overload: claim_due_queue_items(INT, INT) on legacy_queue_items. */
export interface ClaimDueQueueItemsLegacyArgs {
  p_limit?: number;
  p_max_per_page?: number;
}

/** Legacy settle overload (16 args): numeric error codes, page vocabulary. */
export interface SettleQueueItemOutcomeLegacyArgs {
  p_queue_item_id: string;
  p_user_id: string;
  p_fb_page_id: string;
  p_outcome_status: string;
  p_fb_post_id?: string | null;
  p_fb_comment_id?: string | null;
  p_retry_count?: number;
  p_retry_delay_seconds?: number;
  p_error_code?: number | null;
  p_error_subcode?: number | null;
  p_error_message?: string | null;
  p_comment_warning?: string | null;
  p_target_page_status?: string | null;
  p_target_account_status?: string | null;
  p_page_cooldown_seconds?: number | null;
  p_buc_usage_pct?: number | null;
}

/** Legacy recover overload: recover_stuck_publishing_items(INT). */
export interface RecoverStuckPublishingItemsLegacyArgs {
  p_timeout_minutes?: number;
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
      legacy_queue_items: {
        Row: DatabaseQueueItemRow;
        Insert: Partial<DatabaseQueueItemRow> & {
          user_id: string;
          fb_page_id: string;
          media_id: string;
          scheduled_time: string;
        };
        Update: Partial<DatabaseQueueItemRow>;
      };
      legacy_publish_logs: {
        Row: DatabasePublishLogRow;
        Insert: Partial<DatabasePublishLogRow> & {
          user_id: string;
          queue_item_id: string;
          fb_page_id: string;
          status: 'success' | 'failure' | 'retry';
        };
        Update: Partial<DatabasePublishLogRow>;
      };
      platform_credentials: {
        Row: DatabasePlatformCredentialsRow;
        Insert: Partial<DatabasePlatformCredentialsRow> & {
          workspace_id: string;
          platform: Platform;
          client_id: string;
          encrypted_client_secret: string;
        };
        Update: Partial<DatabasePlatformCredentialsRow>;
      };
      social_accounts: {
        Row: DatabaseSocialAccountRow;
        Insert: Partial<DatabaseSocialAccountRow> & {
          workspace_id: string;
          platform: Platform;
          external_account_id: string;
          display_name: string;
          encrypted_access_token: string;
        };
        Update: Partial<DatabaseSocialAccountRow>;
      };
      destinations: {
        Row: DatabaseDestinationRow;
        Insert: Partial<DatabaseDestinationRow> & {
          workspace_id: string;
          account_id: string;
          platform: Platform;
          external_destination_id: string;
          name: string;
        };
        Update: Partial<DatabaseDestinationRow>;
      };
      posting_slots: {
        Row: DatabasePostingSlotRow;
        Insert: Partial<DatabasePostingSlotRow> & {
          destination_id: string;
          time_of_day: string;
        };
        Update: Partial<DatabasePostingSlotRow>;
      };
      queue_items: {
        Row: DatabaseUnifiedQueueItemRow;
        Insert: Partial<DatabaseUnifiedQueueItemRow> & {
          workspace_id: string;
          destination_id: string;
          platform: Platform;
          kind: DatabaseUnifiedQueueItemRow['kind'];
          scheduled_time: string;
        };
        Update: Partial<DatabaseUnifiedQueueItemRow>;
      };
      publish_logs: {
        Row: DatabaseUnifiedPublishLogRow;
        Insert: Partial<DatabaseUnifiedPublishLogRow> & {
          queue_item_id: string;
          destination_id: string;
          platform: Platform;
          result: DatabaseUnifiedPublishLogRow['result'];
        };
        Update: Partial<DatabaseUnifiedPublishLogRow>;
      };
    };
    Functions: {
      claim_due_queue_items: {
        Args: ClaimDueQueueItemsUnifiedArgs;
        Returns: ClaimedUnifiedQueueItemRpcResult[];
      };
      settle_queue_item_outcome: {
        Args: SettleQueueItemOutcomeUnifiedArgs;
        Returns: void;
      };
      recover_stuck_publishing_items: {
        Args: RecoverStuckPublishingItemsUnifiedArgs;
        Returns: number;
      };
    };
  };
}

export interface DatabaseClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
  withTransaction?<T>(callback: (client: any) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}
