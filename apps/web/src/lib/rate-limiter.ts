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

const CLEANUP_INTERVAL_MS = 60 * 1000;
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
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
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
 */
export function extractClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
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
