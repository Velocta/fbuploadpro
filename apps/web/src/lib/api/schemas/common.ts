import { z } from 'zod';

/**
 * Shared building blocks for the resource schemas.
 *
 * Conventions (spec 137 §3.1, plan risk note): schemas describe the
 * responses exactly as the route handlers construct them today. Fields
 * the UI renders are always type-strict. Format constraints the server
 * already enforces before responding (e.g. zod `.url()` in the
 * contracts package) are deliberately NOT repeated here — repeating
 * them would only add client parse failures for values the server has
 * already accepted. Dates arrive over JSON as ISO strings, so they are
 * typed as strings, not the contracts' coerced `Date` objects.
 */

/** `{ success: true }`-style acknowledgement bodies. */
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

/** Connected-platform identifiers (contracts `Platform` union). */
export const PlatformSchema = z.enum([
  'facebook',
  'instagram',
  'threads',
  'youtube',
  'x',
  'tiktok',
]);
export type Platform = z.infer<typeof PlatformSchema>;

/** Credential status shared by the BYOC / app-details settings routes. */
export const CredentialsStatusSchema = z.enum(['unverified', 'valid', 'invalid']);
export type CredentialsStatus = z.infer<typeof CredentialsStatusSchema>;
