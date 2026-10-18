import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import {
  deriveSubdomainFromEmail,
  signSessionToken,
  getSessionSecret,
  canonicalizeGmailAddress,
  validateAndFormatE164Phone,
  type UserRole,
  type UserStatus,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { sanitizeAuthRedirectUrl } from '@/lib/auth-redirect';
import { logServerError } from './server-analytics';

// In-memory credential store for test/CI fallback when Supabase external cluster is not configured
const localPasswordStore = new Map<string, string>();

/**
 * Validates and canonicalizes email addresses, strictly rejecting characters that could be used
 * for PostgREST filter delimiter injection (such as commas, parentheses, quotes, backslashes, semicolons, spaces).
 */
export function sanitizeEmailInput(emailInput: string): string {
  if (!emailInput || typeof emailInput !== 'string') {
    throw new Error('Valid email address is required');
  }
  const trimmed = emailInput.trim().toLowerCase();
  // Reject characters used to craft PostgREST query injection or control flow
  if (/[,()"'\\;\s]/.test(trimmed)) {
    throw new Error('Email address contains invalid characters');
  }
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf('@') || atIndex === trimmed.length - 1) {
    throw new Error('Valid email address is required');
  }
  return trimmed;
}

/**
 * Resolves a canonical email address: attempts canonicalizeGmailAddress, and falls back to sanitizeEmailInput.
 */
export function resolveCanonicalEmail(emailInput: string): string {
  try {
    return canonicalizeGmailAddress(emailInput);
  } catch {
    return sanitizeEmailInput(emailInput);
  }
}

/**
 * Escapes and safely quotes a value for use in a PostgREST `.or()` filter.
 */
export function escapePostgrestFilterValue(val: string): string {
  const escaped = val
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"');
  return `"${escaped}"`;
}
const localUserStore = new Map<string, AuthUser>();
let mockSupabaseClientForTesting: SupabaseClient | null = null;
let mockSupabaseServiceClientForTesting: SupabaseClient | null = null;

/**
 * Single gate for every test double in this module. Mocks may only take
 * effect outside production — even if a setter is somehow called in
 * production, the mock is never honored by the getters.
 */
function isTestDoubleAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** Throws if test doubles are attempted in production. */
function assertTestDoubleAllowed(caller: string): void {
  if (!isTestDoubleAllowed()) {
    throw new Error(`${caller} is test-only and must not be called in production.`);
  }
}

export function _setMockSupabaseClient(client: SupabaseClient | null): void {
  assertTestDoubleAllowed('_setMockSupabaseClient');
  mockSupabaseClientForTesting = client;
}

export function _setMockSupabaseServiceClient(client: SupabaseClient | null): void {
  assertTestDoubleAllowed('_setMockSupabaseServiceClient');
  mockSupabaseServiceClientForTesting = client;
}

/**
 * Returns a Supabase client configured with the service-role key (SUPABASE_SERVICE_ROLE_KEY).
 * Exclusively for server-side administrative workflows and system jobs.
 * The name makes the elevated privilege explicit at every call site.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (isTestDoubleAllowed() && mockSupabaseServiceClientForTesting) {
    return mockSupabaseServiceClientForTesting;
  }
  if (isTestDoubleAllowed() && mockSupabaseClientForTesting) {
    return mockSupabaseClientForTesting;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key && !url.includes('placeholder') && !key.includes('placeholder')) {
    try {
      return createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch {
      return null;
    }
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are strictly required in production.');
  }
  return null;
}

export function getCookieDomain(requestHost?: string | null): string | undefined {
  const rawRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const cleanRoot = rawRoot
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    ?.split(':')[0] || 'localhost';

  if (
    cleanRoot.includes('localhost') ||
    cleanRoot.includes('127.0.0.1') ||
    cleanRoot.endsWith('.vercel.app')
  ) {
    return undefined;
  }

  if (requestHost) {
    const cleanHost = requestHost.trim().toLowerCase().split(':')[0] || '';
    if (
      cleanHost.includes('localhost') ||
      cleanHost.includes('127.0.0.1') ||
      cleanHost.endsWith('.vercel.app') ||
      (cleanHost !== cleanRoot && !cleanHost.endsWith(`.${cleanRoot}`))
    ) {
      return undefined;
    }
  }

  return process.env.COOKIE_DOMAIN?.trim() || `.${cleanRoot}`;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [saltHex, expectedHashHex] = parts;
  if (!saltHex || !expectedHashHex) return false;

  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || []
  );

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex === expectedHashHex;
}

/**
 * AuthUser represents an authenticated user in memory and session returns.
 * Per Principle 27 of FBUploadPro Constitution, the workspaces table is the sole source of truth
 * for tenant subdomains (users.subdomain is dropped from the database).
 * The subdomain field here represents the user's active/primary workspace subdomain.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  /** Primary workspace subdomain derived or resolved via workspaces table (Principle 27) */
  subdomain: string;
  role: UserRole;
  status: UserStatus;
  passwordUpdatedAt?: number | undefined;
}

