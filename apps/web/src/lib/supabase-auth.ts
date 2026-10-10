import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDbClient } from '@/lib/db';
import {
  deriveSubdomainFromEmail,
  signSessionToken,
  canonicalizeGmailAddress,
  validateAndFormatE164Phone,
  type UserRole,
  type UserStatus,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { sanitizeAuthRedirectUrl } from '@/lib/auth-redirect';

// In-memory credential store for test/CI fallback when Supabase external cluster is not configured
const localPasswordStore = new Map<string, string>();
const localUserStore = new Map<string, AuthUser>();
const localResetTokenStore = new Map<string, { email: string; expiresAt: number }>();

export function getSupabaseClient(): SupabaseClient | null {
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

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  subdomain: string;
  role: UserRole;
  status: UserStatus;
  passwordUpdatedAt?: number | undefined;
}

/**
 * Resilient multi-runtime user lookup:
 * 1. Checks Supabase PostgREST over HTTPS when Supabase client is available.
 * 2. Checks PostgreSQL database client ONLY if DATABASE_URL is explicitly configured.
 * 3. Falls back to in-memory test store without throwing unhandled network exceptions.
 */
export async function findUserByEmail(emailInput: string): Promise<AuthUser | null> {
  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(emailInput);
  } catch {
    canonicalEmail = emailInput.trim().toLowerCase();
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, phone, subdomain, role, status')
        .or(`normalized_email.eq.${canonicalEmail},email.ilike.${canonicalEmail}`)
        .maybeSingle();

      if (error) {
        console.error('[Supabase PostgREST] findUserByEmail error:', error.message);
      } else if (data) {
        return data as AuthUser;
      }
    } catch (err) {
      console.error('[Supabase PostgREST] findUserByEmail exception:', err);
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const db = getDbClient();
      const user = await db.queryOne<AuthUser>(
        'SELECT id, email, name, phone, subdomain, role, status FROM users WHERE normalized_email = $1 OR LOWER(email) = $1',
        [canonicalEmail]
      );
      if (user) return user;
    } catch (err) {
      console.error('[Postgres DB] findUserByEmail error:', err);
    }
  }

  return localUserStore.get(canonicalEmail) || localUserStore.get(emailInput.trim().toLowerCase()) || null;
}

