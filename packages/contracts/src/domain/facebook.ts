import { z } from 'zod';

export const FacebookAccountStatusSchema = z.enum([
  'active',
  'disconnected',
  'expired',
]);
export type FacebookAccountStatus = z.infer<typeof FacebookAccountStatusSchema>;

export const FacebookAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fbAccountId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  encryptedAccessToken: z.string().default(''),
  tokenExpiresAt: z.coerce.date().nullable().optional(),
  status: FacebookAccountStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FacebookAccount = z.infer<typeof FacebookAccountSchema>;

// Sanitized view model for UI presentation (zero token exposure)
export const FacebookAccountViewSchema = z.object({
  id: z.string().uuid(),
  fbAccountId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  status: FacebookAccountStatusSchema,
  tokenExpiresAt: z.coerce.date().nullable().optional(),
  connectedPagesCount: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FacebookAccountView = z.infer<typeof FacebookAccountViewSchema>;

export const ListFacebookAccountsResponseSchema = z.object({
  accounts: z.array(FacebookAccountViewSchema),
  total: z.number().int().nonnegative(),
});

export type ListFacebookAccountsResponse = z.infer<
  typeof ListFacebookAccountsResponseSchema
>;


export const FacebookPageStatusSchema = z.enum([
  'active',
  'fb_rate_limited',
  'invalid_token',
  'disconnected',
]);
export type FacebookPageStatus = z.infer<typeof FacebookPageStatusSchema>;

export const FacebookPageSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  facebookAccountId: z.string().uuid(),
  fbPageId: z.string().min(1).max(100),
  pageName: z.string().min(1).max(255),
  category: z.string().max(100).nullable().optional(),
  tasks: z.array(z.string()).default([]),
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
  category: z.string().nullable().optional(),
  followersCount: z.number().int().nonnegative().default(0),
  status: FacebookPageStatusSchema,
  tasks: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FacebookPageView = z.infer<typeof FacebookPageViewSchema>;

export const ListFacebookPagesResponseSchema = z.object({
  pages: z.array(FacebookPageViewSchema),
  total: z.number().int().nonnegative(),
});

export type ListFacebookPagesResponse = z.infer<
  typeof ListFacebookPagesResponseSchema
>;


// In-memory representation of pages discovered from Graph API /me/accounts
export const DiscoveredPageSchema = z.object({
  fbPageId: z.string().min(1).max(100),
  pageName: z.string().min(1).max(255),
  category: z.string().nullable().optional(),
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