async function findWorkspaceSubdomainByOwner(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  ownerId: string,
  fallbackSubdomain: string
): Promise<string> {
  if (!supabase) return fallbackSubdomain;
  try {
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('subdomain')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return wsData?.subdomain || fallbackSubdomain;
  } catch {
    return fallbackSubdomain;
  }
}

/**
 * Resilient multi-runtime user lookup:
 * 1. Checks Supabase PostgREST over HTTPS when Supabase client is available.
 * 2. Falls back to in-memory test store without throwing unhandled network exceptions in test environments.
 */
export async function findUserByEmail(emailInput: string): Promise<AuthUser | null> {
  let canonicalEmail: string;
  try {
    canonicalEmail = resolveCanonicalEmail(emailInput);
  } catch {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const quoted = escapePostgrestFilterValue(canonicalEmail);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, phone, role, status, password_updated_at')
        .or(`normalized_email.eq.${quoted},email.ilike.${quoted}`)
        .maybeSingle();

      if (error) {
        logServerError('[Supabase PostgREST] findUserByEmail error', error, { email: canonicalEmail });
      } else if (data) {
        const fallback = deriveSubdomainFromEmail(canonicalEmail);
        const subdomain = await findWorkspaceSubdomainByOwner(supabase, data.id, fallback);
        const rawPasswordUpdatedAt = (data as { password_updated_at?: string | null }).password_updated_at;
        const passwordUpdatedAt = rawPasswordUpdatedAt
          ? Math.floor(new Date(rawPasswordUpdatedAt).getTime() / 1000)
          : undefined;
        return { ...(data as object), subdomain, passwordUpdatedAt } as AuthUser;
      }
    } catch (err) {
      logServerError('[Supabase PostgREST] findUserByEmail exception', err, { email: canonicalEmail });
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return localUserStore.get(canonicalEmail) || localUserStore.get(emailInput.trim().toLowerCase()) || null;
}

export async function resolveUniqueSubdomain(baseSubdomain: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return baseSubdomain;

  try {
    const query = supabase.from('workspaces').select('subdomain');
    let data: Array<{ subdomain: string }> | null = null;
    let error: { message: string } | null = null;

    if (typeof (query as any)?.ilike === 'function') {
      const res = await (query as any).ilike('subdomain', `${baseSubdomain}%`);
      data = res?.data;
      error = res?.error;
    } else if (typeof (query as any)?.eq === 'function') {
      // Fallback for test mocks that only stub eq
      const res = await (query as any).eq('subdomain', baseSubdomain).maybeSingle();
      if (res?.data) {
        data = [res.data];
      }
      error = res?.error;
    } else {
      const res = await (query as any);
      data = res?.data;
      error = res?.error;
    }

    if (error) {
      console.error('[Supabase PostgREST] resolveUniqueSubdomain error:', error.message);
      return baseSubdomain;
    }

    const existing = new Set(
      (data || [])
        .map((row: { subdomain?: string }) => row?.subdomain?.toLowerCase())
        .filter(Boolean) as string[]
    );

    if (!existing.has(baseSubdomain.toLowerCase())) {
      return baseSubdomain;
    }

    let counter = 1;
    while (existing.has(`${baseSubdomain.toLowerCase()}${counter}`)) {
      counter++;
    }
    return `${baseSubdomain}${counter}`;
  } catch (err) {
    console.error('[Supabase PostgREST] resolveUniqueSubdomain exception:', err);
    return baseSubdomain;
  }
}

export async function ensureWorkspaceForUser(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  userId: string,
  userNameOrFallback: string,
  preferredSubdomain: string
): Promise<string> {
  // 1. Check if the user already owns an existing workspace
  try {
    const { data: existingWorkspace } = await supabase
      .from('workspaces')
      .select('id, subdomain')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingWorkspace?.subdomain) {
      return existingWorkspace.subdomain;
    }
  } catch (err) {
    console.error('[Supabase PostgREST] ensureWorkspaceForUser check existing error:', err);
  }

  // 2. Resolve unique subdomain candidate
  let candidate = await resolveUniqueSubdomain(preferredSubdomain);

  // 3. Insert explicitly with retry on unique constraint violation (SQLSTATE 23505)
  let lastFatalError: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { error: insertError } = await supabase.from('workspaces').insert({
        owner_id: userId,
        name: userNameOrFallback,
        subdomain: candidate,
      });

      if (!insertError) {
        return candidate;
      }

      const isConflict =
        insertError.code === '23505' ||
        insertError.message?.toLowerCase().includes('duplicate key') ||
        insertError.message?.toLowerCase().includes('unique constraint');

      if (isConflict) {
        const randomSuffix = crypto.randomUUID().slice(0, 6);
        candidate = `${preferredSubdomain}-${randomSuffix}`;
      } else {
        console.error('[Supabase PostgREST] Workspace insert error:', insertError.message);
        lastFatalError = new Error(`Failed to provision workspace: ${insertError.message || insertError.code}`);
        break;
      }
    } catch (insertEx) {
      console.error('[Supabase PostgREST] Workspace insert exception:', insertEx);
      const isTransient = attempt < 4;
      if (isTransient) {
        const randomSuffix = crypto.randomUUID().slice(0, 6);
        candidate = `${preferredSubdomain}-${randomSuffix}`;
      } else {
        lastFatalError = insertEx instanceof Error ? insertEx : new Error('Failed to provision workspace');
      }
    }
  }

  throw lastFatalError ?? new Error('Failed to provision workspace');
}

