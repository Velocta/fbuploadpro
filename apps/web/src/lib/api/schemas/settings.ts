import { z } from 'zod';
import { CredentialsStatusSchema } from './common';

/**
 * Settings resources (BYOC / per-platform app details).
 *
 * Sources: `GET/PUT/DELETE …/settings/byoc` and
 * `GET/PUT/DELETE …/settings/platform-credentials/[platform]` — both
 * construct their JSON inline in the route handlers (no server-side
 * response schema), so these schemas are transcribed from that
 * construction, cross-checked against `tests/api/byoc-settings-api.test.ts`
 * and `tests/api/platform-credentials-api.test.ts`.
 *
 * Passthrough choices: none — both payloads are flat objects whose
 * fields the settings UI renders.
 */

export const ByocSettingsResponseSchema = z.object({
  workspaceId: z.string().uuid(),
  subdomain: z.string(),
  fbAppId: z.string(),
  fbAppSecret: z.string(),
  hasSecret: z.boolean(),
  status: CredentialsStatusSchema,
  lastTestedAt: z.string().nullable(),
  connectedAt: z.string().nullable(),
});
export type ByocSettingsResponse = z.infer<typeof ByocSettingsResponseSchema>;

export const SaveCredentialsResponseSchema = z.object({
  success: z.boolean(),
  hasSecret: z.boolean(),
  status: CredentialsStatusSchema,
  connectedAt: z.string(),
});
export type SaveCredentialsResponse = z.infer<typeof SaveCredentialsResponseSchema>;

export const DeleteByocResponseSchema = z.object({
  success: z.boolean(),
  disconnected: z.boolean(),
});
export type DeleteByocResponse = z.infer<typeof DeleteByocResponseSchema>;

export const PlatformCredentialsResponseSchema = z.object({
  workspaceId: z.string().uuid(),
  subdomain: z.string(),
  platform: z.string(),
  appId: z.string(),
  appSecret: z.string(),
  hasSecret: z.boolean(),
  status: CredentialsStatusSchema,
  lastTestedAt: z.string().nullable(),
  connectedAt: z.string().nullable(),
});
export type PlatformCredentialsResponse = z.infer<
  typeof PlatformCredentialsResponseSchema
>;

export const DeletePlatformCredentialsResponseSchema = z.object({
  success: z.boolean(),
});
export type DeletePlatformCredentialsResponse = z.infer<
  typeof DeletePlatformCredentialsResponseSchema
>;
