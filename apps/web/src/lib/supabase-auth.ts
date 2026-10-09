import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDbClient } from '@/lib/db';
import {
  deriveSubdomainFromEmail,
  signSessionToken,
  type UserRole,
  type UserStatus,
  type SessionPayload,
} from '@fbuploadpro/contracts';

// In-memory credential store for test/CI fallback when Supabase external cluster is not configured
const localPasswordStore = new Map<string, string>();
const localUserStore = new Map<string, AuthUser>();

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

export function getCookieDomain(): string | undefined {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  if (rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1')) {
    return undefined;
  }
  return process.env.COOKIE_DOMAIN || `.${rootDomain}`;
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
    saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
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
}

/**
 * Resilient multi-runtime user lookup:
 * 1. Checks Supabase PostgREST over HTTPS when Supabase client is available.
 * 2. Checks PostgreSQL database client ONLY if DATABASE_URL is explicitly configured.
 * 3. Falls back to in-memory test store without throwing unhandled network exceptions.
 */
export async function findUserByEmail(emailLower: string): Promise<AuthUser | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, phone, subdomain, role, status')
        .ilike('email', emailLower)
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
        'SELECT id, email, name, phone, subdomain, role, status FROM users WHERE LOWER(email) = $1',
        [emailLower]
      );
      if (user) return user;
    } catch (err) {
      console.error('[Postgres DB] findUserByEmail error:', err);
    }
  }

  return localUserStore.get(emailLower) || null;
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

export async function registerTenantUser(params: {
  name: string;
  phone: string;
  email: string;
  password: string;
}): Promise<{ user: AuthUser; token: string; redirectUrl: string }> {
  const emailLower = params.email.trim().toLowerCase();

  // Check email uniqueness
  const existingUser = await findUserByEmail(emailLower);
  if (existingUser) {
    throw new Error('Email is already registered');
  }

  // Derive unique subdomain
  const rawSubdomain = deriveSubdomainFromEmail(emailLower);
  const subdomain = await resolveUniqueSubdomain(rawSubdomain);

  let userId: string;
  let userRecord: AuthUser;
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailLower,
      password: params.password,
      options: {
        data: {
          name: params.name,
          phone: params.phone,
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
          email: emailLower,
          name: params.name,
          phone: params.phone,
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
        email: emailLower,
        name: params.name,
        phone: params.phone,
        subdomain,
        role: 'user',
        status: 'active',
      };
    } catch (insertErr) {
      console.error('[Supabase PostgREST] User insert exception:', insertErr);
      userRecord = {
        id: userId,
        email: emailLower,
        name: params.name,
        phone: params.phone,
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
    const hashed = await hashPassword(params.password);
    localPasswordStore.set(emailLower, hashed);

    userRecord = {
      id: userId,
      email: emailLower,
      name: params.name,
      phone: params.phone,
      subdomain,
      role: 'user',
      status: 'active',
    };
    localUserStore.set(emailLower, userRecord);

    if (process.env.DATABASE_URL) {
      try {
        const db = getDbClient();
        await db.query(
          `INSERT INTO users (id, email, name, phone, subdomain, role, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'user', 'active', NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [userId, emailLower, params.name, params.phone, subdomain]
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
    sessionSecret
  );

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const isLocal = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https';
  const redirectUrl = `${protocol}://${userRecord.subdomain}.${rootDomain}/dashboard`;

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
}): Promise<{ user: AuthUser; token: string; redirectUrl: string }> {
  const emailLower = params.email.trim().toLowerCase();
  let user = await findUserByEmail(emailLower);

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password: params.password,
    });

    if (authError) {
      throw new Error('Invalid email or password');
    }

    // If user record wasn't loaded from public.users yet, construct from authenticated user
    if (!user && authData?.user) {
      const metadata = authData.user.user_metadata || {};
      const subdomain = metadata.subdomain || deriveSubdomainFromEmail(emailLower);
      user = {
        id: authData.user.id,
        email: authData.user.email || emailLower,
        name: metadata.name || null,
        phone: metadata.phone || null,
        subdomain,
        role: 'user',
        status: 'active',
      };
    }
  } else {
    const storedHash = localPasswordStore.get(emailLower);
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
    sessionSecret
  );

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const isLocal = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https';

  let redirectUrl = `${protocol}://${user.subdomain}.${rootDomain}/dashboard`;
  if (params.returnUrl && params.returnUrl.startsWith('/')) {
    redirectUrl = `${protocol}://${user.subdomain}.${rootDomain}${params.returnUrl}`;
  } else if (params.returnUrl && params.returnUrl.includes(user.subdomain)) {
    redirectUrl = params.returnUrl;
  }

  return {
    user,
    token,
    redirectUrl,
  };
}

export async function requestPasswordReset(params: {
  email: string;
  redirectTo?: string | undefined;
}): Promise<{ message: string }> {
  const emailLower = params.email.trim().toLowerCase();

  const user = await findUserByEmail(emailLower);
  // For security against email enumeration, return confirmation even if email not found
  if (!user && !getSupabaseClient()) {
    return {
      message: 'If an account exists with this email address, a recovery link has been sent.',
    };
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const options = params.redirectTo ? { redirectTo: params.redirectTo } : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(emailLower, options);
      if (error) {
        console.error('[Supabase Auth] resetPasswordForEmail error:', error.message);
      }
    } catch (err) {
      console.error('[Supabase Auth] resetPasswordForEmail exception:', err);
    }
  }

  return {
    message: 'If an account exists with this email address, a recovery link has been sent.',
  };
}

export async function resetUserPassword(params: {
  email?: string | undefined;
  password: string;
  token?: string | undefined;
}): Promise<{ message: string }> {
  if (params.password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.auth.updateUser({
      password: params.password,
    });
    if (error) {
      console.error('[Supabase Auth] updateUser error:', error.message);
      throw new Error(error.message);
    }
  } else if (params.email) {
    const emailLower = params.email.trim().toLowerCase();
    const hashed = await hashPassword(params.password);
    localPasswordStore.set(emailLower, hashed);
  }

  return {
    message: 'Your password has been successfully updated.',
  };
}
