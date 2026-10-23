import { z } from 'zod';

/**
 * Auth-adjacent resources (spec 137 §3.1 / §3.8).
 *
 * Source: `POST /api/auth/login` — the success body exactly as its
 * route handler constructs it (`{ success, user, redirectUrl }`). The
 * login form (PR-A6's reference conversion) submits through the typed
 * client with this schema; its error bodies are control flow, not data
 * (403 `requiresOtp` / suspended `redirectUrl`, 400 `details`), and are
 * read from the thrown `ApiError`'s `cause` by the form.
 *
 * Passthrough choices: none. Every field here is consumed by the
 * post-login redirect path (`completeAuthRedirect` reads `id`, `email`,
 * `subdomain`; the rest mirrors the route's construction).
 */

export const LoginUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  subdomain: z.string(),
  role: z.string(),
  status: z.string(),
});
export type LoginUser = z.infer<typeof LoginUserSchema>;

export const LoginSuccessResponseSchema = z.object({
  success: z.literal(true),
  user: LoginUserSchema,
  redirectUrl: z.string(),
});
export type LoginSuccessResponse = z.infer<typeof LoginSuccessResponseSchema>;

/** The login route's error body shape, read from an `ApiError` cause. */
export interface LoginErrorBody {
  error?: string;
  requiresOtp?: boolean;
  email?: string;
  redirectUrl?: string;
  details?: Record<string, string[]>;
}
