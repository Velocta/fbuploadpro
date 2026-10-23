import { z } from 'zod';
import { PlatformSchema } from './common';
import { SocialDestinationViewSchema } from './accounts';

/**
 * Connect-flow resources (spec 123's frozen connect contract,
 * consumed as-is — spec 137 §5).
 *
 * Sources: `GET …/accounts/social/[destinationId]` (destination detail
 * from `lib/connect/persist.ts`'s `DestinationDetailView`) and
 * `POST /api/connect/[platform]/complete` (the destination-picker
 * completion). The connect *initiate* route is a redirect, not JSON,
 * so it has no response schema here.
 *
 * Passthrough choices: none. The destination detail's nested
 * `account` object is rendered by the dedicated-section landing page,
 * so it is strict.
 */

export const DestinationDetailSchema = SocialDestinationViewSchema.extend({
  platform: PlatformSchema,
  account: z.object({
    id: z.string(),
    displayName: z.string(),
    platform: PlatformSchema,
    status: z.string(),
  }),
});
export type DestinationDetail = z.infer<typeof DestinationDetailSchema>;

export const DestinationDetailResponseSchema = z.object({
  destination: DestinationDetailSchema,
});
export type DestinationDetailResponse = z.infer<typeof DestinationDetailResponseSchema>;

export const ConnectCompleteResponseSchema = z.object({
  accountsUrl: z.string(),
  addedCount: z.number().int().nonnegative(),
});
export type ConnectCompleteResponse = z.infer<typeof ConnectCompleteResponseSchema>;