export async function signUpTenantUser(params: {
  name: string;
  phone: string;
  email: string;
  password?: string | undefined;
  hashedPassword?: string | undefined;
}): Promise<{
  user: AuthUser;
  requiresOtp: boolean;
  simulatedOtp?: string | undefined;
  cooldownSecondsRemaining?: number | undefined;
}> {
  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(params.email);
  } catch {
    canonicalEmail = params.email.trim().toLowerCase();
  }

  let formattedPhone: string;
  try {
    formattedPhone = validateAndFormatE164Phone(params.phone);
  } catch {
    formattedPhone = params.phone.trim();
  }

  const existingUser = await findUserByEmail(canonicalEmail);
  const supabase = getSupabaseAdminClient();

  if (supabase && existingUser) {
    // Check if this existing user is already confirmed in Supabase Auth
    try {
      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(existingUser.id);
      if (!authUserError && authUserData?.user) {
        if (authUserData.user.email_confirmed_at) {
          throw new Error('Email is already registered');
        }
      }
    } catch (adminErr: unknown) {
      if ((adminErr as Error)?.message === 'Email is already registered') {
        throw adminErr;
      }
      logServerError('[Supabase Auth Admin] getUserById exception:', adminErr);
    }

    // User is unconfirmed in Supabase: update details and resend code
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: params.name,
          phone: formattedPhone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      if (updateError) {
        throw new Error(updateError.message || 'User detail update failed');
      }
    } catch (uErr) {
      console.error('[Supabase PostgREST] User detail update error:', uErr);
      throw uErr;
    }

    const resendRes = await resendSignupOtpViaSupabase(canonicalEmail);
    return {
      user: {
        ...existingUser,
        name: params.name,
        phone: formattedPhone,
      },
      requiresOtp: true,
      cooldownSecondsRemaining: resendRes.cooldownSecondsRemaining,
    };
  } else if (!supabase && existingUser) {
    // Local / test fallback
    const { isPendingSignup } = await import('@/lib/otp-service');
    if (!isPendingSignup(canonicalEmail)) {
      throw new Error('Email is already registered');
    }
    const resendRes = await resendSignupOtpViaSupabase(canonicalEmail);
    return {
      user: existingUser,
      requiresOtp: true,
      simulatedOtp: resendRes.otp,
      cooldownSecondsRemaining: resendRes.cooldownSecondsRemaining,
    };
  }

  const rawSubdomain = deriveSubdomainFromEmail(canonicalEmail);
  const subdomain = await resolveUniqueSubdomain(rawSubdomain);
  const rawPassword = params.password || '';
  const hashedPassword = params.hashedPassword || (rawPassword ? await hashPassword(rawPassword) : '');

  let userRecord: AuthUser;

  if (supabase) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: canonicalEmail,
      password: rawPassword,
      options: {
        data: {
          name: params.name,
          phone: formattedPhone,
          subdomain,
        },
      },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered')) {
        throw new Error('Email is already registered');
      }

      const isRateLimited =
        authError.message?.toLowerCase().includes('for security purposes') ||
        /after\s+(\d+)\s+seconds/i.test(authError.message);

      if (isRateLimited) {
        const match = authError.message.match(/after\s+(\d+)\s+seconds/i);
        const seconds = match ? Number.parseInt(match[1], 10) : 60;

        // If user already exists in unconfirmed state, allow continuing to OTP step
        if (existingUser) {
          return {
            user: existingUser,
            requiresOtp: true,
            cooldownSecondsRemaining: seconds,
          };
        }

        // If new email on a rate-limited IP/project, throw rate limit error
        const rateLimitError = new Error(
          `For security purposes, please wait ${seconds} seconds before requesting another verification code.`
        );
        (rateLimitError as unknown as { code: string; retryAfterSeconds: number }).code = 'RATE_LIMITED';
        (rateLimitError as unknown as { retryAfterSeconds: number }).retryAfterSeconds = seconds;
        throw rateLimitError;
      }

      throw new Error(authError.message || 'Authentication registration failed');
    }

    if (!authData.user) {
      throw new Error('Authentication registration failed');
    }

    // GoTrue anti-enumeration: existing confirmed user returns user with empty identities
    if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
      throw new Error('Email is already registered');
    }

    const userId = authData.user.id;
    userRecord = {
      id: userId,
      email: canonicalEmail,
      name: params.name,
      phone: formattedPhone,
      subdomain,
      role: 'user',
      status: 'active',
    };

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .upsert(
          {
            id: userId,
            email: canonicalEmail,
            normalized_email: canonicalEmail,
            name: params.name,
            phone: formattedPhone,
            role: 'user',
            status: 'active',
          },
          { onConflict: 'id' }
        )
        .select('id, email, name, phone, role, status')
        .single();

      if (insertError) {
        throw new Error(insertError.message || 'User profile creation failed');
      }

      const wsSubdomain = await ensureWorkspaceForUser(
        supabase,
        userId,
        params.name || canonicalEmail.split('@')[0],
        subdomain
      );

      if (inserted) {
        userRecord = { ...(inserted as object), subdomain: wsSubdomain } as AuthUser;
      } else {
        userRecord.subdomain = wsSubdomain;
      }
    } catch (insertErr) {
      logServerError('[Supabase PostgREST] User insert exception', insertErr);
      throw insertErr;
    }
  } else {
    // Local / test fallback
    const { createPendingSignup } = await import('@/lib/otp-service');
    const { otp } = createPendingSignup({
      name: params.name,
      phone: formattedPhone,
      email: canonicalEmail,
      password: rawPassword,
      hashedPassword,
    });

    const userId = crypto.randomUUID();
    userRecord = {
      id: userId,
      email: canonicalEmail,
      name: params.name,
      phone: formattedPhone,
      subdomain,
      role: 'user',
      status: 'active',
    };
    localUserStore.set(canonicalEmail, userRecord);
    if (hashedPassword) {
      localPasswordStore.set(canonicalEmail, hashedPassword);
    }
    console.info(`[SupabaseAuth Fallback] Simulated OTP dispatch triggered for ${canonicalEmail}`);
    return {
      user: userRecord,
      requiresOtp: true,
      simulatedOtp: otp,
      cooldownSecondsRemaining: 60,
    };
  }

  return {
    user: userRecord,
    requiresOtp: true,
    cooldownSecondsRemaining: 60,
  };
}

