import type { TikTokPrivacy } from '@fbuploadpro/contracts';
import {
  PostForMeClient,
  POST_FOR_ME_PROVIDER_NAME,
} from './post-for-me.js';

// ==========================================
// Post for Me — TikTok calls (spec 126, D1)
// ==========================================
//
// The TikTok-specific calls built on the shared Post for Me base
// (post-for-me.ts). Everything here is written to Post for Me's
// public API documentation (api.postforme.dev + the provider's
// TikTok verification record in spec 119's research); items the docs
// do not pin down are marked ASSUMPTION and listed as
// live-verification-pending in the spec 126 PR.
//
// Documented:
//   - POST /v1/social-accounts/auth-url { platform } -> { url }
//     (the provider-hosted link flow entry point)
//   - GET  /v1/social-accounts?platform=tiktok -> { data: [...] }
//   - POST /v1/social-posts { caption, social_accounts, media:
//     [{ url }], platform_configurations: { tiktok: {...} } } —
//     media is ingested from a public URL (the provider fetches the
//     asset during publishing); a presigned-upload flow also exists
//     but v1 publishes by URL, exactly like spec 125's YouTube.
//   - The TikTok configuration (`TiktokConfigurationDto`):
//     `privacy_status` is one of public / private / followers /
//     friends (default public); `allow_comment`, `allow_duet`,
//     `allow_stitch`, `is_ai_generated`, `auto_add_music` are the
//     reaction/disclosure toggles; `is_draft` asks TikTok to create
//     an in-app draft instead of posting (default false — and this
//     module NEVER sets it true; see publishers/tiktok.ts).
//   - GET  /v1/social-post-results?post_id=... — per-account results
//     carrying `success`, `error`, and `platform_data` (incl. the
//     post URL).
//   - The provider's own posting code treats a non-draft post that
//     TikTok lands as SEND_TO_USER_INBOX as a FAILURE ("TikTok
//     publication could not be confirmed") — the settlement rules in
//     publishers/tiktok.ts mirror that.
//
// ASSUMPTION (live-verification-pending): the exact fields a result's
// `platform_data` carries back for TikTok (the post URL is
// documented; an applied-privacy echo is read flexibly when present),
// and the singular GET /v1/social-posts/{id} +
// GET /v1/social-accounts/{id} reads.

export { POST_FOR_ME_PROVIDER_NAME };

/** A connected account as the provider lists it. Extra fields pass through. */
export interface PostForMeSocialAccount {
  id: string;
  platform?: string;
  username?: string | null;
  display_name?: string | null;
  platform_account_id?: string | null;
  external_account_id?: string | null;
  [key: string]: unknown;
}

export interface PostForMeMediaInput {
  url: string;
  thumbnail_url?: string;
}

/** The TikTok block of `platform_configurations` on a create-post call. */
export interface PostForMeTikTokConfiguration {
  title?: string;
  privacy_status: TikTokPrivacy;
  allow_comment?: boolean;
  allow_duet?: boolean;
  allow_stitch?: boolean;
  is_ai_generated?: boolean;
  /**
   * Always false — never omitted, never true. Draft/inbox delivery
   * contradicts the product promise (the post goes live while you
   * sleep); spec 126 keeps it out of scope for v1.
   */
  is_draft: false;
  auto_add_music?: boolean;
}

export interface CreatePostForMeTikTokPostInput {
  socialAccountId: string;
  caption: string;
  media: PostForMeMediaInput[];
  tiktok: PostForMeTikTokConfiguration;
}

