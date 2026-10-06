import { z } from 'zod';

export const FacebookAccountStatusSchema = z.enum(['active', 'invalid_token', 'checkpoint', 'disconnected']);
export type FacebookAccountStatus = z.infer<typeof FacebookAccountStatusSchema>;

export const FacebookAccountSchema = z.object({
  id: z.string().uuid(),
  agencyId: z.string().uuid(),
  fbUserId: z.string().min(1),
  name: z.string().min(1),
  status: FacebookAccountStatusSchema,
  tokenExpiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type FacebookAccount = z.infer<typeof FacebookAccountSchema>;

export const FacebookPageStatusSchema = z.enum(['active', 'fb_rate_limited', 'invalid_token', 'disconnected']);
export type FacebookPageStatus = z.infer<typeof FacebookPageStatusSchema>;

export const FacebookPageSchema = z.object({
  id: z.string().uuid(),
  agencyId: z.string().uuid(),
  facebookAccountId: z.string().uuid(),
  fbPageId: z.string().min(1),
  name: z.string().min(1),
  status: FacebookPageStatusSchema,
  followersCount: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type FacebookPage = z.infer<typeof FacebookPageSchema>;