export async function resolveUniqueSubdomain(baseSubdomain: string): Promise<string> {
  const supabase = getSupabaseClient();
  let candidate = baseSubdomain;
  let counter = 1;

  if (supabase) {
    try {
      while (true) {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('subdomain', candidate)
          .maybeSingle();

        if (error) {
          console.error('[Supabase PostgREST] resolveUniqueSubdomain error:', error.message);
          return candidate;
        }
        if (!data) {
          return candidate;
        }
        candidate = `${baseSubdomain}${counter}`;
        counter++;
      }
    } catch (err) {
      console.error('[Supabase PostgREST] resolveUniqueSubdomain exception:', err);
      return candidate;
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const db = getDbClient();
      while (true) {
        const existing = await db.queryOne<{ id: string }>(
          'SELECT id FROM users WHERE subdomain = $1',
          [candidate]
        );
        if (!existing) {
          return candidate;
        }
        candidate = `${baseSubdomain}${counter}`;
        counter++;
      }
    } catch (err) {
      console.error('[Postgres DB] resolveUniqueSubdomain error:', err);
      return candidate;
    }
  }

  return candidate;
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
  const supabase = getSupabaseClient();

  if (supabase && existingUser) {
    // Check if this existing user is already confirmed in Supabase Auth
    try {
      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(existingUser.id);
      if (!authUserError && authUserData?.user) {
        if (authUserData.user.email_confirmed_at) {
          throw new Error('Email is already registered');
        }

        // User is unconfirmed in Supabase: update details and resend code
        try {
          await supabase
            .from('users')
            .update({
              name: params.name,
              phone: formattedPhone,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);
        } catch (uErr) {
          console.error('[Supabase PostgREST] User detail update error:', uErr);
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
      }
    } catch (adminErr: unknown) {
      if ((adminErr as Error)?.message === 'Email is already registered') {
        throw adminErr;
      }
      console.error('[Supabase Auth Admin] getUserById exception:', adminErr);
    }
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
            subdomain,
            role: 'user',
            status: 'active',
          },
          { onConflict: 'id' }
        )
        .select('id, email, name, phone, subdomain, role, status')
        .single();

      if (!insertError && inserted) {
        userRecord = inserted as AuthUser;
      }
    } catch (insertErr) {
      console.error('[Supabase PostgREST] User insert exception:', insertErr);
    }

    // Persist storage quota via Supabase PostgREST
    try {
      await supabase.from('user_storage_quotas').upsert(
        {
          user_id: userId,
          max_bytes: 5368709120,
          used_bytes: 0,
          max_assets: 50,
          used_assets: 0,
        },
        { onConflict: 'user_id' }
      );
    } catch (quotaErr) {
      console.error('[Supabase PostgREST] Storage quota insert exception:', quotaErr);
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
    console.log(`[SupabaseAuth Fallback] Simulated OTP dispatch to ${canonicalEmail}: ${otp}`);
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
  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(params.email);
  } catch {
    canonicalEmail = params.email.trim().toLowerCase();
  }

  const supabase = getSupabaseClient();
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
      await supabase
        .from('users')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .or(`normalized_email.eq.${canonicalEmail},email.ilike.${canonicalEmail}`);
    } catch (updateErr) {
      console.error('[Supabase PostgREST] Status activation error:', updateErr);
    }

    if (userRecord?.id) {
      try {
        await supabase.from('user_storage_quotas').upsert(
          {
            user_id: userRecord.id,
            max_bytes: 5368709120,
            used_bytes: 0,
            max_assets: 50,
            used_assets: 0,
          },
          { onConflict: 'user_id' }
        );
      } catch (quotaErr) {
        console.error('[Supabase PostgREST] Storage quota upsert error:', quotaErr);
      }
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

  const sessionSecret = process.env.SESSION_SECRET || 'super-secret-session-signing-key-minimum-32-chars-long';
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

  const supabase = getSupabaseClient();
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

export async function registerTenantUser(params: {
  name: string;
  phone: string;
  email: string;
  password?: string | undefined;
  hashedPassword?: string | undefined;
}): Promise<{ user: AuthUser; token: string; redirectUrl: string }> {
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

  // Check email uniqueness
  const existingUser = await findUserByEmail(canonicalEmail);
  if (existingUser) {
    throw new Error('Email is already registered');
  }

  // Derive unique subdomain
  const rawSubdomain = deriveSubdomainFromEmail(canonicalEmail);
  const subdomain = await resolveUniqueSubdomain(rawSubdomain);

  let userId: string;
  let userRecord: AuthUser;
  const supabase = getSupabaseClient();
  const rawOrHashedPassword = params.hashedPassword || params.password || '';

  if (supabase) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: canonicalEmail,
      password: rawOrHashedPassword,
      options: {
        data: {
          name: params.name,
          phone: formattedPhone,
          subdomain,
        },
      },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Authentication registration failed');
    }
    userId = authData.user.id;

    // Persist in users table via Supabase PostgREST
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: canonicalEmail,
          normalized_email: canonicalEmail,
          name: params.name,
          phone: formattedPhone,
          subdomain,
          role: 'user',
          status: 'active',
        })
        .select('id, email, name, phone, subdomain, role, status')
        .single();

      if (insertError) {
        console.error('[Supabase PostgREST] User insert error:', insertError.message);
      }
      userRecord = (inserted as AuthUser) || {
        id: userId,
        email: canonicalEmail,
        name: params.name,
        phone: formattedPhone,
        subdomain,
        role: 'user',
        status: 'active',
      };
    } catch (insertErr) {
      console.error('[Supabase PostgREST] User insert exception:', insertErr);
      userRecord = {
        id: userId,
        email: canonicalEmail,
        name: params.name,
        phone: formattedPhone,
        subdomain,
        role: 'user',
        status: 'active',
      };
    }

    // Persist storage quota via Supabase PostgREST
    try {
      await supabase.from('user_storage_quotas').upsert(
        {
          user_id: userId,
          max_bytes: 5368709120,
          used_bytes: 0,
          max_assets: 50,
          used_assets: 0,
        },
        { onConflict: 'user_id' }
      );
    } catch (quotaErr) {
      console.error('[Supabase PostgREST] Storage quota insert exception:', quotaErr);
    }
  } else {
    userId = crypto.randomUUID();
    const hashed = rawOrHashedPassword.includes(':')
      ? rawOrHashedPassword
      : await hashPassword(rawOrHashedPassword);
    localPasswordStore.set(canonicalEmail, hashed);

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

    if (process.env.DATABASE_URL) {
      try {
        const db = getDbClient();
        await db.query(
          `INSERT INTO users (id, email, normalized_email, name, phone, subdomain, role, status, created_at, updated_at)
           VALUES ($1, $2, $2, $3, $4, $5, 'user', 'active', NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [userId, canonicalEmail, params.name, formattedPhone, subdomain]
        );
        await db.query(
          `INSERT INTO storage_quotas (user_id, max_bytes, used_bytes, max_assets, used_assets)
           VALUES ($1, 5368709120, 0, 50, 0)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
      } catch (dbErr) {
        console.error('[Postgres DB] User insert error:', dbErr);
      }
    }
  }

  const sessionSecret = process.env.SESSION_SECRET || 'super-secret-session-signing-key-minimum-32-chars-long';
  const token = await signSessionToken(
    {
      userId: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      subdomain: userRecord.subdomain,
      role: userRecord.role,
      status: userRecord.status,
    },
    sessionSecret,
    86400 * 30 // 30 days matching fbup_session cookie maxAge
  );

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const isLocal = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https';
  const redirectUrl = `${protocol}://${userRecord.subdomain}.${rootDomain}/`;

  return {
    user: userRecord,
    token,
    redirectUrl,
  };
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

  const supabase = getSupabaseClient();
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
            subdomain: user.subdomain,
            role: 'user',
            status: 'active',
          },
          { onConflict: 'id' }
        );
        await supabase.from('user_storage_quotas').upsert(
          {
            user_id: user.id,
            max_bytes: 5368709120,
            used_bytes: 0,
            max_assets: 50,
            used_assets: 0,
          },
          { onConflict: 'user_id' }
        );
      } catch (upsertErr) {
        console.error('[Supabase PostgREST] User upsert on login error:', upsertErr);
      }
    }
  } else {
    const storedHash =
      localPasswordStore.get(canonicalEmail) ||
      localPasswordStore.get(params.email.trim().toLowerCase());
    if (storedHash) {
      const valid = await verifyPassword(params.password, storedHash);
      if (!valid) {
        throw new Error('Invalid email or password');
      }
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

  const sessionSecret = process.env.SESSION_SECRET || 'super-secret-session-signing-key-minimum-32-chars-long';
  const token = await signSessionToken(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      subdomain: user.subdomain,
      role: user.role,
      status: user.status,
    },
    sessionSecret,
    86400 * 30 // 30 days matching fbup_session cookie maxAge
  );

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const redirectUrl = sanitizeAuthRedirectUrl(
    params.returnUrl,
    user.subdomain,
    rootDomain,
    params.requestHost
  );

  return {
    user,
    token,
    redirectUrl,
  };
}