export interface PostForMeSocialPost {
  id: string;
  status?: string;
  caption?: string;
  platform_data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PostForMePostResult {
  id: string;
  post_id: string;
  social_account_id: string;
  success: boolean;
  error?: unknown;
  details?: unknown;
  platform_data?: Record<string, unknown>;
  media?: unknown;
  [key: string]: unknown;
}

/** The calls the TikTok publisher depends on — mockable in tests. */
export interface IPostForMeTikTokClient {
  createAuthUrl(input: {
    platform: string;
    redirectUrl?: string;
  }): Promise<{ url: string }>;
  listSocialAccounts(platform: string): Promise<PostForMeSocialAccount[]>;
  getSocialAccount(id: string): Promise<PostForMeSocialAccount | null>;
  createPost(
    input: CreatePostForMeTikTokPostInput
  ): Promise<PostForMeSocialPost>;
  getPost(id: string): Promise<PostForMeSocialPost | null>;
  listPostResults(filter: {
    postId?: string;
    socialAccountId?: string;
  }): Promise<PostForMePostResult[]>;
}

function unwrapList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  const record = response as Record<string, unknown> | null;
  if (record && Array.isArray(record.data)) return record.data as T[];
  return [];
}

function unwrapEntity<T>(response: unknown): T {
  const record = response as Record<string, unknown> | null;
  if (record && typeof record.data === 'object' && record.data !== null) {
    return record.data as T;
  }
  return response as T;
}

export class PostForMeTikTokClient implements IPostForMeTikTokClient {
  private readonly client: PostForMeClient;

  constructor(client: PostForMeClient) {
    this.client = client;
  }

  /** Starts the provider-hosted link flow for one platform. */
  async createAuthUrl(input: {
    platform: string;
    redirectUrl?: string;
  }): Promise<{ url: string }> {
    const response = await this.client.post<{ url: string }>(
      '/social-accounts/auth-url',
      {
        platform: input.platform,
        // ASSUMPTION (live-verification-pending): the generated SDK
        // references name this `redirect_url_override` (accepted on
        // white-label projects; Quickstart projects configure the
        // redirect URL in the provider dashboard instead).
        ...(input.redirectUrl
          ? { redirect_url_override: input.redirectUrl }
          : {}),
      }
    );
    return unwrapEntity<{ url: string }>(response);
  }

  async listSocialAccounts(
    platform: string
  ): Promise<PostForMeSocialAccount[]> {
    const response = await this.client.get<unknown>(
      `/social-accounts?platform=${encodeURIComponent(platform)}`
    );
    return unwrapList<PostForMeSocialAccount>(response);
  }

  /** Reads one connected account back by its provider id (null when absent). */
  async getSocialAccount(
    id: string
  ): Promise<PostForMeSocialAccount | null> {
    try {
      const response = await this.client.get<unknown>(
        `/social-accounts/${encodeURIComponent(id)}`
      );
      return unwrapEntity<PostForMeSocialAccount>(response);
    } catch {
      // ASSUMPTION: the singular read may not exist for every plan;
      // fall back to the documented list endpoint and match by id.
      const accounts = await this.listSocialAccounts('tiktok');
      return accounts.find((account) => account.id === id) ?? null;
    }
  }

  async createPost(
    input: CreatePostForMeTikTokPostInput
  ): Promise<PostForMeSocialPost> {
    const response = await this.client.post<unknown>('/social-posts', {
      caption: input.caption,
      social_accounts: [input.socialAccountId],
      media: input.media,
      platform_configurations: { tiktok: input.tiktok },
    });
    return unwrapEntity<PostForMeSocialPost>(response);
  }

  async getPost(id: string): Promise<PostForMeSocialPost | null> {
    const response = await this.client.get<unknown>(
      `/social-posts/${encodeURIComponent(id)}`
    );
    if (response === null || response === undefined) return null;
    return unwrapEntity<PostForMeSocialPost>(response);
  }

  async listPostResults(filter: {
    postId?: string;
    socialAccountId?: string;
  }): Promise<PostForMePostResult[]> {
    const params = new URLSearchParams();
    if (filter.postId) params.set('post_id', filter.postId);
    if (filter.socialAccountId) {
      params.set('social_account_id', filter.socialAccountId);
    }
    const query = params.toString();
    const response = await this.client.get<unknown>(
      `/social-post-results${query ? `?${query}` : ''}`
    );
    return unwrapList<PostForMePostResult>(response);
  }
}