export async function verifySignupOtpViaSupabase(params: {
  email: string;
  otp: string;
  returnUrl?: string | undefined;
  requestHost?: string | null | undefined;
}): Promise<{ user: AuthUser; token: string; redirectUrl: string }> {
  const canonicalEmail = resolveCanonicalEmail(params.email);

  const supabase = getSupabaseAdminClient();
  let userRecord: AuthUser | null = await findUserByEmail(canonicalEmail);

  if (supabase) {
    const { error } = await supabase.auth.verifyOtp({
      email: canonicalEmail,
      token: params.otp,
      type: 'signup',
    });

    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: canonicalEmail,
        token: params.otp,
        type: 'email',
      });
      if (retry.error) {
        throw new Error('Invalid or expired verification code.');
      }
    }

    try {
      const quoted = escapePostgrestFilterValue(canonicalEmail);
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .or(`normalized_email.eq.${quoted},email.ilike.${quoted}`);

      if (updateError) {
        throw new Error(updateError.message || 'User status activation failed');
      }
    } catch (updateErr) {
      console.error('[Supabase PostgREST] Status activation error:', updateErr);
      throw updateErr;
    }

    userRecord = await findUserByEmail(canonicalEmail);
    if (userRecord) {
      userRecord.status = 'active';
    }
  } else {
    // Local / test fallback
    const { verifySignupOtp } = await import('@/lib/otp-service');
    const verification = verifySignupOtp(canonicalEmail, params.otp);
    if (!verification.success) {
      throw new Error(verification.error || 'Invalid or expired verification code.');
    }

    if (!userRecord) {
      const rawSubdomain = deriveSubdomainFromEmail(canonicalEmail);
      userRecord = {
        id: crypto.randomUUID(),
        email: canonicalEmail,
        name: verification.signupData?.name || null,
        phone: verification.signupData?.phone || null,
        subdomain: rawSubdomain,
        role: 'user',
        status: 'active',
      };
      localUserStore.set(canonicalEmail, userRecord);
    } else {
      userRecord.status = 'active';
    }
  }

  if (!userRecord) {
    throw new Error('Unable to find user account after verification.');
  }

  const sessionSecret = getSessionSecret();
  const token = await signSessionToken(
    {
      userId: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      subdomain: userRecord.subdomain,
      role: userRecord.role,
      status: 'active',
    },
    sessionSecret,
    86400 * 30
  );

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const redirectUrl = sanitizeAuthRedirectUrl(
    params.returnUrl,
    userRecord.subdomain,
    rootDomain,
    params.requestHost
  );

  return {
    user: userRecord,
    token,
    redirectUrl,
  };
}

