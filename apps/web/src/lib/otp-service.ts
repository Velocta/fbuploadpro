import crypto from 'node:crypto';
import { canonicalizeGmailAddress } from '@fbuploadpro/contracts';
import { isLockedOut, recordFailedAttempt, clearLockout } from '@/lib/rate-limiter';

export interface StagedSignupData {
  name: string;
  phone: string;
  email: string;
  hashedPassword: string;
}

export interface PendingSignupEntry {
  data: StagedSignupData;
  otp: string;
  createdAt: number;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

export interface PendingPasswordResetEntry {
  email: string;
  otp: string;
  createdAt: number;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_VERIFICATION_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

// In-memory store for pending signups
const pendingSignups = new Map<string, PendingSignupEntry>();
// In-memory store for pending password resets
const pendingPasswordResets = new Map<string, PendingPasswordResetEntry>();

export function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export function verifyHashedPasswordSync(password: string, storedHash: string): boolean {
  try {
    const [saltHex, keyHex] = storedHash.split(':');
    if (!saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(keyHex, 'hex');
    const actualKey = crypto.pbkdf2Sync(password, salt, 100000, expectedKey.length, 'sha256');
    if (actualKey.length !== expectedKey.length) return false;
    return crypto.timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

export function generateSecureOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const randomValue = array[0] ?? 0;
  // Produce exactly 6 digits between 100000 and 999999
  const otpNumber = 100000 + (randomValue % 900000);
  return otpNumber.toString();
}

/**
 * Constant-time string equality to prevent timing attacks on OTP verification
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Clean up expired entries to prevent memory growth
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [email, entry] of pendingSignups.entries()) {
    if (now > entry.expiresAt) {
      pendingSignups.delete(email);
    }
  }
  for (const [email, entry] of pendingPasswordResets.entries()) {
    if (now > entry.expiresAt) {
      pendingPasswordResets.delete(email);
    }
  }
}

function resolveCanonicalEmail(email: string): string {
  try {
    return canonicalizeGmailAddress(email);
  } catch {
    return email.trim().toLowerCase();
  }
}

export function createPendingSignup(data: {
  name: string;
  phone: string;
  email: string;
  password?: string | undefined;
  hashedPassword?: string | undefined;
}): {
  otp: string;
  expiresAt: Date;
} {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(data.email);
  const now = Date.now();
  const otp = generateSecureOtp();

  const rawPassword = data.password || '';
  let hashedPassword = data.hashedPassword;
  if (!hashedPassword) {
    hashedPassword = rawPassword.includes(':') ? rawPassword : hashPasswordSync(rawPassword);
  }

  const entry: PendingSignupEntry = {
    data: {
      name: data.name,
      phone: data.phone,
      email: canonicalEmail,
      hashedPassword,
    },
    otp,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    lastSentAt: now,
    attempts: 0,
  };

  pendingSignups.set(canonicalEmail, entry);

  return {
    otp,
    expiresAt: new Date(entry.expiresAt),
  };
}

export function getPendingSignup(email: string): PendingSignupEntry | null {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);
  return pendingSignups.get(canonicalEmail) || null;
}

export function findPendingSignup(email: string): PendingSignupEntry | null {
  return getPendingSignup(email);
}

export function isPendingSignup(email: string): boolean {
  return getPendingSignup(email) !== null;
}

export function verifyPendingSignupPassword(email: string, candidatePassword: string): boolean {
  cleanupExpiredEntries();
  const entry = getPendingSignup(email);
  if (!entry?.data?.hashedPassword) return false;
  return verifyHashedPasswordSync(candidatePassword, entry.data.hashedPassword);
}

export function refreshPendingSignupOtp(email: string): {
  success: boolean;
  otp?: string;
  error?: string;
} {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);
  const entry = pendingSignups.get(canonicalEmail);
  if (!entry) {
    return {
      success: false,
      error: 'No pending registration found.',
    };
  }
  const now = Date.now();
  const newOtp = generateSecureOtp();
  entry.otp = newOtp;
  entry.lastSentAt = now;
  entry.expiresAt = now + OTP_TTL_MS;
  entry.attempts = 0;
  clearLockout(canonicalEmail);
  return {
    success: true,
    otp: newOtp,
  };
}

export function verifySignupOtp(
  email: string,
  providedOtp: string
): {
  success: boolean;
  signupData?: StagedSignupData | undefined;
  error?: string | undefined;
} {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);

  // Check if identifier is currently locked out
  const lockoutStatus = isLockedOut(canonicalEmail);
  if (lockoutStatus.locked) {
    const minutes = Math.ceil(lockoutStatus.retryAfterSeconds / 60);
    return {
      success: false,
      error: `Too many incorrect attempts. Verification is temporarily locked for ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    };
  }

  const entry = pendingSignups.get(canonicalEmail);

  if (!entry) {
    return {
      success: false,
      error: 'No pending registration found or the code has expired. Please sign up again.',
    };
  }

  const now = Date.now();
  if (now > entry.expiresAt) {
    pendingSignups.delete(canonicalEmail);
    return {
      success: false,
      error: 'Verification code has expired. Please request a new code.',
    };
  }

  const cleanProvided = providedOtp.replace(/\D/g, '').trim();

  // Use timingSafeEqual to compare OTPs
  if (!constantTimeEquals(cleanProvided, entry.otp)) {
    entry.attempts += 1;
    const lockout = recordFailedAttempt(canonicalEmail, MAX_VERIFICATION_ATTEMPTS, LOCKOUT_DURATION_MS);

    if (lockout.locked) {
      pendingSignups.delete(canonicalEmail);
      return {
        success: false,
        error: 'Too many incorrect attempts. Verification is temporarily locked for 15 minutes.',
      };
    }

    const remaining = lockout.remainingAttempts;
    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // OTP verified successfully
  const signupData = entry.data;
  pendingSignups.delete(canonicalEmail);
  clearLockout(canonicalEmail);

  return {
    success: true,
    signupData,
  };
}

export function resendSignupOtp(email: string): {
  success: boolean;
  otp?: string | undefined;
  cooldownSecondsRemaining?: number | undefined;
  error?: string | undefined;
} {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);

  const lockoutStatus = isLockedOut(canonicalEmail);
  if (lockoutStatus.locked) {
    return {
      success: false,
      cooldownSecondsRemaining: lockoutStatus.retryAfterSeconds,
      error: `Too many incorrect attempts. Please wait ${lockoutStatus.retryAfterSeconds} seconds before trying again.`,
    };
  }

  const entry = pendingSignups.get(canonicalEmail);

  if (!entry) {
    return {
      success: false,
      error: 'No pending registration found. Please fill out the registration form again.',
    };
  }

  const now = Date.now();
  const timeSinceLastSent = now - entry.lastSentAt;

  if (timeSinceLastSent < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastSent) / 1000);
    return {
      success: false,
      cooldownSecondsRemaining: remainingSeconds,
      error: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting a new code.`,
    };
  }

  const newOtp = generateSecureOtp();
  entry.otp = newOtp;
  entry.lastSentAt = now;
  entry.expiresAt = now + OTP_TTL_MS;
  entry.attempts = 0; // Reset attempts on fresh OTP

  return {
    success: true,
    otp: newOtp,
  };
}

export function clearPendingSignup(email: string): void {
  const canonicalEmail = resolveCanonicalEmail(email);
  pendingSignups.delete(canonicalEmail);
  clearLockout(canonicalEmail);
}

export function createPasswordResetOtp(email: string): {
  otp: string;
  expiresAt: Date;
} {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);
  const now = Date.now();
  const otp = generateSecureOtp();

  const entry: PendingPasswordResetEntry = {
    email: canonicalEmail,
    otp,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    lastSentAt: now,
    attempts: 0,
  };

  pendingPasswordResets.set(canonicalEmail, entry);

  return {
    otp,
    expiresAt: new Date(entry.expiresAt),
  };
}

export function getPendingPasswordReset(email: string): PendingPasswordResetEntry | null {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);
  return pendingPasswordResets.get(canonicalEmail) || null;
}

export function verifyPasswordResetOtp(
  email: string,
  providedOtp: string
): {
  success: boolean;
  error?: string | undefined;
} {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);

  // Check if reset lockout is active
  const lockoutKey = `reset:${canonicalEmail}`;
  const lockoutStatus = isLockedOut(lockoutKey);
  if (lockoutStatus.locked) {
    const minutes = Math.ceil(lockoutStatus.retryAfterSeconds / 60);
    return {
      success: false,
      error: `Too many incorrect attempts. Verification is temporarily locked for ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    };
  }

  const entry = pendingPasswordResets.get(canonicalEmail);

  if (!entry) {
    return {
      success: false,
      error: 'No active password reset request found or the code has expired. Please request a new code.',
    };
  }

  const now = Date.now();
  if (now > entry.expiresAt) {
    pendingPasswordResets.delete(canonicalEmail);
    return {
      success: false,
      error: 'Verification code has expired. Please request a new code.',
    };
  }

  const cleanProvided = providedOtp.replace(/\D/g, '').trim();

  // Timing-safe comparison to prevent timing side channels
  if (!constantTimeEquals(cleanProvided, entry.otp)) {
    entry.attempts += 1;
    const lockout = recordFailedAttempt(lockoutKey, MAX_VERIFICATION_ATTEMPTS, LOCKOUT_DURATION_MS);

    if (lockout.locked) {
      pendingPasswordResets.delete(canonicalEmail);
      return {
        success: false,
        error: 'Too many incorrect attempts. Verification is temporarily locked for 15 minutes.',
      };
    }

    const remaining = lockout.remainingAttempts;
    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // OTP verified successfully: delete single-use entry and clear lockout
  pendingPasswordResets.delete(canonicalEmail);
  clearLockout(lockoutKey);

  return {
    success: true,
  };
}

export function resendPasswordResetOtp(email: string): {
  success: boolean;
  otp?: string | undefined;
  cooldownSecondsRemaining?: number | undefined;
  error?: string | undefined;
} {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);

  const lockoutKey = `reset:${canonicalEmail}`;
  const lockoutStatus = isLockedOut(lockoutKey);
  if (lockoutStatus.locked) {
    return {
      success: false,
      cooldownSecondsRemaining: lockoutStatus.retryAfterSeconds,
      error: `Too many incorrect attempts. Please wait ${lockoutStatus.retryAfterSeconds} seconds before trying again.`,
    };
  }

  const entry = pendingPasswordResets.get(canonicalEmail);

  if (!entry) {
    // If no existing entry, generate a fresh one
    const { otp } = createPasswordResetOtp(canonicalEmail);
    return {
      success: true,
      otp,
    };
  }

  const now = Date.now();
  const timeSinceLastSent = now - entry.lastSentAt;

  if (timeSinceLastSent < RESEND_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastSent) / 1000);
    return {
      success: false,
      cooldownSecondsRemaining: remainingSeconds,
      error: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting a new code.`,
    };
  }

  const newOtp = generateSecureOtp();
  entry.otp = newOtp;
  entry.lastSentAt = now;
  entry.expiresAt = now + OTP_TTL_MS;
  entry.attempts = 0; // Reset failed attempts on fresh code dispatch

  return {
    success: true,
    otp: newOtp,
  };
}

export function clearPendingPasswordReset(email: string): void {
  const canonicalEmail = resolveCanonicalEmail(email);
  pendingPasswordResets.delete(canonicalEmail);
  clearLockout(`reset:${canonicalEmail}`);
}

// For unit tests
export function _resetOtpStore(): void {
  pendingSignups.clear();
  pendingPasswordResets.clear();
}