export async function requestPasswordReset(params: {
  email: string;
  redirectTo?: string | undefined;
}): Promise<{ message: string; resetToken?: string | undefined }> {
  let canonicalEmail: string;
  try {
    canonicalEmail = canonicalizeGmailAddress(params.email);
  } catch {
    canonicalEmail = params.email.trim().toLowerCase();
  }

  const user = await findUserByEmail(canonicalEmail);
  // For security against email enumeration, return confirmation even if email not found
  if (!user && !getSupabaseClient()) {
    return {
      message: 'If an account exists with this email address, a recovery link has been sent.',
    };
  }

  // Generate fallback recovery token for local/test environments
  const resetToken = crypto.randomUUID();
  localResetTokenStore.set(resetToken, {
    email: canonicalEmail,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour expiration
  });

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const options = params.redirectTo ? { redirectTo: params.redirectTo } : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(canonicalEmail, options);
      if (error) {
        console.error('[Supabase Auth] resetPasswordForEmail error:', error.message);
      }
    } catch (err) {
      console.error('[Supabase Auth] resetPasswordForEmail exception:', err);
    }
  }

  return {
    message: 'If an account exists with this email address, a recovery link has been sent.',
    resetToken,
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

  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(canonicalEmail);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  const { createPasswordResetOtp } = await import('@/lib/otp-service');
  const { otp } = createPasswordResetOtp(canonicalEmail);
  console.log(`[SupabaseAuth Fallback] Simulated Password Reset OTP dispatch to ${canonicalEmail}: ${otp}`);
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

  const supabase = getSupabaseClient();
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

  const supabase = getSupabaseClient();
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

    // Ensure public.users profile exists and is active, and storage quotas are provisioned
    try {
      const existingUser = await findUserByEmail(canonicalEmail);
      if (existingUser?.id) {
        await supabase
          .from('users')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', existingUser.id);
        await supabase.from('user_storage_quotas').upsert(
          {
            user_id: existingUser.id,
            max_bytes: 5368709120,
            used_bytes: 0,
            max_assets: 50,
            used_assets: 0,
          },
          { onConflict: 'user_id' }
        );
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
              subdomain,
              role: 'user',
              status: 'active',
            },
            { onConflict: 'id' }
          );
          await supabase.from('user_storage_quotas').upsert(
            {
              user_id: u.id,
              max_bytes: 5368709120,
              used_bytes: 0,
              max_assets: 50,
              used_assets: 0,
            },
            { onConflict: 'user_id' }
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

  if (process.env.DATABASE_URL) {
    try {
      const db = getDbClient();
      await db.query(
        'UPDATE users SET updated_at = NOW() WHERE normalized_email = $1 OR email = $1',
        [canonicalEmail]
      );
    } catch (err) {
      console.error('[Postgres DB] resetUserPasswordWithOtp error:', err);
    }
  }

  return {
    message: 'Your password has been successfully updated.',
  };
}

export const resetPasswordWithSupabaseOtp = resetUserPasswordWithOtp;

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

  const supabase = getSupabaseClient();
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
    } else {
      const { error } = await supabase.auth.updateUser({
        password: params.password,
      });
      if (error) {
        throw new Error(error.message);
      }
    }
  } else {
    // Local / test fallback store
    let targetEmail: string | null = null;
    const tokenKey = recoveryToken.trim();
    const tokenEntry = localResetTokenStore.get(tokenKey);

    if (tokenEntry) {
      if (Date.now() > tokenEntry.expiresAt) {
        localResetTokenStore.delete(tokenKey);
        throw new Error('Password reset link has expired. Please request a new link.');
      }
      targetEmail = tokenEntry.email;
      // Single-use token invalidation
      localResetTokenStore.delete(tokenKey);
    } else {
      throw new Error('Invalid or expired password reset link.');
    }

    if (!targetEmail) {
      throw new Error('Invalid or expired password reset link.');
    }

    const hashed = await hashPassword(params.password);
    localPasswordStore.set(targetEmail, hashed);

    // Invalidate existing sessions by updating passwordUpdatedAt
    const user = localUserStore.get(targetEmail);
    if (user) {
      user.passwordUpdatedAt = Math.floor(Date.now() / 1000);
    }
  }

  return {
    message: 'Your password has been successfully updated.',
  };
}

export function _resetAuthStores(): void {
  localPasswordStore.clear();
  localUserStore.clear();
  localResetTokenStore.clear();
}

export function _setResetTokenForTesting(
  token: string,
  data: { email: string; expiresAt: number }
): void {
  localResetTokenStore.set(token, data);
}

export async function validateSessionActive(session: SessionPayload): Promise<boolean> {
  const user = await findUserByEmail(session.email);
  if (!user) return false;
  if (user.status !== 'active') return false;
  if (user.passwordUpdatedAt && session.iat < user.passwordUpdatedAt) {
    return false;
  }
  return true;
}