export async function resendSignupOtpViaSupabase(email: string): Promise<{
  success: boolean;
  otp?: string | undefined;
  cooldownSecondsRemaining?: number | undefined;
  error?: string | undefined;
}> {
  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(email);
  } catch {
    canonicalEmail = email.trim().toLowerCase();
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: canonicalEmail,
    });
    if (error) {
      const match = error.message.match(/after\s+(\d+)\s+seconds/i);
      const cooldown = match ? Number.parseInt(match[1], 10) : undefined;
      return {
        success: false,
        error: error.message,
        cooldownSecondsRemaining: cooldown,
      };
    }
    return { success: true };
  }

  const { resendSignupOtp } = await import('@/lib/otp-service');
  return resendSignupOtp(canonicalEmail);
}
export async function loginTenantUser(params: {
  email: string;
  password: string;
  returnUrl?: string | undefined;
  requestHost?: string | null | undefined;
}): Promise<{ user: AuthUser; token: string; redirectUrl: string }> {
  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(params.email);
  } catch {
    canonicalEmail = params.email.trim().toLowerCase();
  }
  let user = await findUserByEmail(canonicalEmail);

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: user?.email || canonicalEmail,
      password: params.password,
    });

    if (authError) {
      const isEmailNotConfirmed =
        authError.message?.toLowerCase().includes('email not confirmed') ||
        authError.code === 'email_not_confirmed' ||
        ((authError as { status?: number }).status === 400 &&
          authError.message?.toLowerCase().includes('confirm'));

      if (isEmailNotConfirmed) {
        const error = new Error('Please verify your email address to complete registration.');
        (error as unknown as { code: string; requiresOtp: boolean; email: string }).code = 'REQUIRES_OTP';
        (error as unknown as { requiresOtp: boolean }).requiresOtp = true;
        (error as unknown as { email: string }).email = canonicalEmail;
        throw error;
      }
      throw new Error('Invalid email or password');
    }

    // If user record wasn't loaded from public.users yet, construct from authenticated user and upsert
    if (!user && authData?.user) {
      const metadata = authData.user.user_metadata || {};
      const subdomain = metadata.subdomain || deriveSubdomainFromEmail(canonicalEmail);
      user = {
        id: authData.user.id,
        email: authData.user.email || canonicalEmail,
        name: metadata.name || null,
        phone: metadata.phone || null,
        subdomain,
        role: 'user',
        status: 'active',
      };
      try {
        await supabase.from('users').upsert(
          {
            id: user.id,
            email: user.email,
            normalized_email: canonicalEmail,
            name: user.name,
            phone: user.phone,
            role: 'user',
            status: 'active',
          },
          { onConflict: 'id' }
        );
        const wsSubdomain = await ensureWorkspaceForUser(
          supabase,
          user.id,
          user.name || canonicalEmail.split('@')[0],
          subdomain
        );
        user.subdomain = wsSubdomain;
      } catch (upsertErr) {
        logServerError('[Supabase PostgREST] User upsert on login error', upsertErr, { email: canonicalEmail });
      }
    }
  } else {
    const storedHash =
      localPasswordStore.get(canonicalEmail) ||
      localPasswordStore.get(params.email.trim().toLowerCase());
    if (!storedHash || !(await verifyPassword(params.password, storedHash))) {
      throw new Error('Invalid email or password');
    }
  }

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (user.status === 'suspended') {
    const error = new Error('Account is suspended');
    (error as unknown as { code: string }).code = 'ACCOUNT_SUSPENDED';
    throw error;
  }

  let allowedSubdomains: string[] = [user.subdomain];
  if (supabase) {
    try {
      const { data: allWorkspaces } = await supabase
        .from('workspaces')
        .select('subdomain')
        .eq('owner_id', user.id);
      const subs = Array.from(
        new Set(
          (allWorkspaces || [])
            .map((w: { subdomain?: string }) => w.subdomain?.toLowerCase())
            .filter((sub): sub is string => Boolean(sub))
        )
      );
      if (subs.length > 0) {
        allowedSubdomains = subs;
      }
    } catch {
      // Fallback to primary workspace subdomain
    }
  }

  const sessionSecret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const minIat = user.passwordUpdatedAt ? Math.max(now, user.passwordUpdatedAt + 1) : now;
  const token = await signSessionToken(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      subdomain: user.subdomain,
      role: user.role,
      status: user.status,
      iat: minIat,
      allowedSubdomains,
    },
    sessionSecret,
    86400 * 30 // 30 days matching fbup_session cookie maxAge
  );

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const redirectUrl = sanitizeAuthRedirectUrl(
    params.returnUrl,
    user.subdomain,
    rootDomain,
    params.requestHost,
    allowedSubdomains
  );

  return {
    user,
    token,
    redirectUrl,
  };
}
export async function sendPasswordResetOtpViaSupabase(email: string): Promise<{
  success: boolean;
  otp?: string | undefined;
  error?: string | undefined;
}> {
  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(email);
  } catch {
    canonicalEmail = email.trim().toLowerCase();
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(canonicalEmail);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  const { createPasswordResetOtp } = await import('@/lib/otp-service');
  const { otp } = createPasswordResetOtp(canonicalEmail);
  console.info(`[SupabaseAuth Fallback] Simulated Password Reset OTP dispatch triggered for ${canonicalEmail}`);
  return { success: true, otp };
}

