import { z } from 'zod';

export const FacebookAccountStatusSchema = z.enum([
  'active',
  'disconnected',
  'expired',
]);
export const FacebookAccountStatusEnum = FacebookAccountStatusSchema.enum;
export type FacebookAccountStatus = z.infer<typeof FacebookAccountStatusSchema>;

export const FacebookAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fbAccountId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  profilePictureUrl: z.string().url().nullable().optional().default(null),
  gender: z.string().max(50).nullable().optional().default(null),
  accountLink: z.string().url().nullable().optional().default(null),
  encryptedAccessToken: z.string().default(''),
  tokenExpiresAt: z.coerce.date().nullable().optional(),
  status: FacebookAccountStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FacebookAccount = z.infer<typeof FacebookAccountSchema>;

export const FacebookAccountLinkedPageSchema = z.object({
  id: z.string().uuid(),
  pageName: z.string().min(1),
  profilePictureUrl: z.string().nullable().optional(),
});

export type FacebookAccountLinkedPage = z.infer<
  typeof FacebookAccountLinkedPageSchema
>;

// Sanitized view model for UI presentation (zero token exposure)
export const FacebookAccountViewSchema = z.object({
  id: z.string().uuid(),
  fbAccountId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  profilePictureUrl: z.string().url().nullable().optional().default(null),
  gender: z.string().max(50).nullable().optional().default(null),
  accountLink: z.string().url().nullable().optional().default(null),
  status: FacebookAccountStatusSchema,
  tokenExpiresAt: z.coerce.date().nullable().optional(),
  connectedPagesCount: z.number().int().nonnegative().default(0),
  connectedPages: z.array(FacebookAccountLinkedPageSchema).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FacebookAccountView = z.infer<typeof FacebookAccountViewSchema>;
export const FacebookAccountSummarySchema = FacebookAccountViewSchema;

export const ListFacebookAccountsResponseSchema = z.object({
  accounts: z.array(FacebookAccountViewSchema),
  total: z.number().int().nonnegative(),
});

export type ListFacebookAccountsResponse = z.infer<
  typeof ListFacebookAccountsResponseSchema
>;


export const FacebookPageStatusSchema = z.enum([
  'active',
  'paused',
  'fb_rate_limited',
  'page_checkpoint',
  'invalid_token',
  'disconnected',
]);
export const FacebookPageStatusEnum = FacebookPageStatusSchema.enum;
export type FacebookPageStatus = z.infer<typeof FacebookPageStatusSchema>;

export const FacebookPageSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  facebookAccountId: z.string().uuid(),
  fbPageId: z.string().min(1).max(100),
  pageName: z.string().min(1).max(255),
  profilePictureUrl: z.string().url().nullable().optional().default(null),
  category: z.string().max(100).nullable().optional(),
  tasks: z.array(z.string()).default([]),
  startingFollowers: z.number().int().nonnegative().default(0),
  currentFollowers: z.number().int().nonnegative().default(0),
  followersCount: z.number().int().nonnegative().default(0),
  encryptedAccessToken: z.string().default(''),
  status: FacebookPageStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FacebookPage = z.infer<typeof FacebookPageSchema>;

// Sanitized view model for Facebook Page (zero token exposure)
export const FacebookPageViewSchema = z.object({
  id: z.string().uuid(),
  facebookAccountId: z.string().uuid(),
  accountDisplayName: z.string().optional(),
  fbPageId: z.string().min(1).max(100),
  pageName: z.string().min(1).max(255),
  profilePictureUrl: z.string().url().nullable().optional().default(null),
  category: z.string().nullable().optional(),
  startingFollowers: z.number().int().nonnegative().default(0),
  currentFollowers: z.number().int().nonnegative().default(0),
  followersGained: z.number().int().default(0),
  followersCount: z.number().int().nonnegative().default(0),
  status: FacebookPageStatusSchema,
  tasks: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  rateLimitedAt: z.coerce.date().nullable().optional(),
});

export type FacebookPageView = z.infer<typeof FacebookPageViewSchema>;

export const ListFacebookPagesResponseSchema = z.object({
  pages: z.array(FacebookPageViewSchema),
  total: z.number().int().nonnegative(),
});

export type ListFacebookPagesResponse = z.infer<
  typeof ListFacebookPagesResponseSchema
>;

export interface FacebookGraphPageItem {
  id: string;
  name?: string;
  category?: string | null;
  tasks?: string[];
  access_token?: string;
  followers_count?: number;
  picture?: {
    data?: {
      url?: string;
    };
  };
  [key: string]: unknown;
}

/**
 * Shared helper for fetching all Facebook Pages via /me/accounts with limit=100
 * and following cursor pagination (paging.next) up to maxPages (default: 5 = 500 pages max).
 */
export async function fetchAllFacebookPages(
  accessToken: string,
  fields: string,
  maxPages = 5,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<FacebookGraphPageItem[]> {
  const allPages: FacebookGraphPageItem[] = [];
  const initialUrl = new URL('https://graph.facebook.com/v26.0/me/accounts');
  initialUrl.searchParams.set('fields', fields);
  initialUrl.searchParams.set('limit', '100');

  let nextUrl: string | null = initialUrl.toString();
  let pagesFetched = 0;

  while (nextUrl && pagesFetched < maxPages) {
    pagesFetched++;
    const res = await fetchFn(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      if (pagesFetched === 1) {
        const err = new Error(`Facebook Graph API returned ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }
      break;
    }

    const json = (await res.json()) as {
      data?: FacebookGraphPageItem[];
      paging?: {
        next?: string;
      };
    };

    if (Array.isArray(json?.data)) {
      for (const item of json.data) {
        if (item && item.id) {
          allPages.push(item);
        }
      }
    }

    nextUrl = json?.paging?.next || null;
  }

  return allPages;
}


// In-memory representation of pages discovered from Graph API /me/accounts
export const DiscoveredPageSchema = z.object({
  fbPageId: z.string().min(1).max(100),
  pageName: z.string().min(1).max(255),
  profilePictureUrl: z.string().url().nullable().optional().default(null),
  category: z.string().nullable().optional(),
  currentFollowers: z.number().int().nonnegative().default(0),
  followersCount: z.number().int().nonnegative().default(0),
  tasks: z.array(z.string()).default([]),
  isImported: z.boolean().default(false),
});

export type DiscoveredPage = z.infer<typeof DiscoveredPageSchema>;

export const DiscoverPagesResponseSchema = z.object({
  accountId: z.string().uuid(),
  accountDisplayName: z.string(),
  pages: z.array(DiscoveredPageSchema),
  total: z.number().int().nonnegative(),
});

export type DiscoverPagesResponse = z.infer<typeof DiscoverPagesResponseSchema>;

// Request schema for selectively importing chosen pages
export const ImportPagesRequestSchema = z.object({
  accountId: z.string().uuid(),
  selectedPageIds: z.array(z.string().min(1).max(100)).min(1),
});

export type ImportPagesRequest = z.infer<typeof ImportPagesRequestSchema>;

export const ImportPagesResponseSchema = z.object({
  success: z.boolean(),
  importedCount: z.number().int().nonnegative(),
  pages: z.array(
    z.object({
      id: z.string().uuid(),
      fbPageId: z.string(),
      pageName: z.string(),
    })
  ),
});

export type ImportPagesResponse = z.infer<typeof ImportPagesResponseSchema>;

export const DisconnectAccountResponseSchema = z.object({
  success: z.boolean(),
  accountId: z.string().uuid(),
  disconnectedPagesCount: z.number().int().nonnegative(),
});

export type DisconnectAccountResponse = z.infer<
  typeof DisconnectAccountResponseSchema
>;

export const DisconnectPageResponseSchema = z.object({
  success: z.boolean(),
  pageId: z.string().uuid(),
});

export type DisconnectPageResponse = z.infer<
  typeof DisconnectPageResponseSchema
>;
