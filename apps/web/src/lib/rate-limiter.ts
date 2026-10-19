import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logServerError } from './server-analytics';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface LockoutResult {
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

interface WindowEntry {
  timestamps: number[];
}

interface LockoutEntry {
  attempts: number;
  lockedUntil: number;
}

const rateLimitStore = new Map<string, WindowEntry>();
const lockoutStore = new Map<string, LockoutEntry>();
// ---------------------------------------------------------------------------
// Distributed rate limiting (production) via Upstash Redis.
//
// The in-memory Maps below are per-serverless-instance and therefore only a
// speed bump on Vercel — an attacker can spread requests across instances.
// In production every check goes through Upstash sliding windows instead.
// ---------------------------------------------------------------------------

let sharedRedis: Redis | null = null;

function getRedis(): Redis {
  if (sharedRedis) return sharedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are strictly required for distributed rate limiting in production.'
    );
  }
  sharedRedis = new Redis({ url, token });
  return sharedRedis;
}

const upstashLimiters = new Map<string, Ratelimit>();

function toWindowString(windowMs: number): Duration {
  if (windowMs % 3600000 === 0) return `${windowMs / 3600000} h`;
  if (windowMs % 60000 === 0) return `${windowMs / 60000} m`;
  if (windowMs % 1000 === 0) return `${windowMs / 1000} s`;
  return `${windowMs} ms`;
}

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit {
  const cacheKey = `${maxRequests}:${windowMs}`;
  const cached = upstashLimiters.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(maxRequests, toWindowString(windowMs)),
    analytics: true,
    prefix: 'fbuploadpro:ratelimit',
  });
  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Default sliding-window size for auth rate limits (1 minute).
 * Call sites pass this as the window for checkRateLimit().
 */
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
let lastCleanup = Date.now();

function cleanupStores(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }

  for (const [key, entry] of lockoutStore.entries()) {
    if (now > entry.lockedUntil && entry.attempts === 0) {
      lockoutStore.delete(key);
    }
  }
}

/**
 * Sliding window rate limiter.
 * Checks whether the request with `key` exceeds `maxRequests` in the last `windowMs` milliseconds.
 *
 * Production: distributed sliding window via Upstash Redis. Fail-closed —
 * if Redis is unreachable or misconfigured the request is denied rather
 * than silently allowed (brute-force protection must not fail open).
 *
 * Non-production: in-memory sliding window (single instance is fine for
 * dev/test).
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === 'production') {
    try {
      const { success, remaining, reset } = await getUpstashLimiter(
        maxRequests,
        windowMs
      ).limit(key);
      return {
        allowed: success,
        remaining: Math.max(0, remaining),
        retryAfterSeconds: success
          ? 0
          : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
      };
    } catch (err) {
      logServerError(
        '[RateLimiter] Upstash rate-limit check failed; denying request (fail-closed).',
        err,
        { key: key.slice(0, 32), maxRequests, windowMs }
      );
      return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    }
  }

  cleanupStores();
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Keep only timestamps within window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestTimestamp = entry.timestamps[0] ?? now;
    const retryAfterMs = Math.max(0, windowMs - (now - oldestTimestamp));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  entry.timestamps.push(now);
  const remaining = Math.max(0, maxRequests - entry.timestamps.length);

  return {
    allowed: true,
    remaining,
    retryAfterSeconds: 0,
  };
}

/**
 * Check if a key is currently under a lockout penalty.
 */
export function isLockedOut(key: string): { locked: boolean; retryAfterSeconds: number } {
  cleanupStores();
  const now = Date.now();
  const entry = lockoutStore.get(key);
  if (!entry) {
    return { locked: false, retryAfterSeconds: 0 };
  }

  if (now < entry.lockedUntil) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { locked: true, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  return { locked: false, retryAfterSeconds: 0 };
}

/**
 * Record a failed attempt. If failed attempts reach `maxFailures`, locks out for `lockoutDurationMs`.
 */
export function recordFailedAttempt(
  key: string,
  maxFailures: number = 5,
  lockoutDurationMs: number = 15 * 60 * 1000 // 15 minutes default
): LockoutResult {
  cleanupStores();
  const now = Date.now();
  let entry = lockoutStore.get(key);

  if (!entry) {
    entry = { attempts: 0, lockedUntil: 0 };
    lockoutStore.set(key, entry);
  }

  // If previous lockout expired, reset attempts
  if (entry.lockedUntil > 0 && now >= entry.lockedUntil) {
    entry.attempts = 0;
    entry.lockedUntil = 0;
  }

  entry.attempts += 1;

  if (entry.attempts >= maxFailures) {
    entry.lockedUntil = now + lockoutDurationMs;
    const retryAfterSeconds = Math.ceil(lockoutDurationMs / 1000);
    return {
      locked: true,
      attempts: entry.attempts,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    locked: false,
    attempts: entry.attempts,
    remainingAttempts: maxFailures - entry.attempts,
    retryAfterSeconds: 0,
  };
}

/**
 * Clear lockout and attempt count on successful verification.
 */
export function clearLockout(key: string): void {
  lockoutStore.delete(key);
}

/**
 * Helper to extract client IP from Next.js request headers.
 * Prioritizes verified platform headers (x-vercel-forwarded-for, cf-connecting-ip, x-real-ip)
 * and falls back to the rightmost IP in x-forwarded-for to prevent client-controlled leftmost spoofing.
 */
export function extractClientIp(headers: Headers): string {
  const vercelForwardedFor = headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    const ips = vercelForwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1] ?? 'unknown';
    }
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp?.trim()) {
    return cfConnectingIp.trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp?.trim()) {
    return realIp.trim();
  }

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      return ips[ips.length - 1] ?? 'unknown';
    }
  }

  return '127.0.0.1';
}

/**
 * Reset all rate limit and lockout stores (for testing).
 */
export function _resetRateLimiter(): void {
  rateLimitStore.clear();
  lockoutStore.clear();
}