export async function resendPasswordResetOtpViaSupabase(email: string): Promise<{
  success: boolean;
  otp?: string | undefined;
  cooldownSecondsRemaining?: number | undefined;
  error?: string | undefined;
}> {
  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(email);
  } catch {
    canonicalEmail = email.trim().toLowerCase();
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(canonicalEmail);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  const { resendPasswordResetOtp } = await import('@/lib/otp-service');
  return resendPasswordResetOtp(canonicalEmail);
}

export async function resetUserPasswordWithOtp(params: {
  email: string;
  otp: string;
  password: string;
}): Promise<{ message: string }> {
  if (!params.password || typeof params.password !== 'string' || params.password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  if (params.password.length > 128) {
    throw new Error('Password cannot exceed 128 characters');
  }

  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(params.email);
  } catch {
    canonicalEmail = params.email.trim().toLowerCase();
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.auth.verifyOtp({
      email: canonicalEmail,
      token: params.otp,
      type: 'recovery',
    });
    if (error) {
      throw new Error('Invalid or expired verification code.');
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: params.password,
    });
    if (updateError) {
      const existingUser = await findUserByEmail(canonicalEmail);
      if (existingUser?.id) {
        await supabase.auth.admin.updateUserById(existingUser.id, {
          password: params.password,
        });
      } else {
        throw new Error(updateError.message);
      }
    }

    // Ensure public.users profile exists, is active, and records password_updated_at
    const nowIso = new Date().toISOString();
    try {
      const existingUser = await findUserByEmail(canonicalEmail);
      if (existingUser?.id) {
        await supabase
          .from('users')
          .update({
            status: 'active',
            password_updated_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', existingUser.id);
      } else {
        const { data: authUserData } = await supabase.auth.getUser();
        if (authUserData?.user) {
          const u = authUserData.user;
          const metadata = u.user_metadata || {};
          const subdomain = metadata.subdomain || deriveSubdomainFromEmail(canonicalEmail);
          await supabase.from('users').upsert(
            {
              id: u.id,
              email: u.email || canonicalEmail,
              normalized_email: canonicalEmail,
              name: metadata.name || null,
              phone: metadata.phone || null,
              role: 'user',
              status: 'active',
              password_updated_at: nowIso,
              updated_at: nowIso,
            },
            { onConflict: 'id' }
          );
          await ensureWorkspaceForUser(
            supabase,
            u.id,
            metadata.name || canonicalEmail.split('@')[0],
            subdomain
          );
        }
      }
    } catch (profileErr) {
      console.error('[Supabase PostgREST] Error activating user on password reset:', profileErr);
    }
  } else {
    // 1. Verify OTP with constant-time comparison and lockout checks in fallback
    const { verifyPasswordResetOtp } = await import('@/lib/otp-service');
    const verification = verifyPasswordResetOtp(canonicalEmail, params.otp);
    if (!verification.success) {
      throw new Error(verification.error || 'Invalid or expired verification code.');
    }

    // 2. Hash new password in fallback
    const hashed = await hashPassword(params.password);
    localPasswordStore.set(canonicalEmail, hashed);

    let existing = localUserStore.get(canonicalEmail);
    if (!existing) {
      const rawSubdomain = deriveSubdomainFromEmail(canonicalEmail);
      existing = {
        id: crypto.randomUUID(),
        email: canonicalEmail,
        name: null,
        phone: null,
        subdomain: rawSubdomain,
        role: 'user',
        status: 'active',
      };
      localUserStore.set(canonicalEmail, existing);
    } else {
      existing.status = 'active';
    }
  }

  // 3. Invalidate existing sessions by updating passwordUpdatedAt
  const nowSeconds = Math.floor(Date.now() / 1000);
  const user = localUserStore.get(canonicalEmail);
  if (user) {
    user.passwordUpdatedAt = nowSeconds;
  }

  return {
    message: 'Your password has been successfully updated.',
  };
}


export async function resetUserPassword(params: {
  email?: string | undefined;
  password: string;
  otp?: string | undefined;
  token?: string | undefined;
  code?: string | undefined;
}): Promise<{ message: string }> {
  if (params.otp && params.email) {
    return resetUserPasswordWithOtp({
      email: params.email,
      otp: params.otp,
      password: params.password,
    });
  }

  if (!params.password || typeof params.password !== 'string' || params.password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  if (params.password.length > 128) {
    throw new Error('Password cannot exceed 128 characters');
  }

  const recoveryToken = params.token || params.code;
  if (!recoveryToken || typeof recoveryToken !== 'string' || !recoveryToken.trim()) {
    throw new Error('A valid password reset link or token is required.');
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    if (params.code) {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
      if (exchangeError || !data?.session) {
        throw new Error('Invalid or expired password reset link.');
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: params.password,
      });
      if (updateError) {
        throw new Error(updateError.message);
      }
    } else if (params.token) {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: params.token,
        type: 'recovery',
      });
      if (verifyError || !data?.session) {
        throw new Error('Invalid or expired password reset link.');
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: params.password,
      });
      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      const { error } = await supabase.auth.updateUser({
        password: params.password,
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    // Invalidate existing sessions in production by updating password_updated_at in public.users
    try {
      const nowIso = new Date().toISOString();
      const authUserData = typeof supabase.auth?.getUser === 'function' ? (await supabase.auth.getUser())?.data : null;
      const targetUserId = authUserData?.user?.id;
      if (targetUserId) {
        await supabase
          .from('users')
          .update({
            password_updated_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', targetUserId);
      } else if (params.email) {
        const canonicalEmail = resolveCanonicalEmail(params.email);
        const quoted = escapePostgrestFilterValue(canonicalEmail);
        await supabase
          .from('users')
          .update({
            password_updated_at: nowIso,
            updated_at: nowIso,
          })
          .or(`normalized_email.eq.${quoted},email.ilike.${quoted}`);
      }
    } catch (invalErr) {
      console.error('[Supabase PostgREST] Failed to persist password_updated_at on resetUserPassword:', invalErr);
    }
  } else {
    throw new Error('A valid password reset link or active Supabase session is required.');
  }

  return {
    message: 'Your password has been successfully updated.',
  };
}

export function _resetAuthStores(): void {
  localPasswordStore.clear();
  localUserStore.clear();
  mockSupabaseClientForTesting = null;
  mockSupabaseServiceClientForTesting = null;
}

export async function _seedTestUser(user: AuthUser, password?: string): Promise<void> {
  assertTestDoubleAllowed('_seedTestUser');
  let canonical: string;
  try {
    canonical = canonicalizeGmailAddress(user.email);
  } catch {
    canonical = user.email.trim().toLowerCase();
  }
  localUserStore.set(canonical, user);
  localUserStore.set(user.email.trim().toLowerCase(), user);
  if (password) {
    const hash = await hashPassword(password);
    localPasswordStore.set(canonical, hash);
    localPasswordStore.set(user.email.trim().toLowerCase(), hash);
  }
}

export function _setResetTokenForTesting(
  _token: string,
  _data: { email: string; expiresAt: number }
): void {
  // Deprecated: localResetTokenStore has been eradicated per Principle 12 & Principle 29 (ISSUE-10)
}

export async function validateSessionActive(session: SessionPayload): Promise<boolean> {
  if (session.status === 'suspended') return false;
  const user = await findUserByEmail(session.email);
  if (!user) {
    if (!getSupabaseAdminClient() && process.env.NODE_ENV !== 'production') {
      return session.status === 'active';
    }
    return false;
  }
  if (user.status !== 'active') return false;
  if (user.passwordUpdatedAt && session.iat <= user.passwordUpdatedAt) {
    return false;
  }
  return true;
}

export function purgeHostOnlySessionCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.headers.append(
    'Set-Cookie',
    `fbup_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`
  );
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  requestHost?: string | null
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = getCookieDomain(requestHost);

  response.cookies.set('fbup_session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: 86400 * 30, // 30 days
  });

  if (domain) {
    purgeHostOnlySessionCookie(response);
  }
}
