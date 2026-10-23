import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { canonicalizeGmailAddress } from '@fbuploadpro/contracts';
import { isLockedOut, recordFailedAttempt, clearLockout } from '@/lib/rate-limiter';

const pbkdf2Async = promisify(crypto.pbkdf2);

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

/**
 * The ONE error every failed code check returns (spec 139 B2): a wrong
 * code, the failure that engages the lockout, and any attempt made while
 * locked are byte-identical, so the verify response is never an oracle
 * for the lockout state or the remaining-attempt count.
 */
export const INVALID_OTP_ERROR = 'Invalid verification code.';

// In-memory store for pending signups
const pendingSignups = new Map<string, PendingSignupEntry>();
// In-memory store for pending password resets
const pendingPasswordResets = new Map<string, PendingPasswordResetEntry>();

export function validateOtpServiceConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || (!key && !serviceKey)) {
      throw new Error(
        'Native Supabase Auth credentials (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY) are strictly required for authentication and OTP in production.'
      );
    }
  }
}

export const PRE_HASHED_PASSWORD_REGEX = /^[0-9a-f]{32}:[0-9a-f]{64}$/i;

export function isPreHashedPassword(password: string): boolean {
  return typeof password === 'string' && PRE_HASHED_PASSWORD_REGEX.test(password);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derivedKey = await pbkdf2Async(password, salt, 100000, 32, 'sha256');
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyHashedPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (!storedHash || typeof storedHash !== 'string' || !PRE_HASHED_PASSWORD_REGEX.test(storedHash)) {
      return false;
    }
    const [saltHex, keyHex] = storedHash.split(':');
    if (!saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(keyHex, 'hex');
    if (salt.length !== 16 || expectedKey.length < 32) return false;
    const actualKey = await pbkdf2Async(password, salt, 100000, expectedKey.length, 'sha256');
    if (actualKey.length !== expectedKey.length || actualKey.length < 32) return false;
    return crypto.timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

export function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export function verifyHashedPasswordSync(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || typeof storedHash !== 'string' || !PRE_HASHED_PASSWORD_REGEX.test(storedHash)) {
      return false;
    }
    const [saltHex, keyHex] = storedHash.split(':');
    if (!saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(keyHex, 'hex');
    if (salt.length !== 16 || expectedKey.length < 32) return false;
    const actualKey = crypto.pbkdf2Sync(password, salt, 100000, expectedKey.length, 'sha256');
    if (actualKey.length !== expectedKey.length || actualKey.length < 32) return false;
    return crypto.timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

export function generateSecureOtp(): string {
  // Produce exactly 6 digits between 100000 and 999999 with uniform cryptographic distribution
  const otpNumber = crypto.randomInt(100000, 1000000);
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

async function assertNotLockedOut(key: string): Promise<void> {
  const status = await isLockedOut(key);
  if (status.locked) {
    const minutes = Math.ceil(status.retryAfterSeconds / 60);
    throw new Error(
      `Too many incorrect attempts. Verification is temporarily locked for ${minutes} minute${minutes === 1 ? '' : 's'}.`
    );
  }
}

export async function createPendingSignup(data: {
  name: string;
  phone: string;
  email: string;
  password?: string | undefined;
  hashedPassword?: string | undefined;
}): Promise<{
  otp: string;
  expiresAt: Date;
}> {
  validateOtpServiceConfig();
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      `[OTP Service] Fallback in-memory pendingSignup used in production for ${data.email}. Native Supabase GoTrue Auth should be used for serverless persistence.`
    );
  }
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(data.email);
  await assertNotLockedOut(canonicalEmail);

  const now = Date.now();
  const otp = generateSecureOtp();

  const rawPassword = data.password || '';
  let hashedPassword = data.hashedPassword;
  if (!hashedPassword) {
    hashedPassword = isPreHashedPassword(rawPassword) ? rawPassword : hashPasswordSync(rawPassword);
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

export async function verifyPendingSignupPassword(email: string, candidatePassword: string): Promise<boolean> {
  cleanupExpiredEntries();
  const entry = getPendingSignup(email);
  if (!entry?.data?.hashedPassword) return false;
  return await verifyHashedPassword(candidatePassword, entry.data.hashedPassword);
}
async function updatePendingSignupOtpEntry(entry: PendingSignupEntry): Promise<string> {
  const now = Date.now();
  const newOtp = generateSecureOtp();
  entry.otp = newOtp;
  entry.lastSentAt = now;
  entry.expiresAt = now + OTP_TTL_MS;
  entry.attempts = 0;
  await clearLockout(entry.data.email);
  return newOtp;
}
export async function verifySignupOtp(
  email: string,
  providedOtp: string
): Promise<{
  success: boolean;
  signupData?: StagedSignupData | undefined;
  error?: string | undefined;
}> {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);

  // Check if identifier is currently locked out. The response is the same
  // INVALID_OTP_ERROR a wrong code gets (no lockout-state oracle).
  const lockoutStatus = await isLockedOut(canonicalEmail);
  if (lockoutStatus.locked) {
    return {
      success: false,
      error: INVALID_OTP_ERROR,
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

  const cleanProvided = typeof providedOtp === 'string' ? providedOtp.trim() : '';
  if (!/^\d{6}$/.test(cleanProvided)) {
    return {
      success: false,
      error: 'Invalid verification code. Code must be exactly 6 digits.',
    };
  }

  // Use timingSafeEqual to compare OTPs
  if (!constantTimeEquals(cleanProvided, entry.otp)) {
    entry.attempts += 1;
    const lockout = await recordFailedAttempt(canonicalEmail, MAX_VERIFICATION_ATTEMPTS, LOCKOUT_DURATION_MS);

    if (lockout.locked) {
      pendingSignups.delete(canonicalEmail);
    }

    // Byte-identical to the locked-state response above (no oracle).
    return {
      success: false,
      error: INVALID_OTP_ERROR,
    };
  }

  // OTP verified successfully
  const signupData = entry.data;
  pendingSignups.delete(canonicalEmail);
  await clearLockout(canonicalEmail);

  return {
    success: true,
    signupData,
  };
}

export async function resendSignupOtp(email: string): Promise<{
  success: boolean;
  otp?: string | undefined;
  cooldownSecondsRemaining?: number | undefined;
  error?: string | undefined;
}> {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);

  const lockoutStatus = await isLockedOut(canonicalEmail);
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

  const newOtp = await updatePendingSignupOtpEntry(entry);

  return {
    success: true,
    otp: newOtp,
  };
}

export async function createPasswordResetOtp(email: string): Promise<{
  otp: string;
  expiresAt: Date;
}> {
  validateOtpServiceConfig();
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      `[OTP Service] Fallback in-memory pendingPasswordReset used in production for ${email}. Native Supabase GoTrue Auth should be used for serverless persistence.`
    );
  }
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);
  await assertNotLockedOut(`reset:${canonicalEmail}`);

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
export async function verifyPasswordResetOtp(
  email: string,
  providedOtp: string
): Promise<{
  success: boolean;
  error?: string | undefined;
}> {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);

  // Check if reset lockout is active. The response is the same
  // INVALID_OTP_ERROR a wrong code gets (no lockout-state oracle).
  const lockoutKey = `reset:${canonicalEmail}`;
  const lockoutStatus = await isLockedOut(lockoutKey);
  if (lockoutStatus.locked) {
    return {
      success: false,
      error: INVALID_OTP_ERROR,
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

  const cleanProvided = typeof providedOtp === 'string' ? providedOtp.trim() : '';
  if (!/^\d{6}$/.test(cleanProvided)) {
    return {
      success: false,
      error: 'Invalid verification code. Code must be exactly 6 digits.',
    };
  }

  // Timing-safe comparison to prevent timing side channels
  if (!constantTimeEquals(cleanProvided, entry.otp)) {
    entry.attempts += 1;
    const lockout = await recordFailedAttempt(lockoutKey, MAX_VERIFICATION_ATTEMPTS, LOCKOUT_DURATION_MS);

    if (lockout.locked) {
      pendingPasswordResets.delete(canonicalEmail);
    }

    // Byte-identical to the locked-state response above (no oracle).
    return {
      success: false,
      error: INVALID_OTP_ERROR,
    };
  }

  // OTP verified successfully: delete single-use entry and clear lockout
  pendingPasswordResets.delete(canonicalEmail);
  await clearLockout(lockoutKey);

  return {
    success: true,
  };
}

export async function resendPasswordResetOtp(email: string): Promise<{
  success: boolean;
  otp?: string | undefined;
  cooldownSecondsRemaining?: number | undefined;
  error?: string | undefined;
}> {
  cleanupExpiredEntries();
  const canonicalEmail = resolveCanonicalEmail(email);

  const lockoutKey = `reset:${canonicalEmail}`;
  const lockoutStatus = await isLockedOut(lockoutKey);
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
    const { otp } = await createPasswordResetOtp(canonicalEmail);
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
  await clearLockout(lockoutKey); // Synchronize rate-limiter lockout state on fresh code dispatch

  return {
    success: true,
    otp: newOtp,
  };
}

// For unit tests
export function _resetOtpStore(): void {
  pendingSignups.clear();
  pendingPasswordResets.clear();
}
