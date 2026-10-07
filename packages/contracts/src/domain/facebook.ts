import { z } from 'zod';

export const FacebookAccountStatusSchema = z.enum(['active', 'disconnected', 'expired']);
export type FacebookAccountStatus = z.infer<typeof FacebookAccountStatusSchema>;

export const FacebookAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fbAccountId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  status: FacebookAccountStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FacebookAccount = z.infer<typeof FacebookAccountSchema>;

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
  followersCount: z.number().int().nonnegative().default(0),
  status: FacebookPageStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FacebookPage = z.infer<typeof FacebookPageSchema>;
