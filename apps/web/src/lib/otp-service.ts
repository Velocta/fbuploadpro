import type { SignupRequest } from '@fbuploadpro/contracts';

export interface PendingSignupEntry {
  data: SignupRequest;
  otp: string;
  createdAt: number;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_VERIFICATION_ATTEMPTS = 5;

// In-memory store for pending signups
const pendingSignups = new Map<string, PendingSignupEntry>();

export function generateSecureOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const randomValue = array[0] ?? 0;
  // Produce exactly 6 digits between 100000 and 999999
  const otpNumber = 100000 + (randomValue % 900000);
  return otpNumber.toString();
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
}

export function createPendingSignup(data: SignupRequest): {
  otp: string;
  expiresAt: Date;
} {
  cleanupExpiredEntries();
  const emailLower = data.email.trim().toLowerCase();
  const now = Date.now();
  const otp = generateSecureOtp();

  const entry: PendingSignupEntry = {
    data: {
      ...data,
      email: emailLower,
    },
    otp,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    lastSentAt: now,
    attempts: 0,
  };

  pendingSignups.set(emailLower, entry);

  return {
    otp,
    expiresAt: new Date(entry.expiresAt),
  };
}

export function getPendingSignup(email: string): PendingSignupEntry | null {
  cleanupExpiredEntries();
  const emailLower = email.trim().toLowerCase();
  return pendingSignups.get(emailLower) || null;
}

export function verifySignupOtp(
  email: string,
  providedOtp: string
): {
  success: boolean;
  signupData?: SignupRequest | undefined;
  error?: string | undefined;
} {
  cleanupExpiredEntries();
  const emailLower = email.trim().toLowerCase();
  const entry = pendingSignups.get(emailLower);

  if (!entry) {
    return {
      success: false,
      error: 'No pending registration found or the code has expired. Please sign up again.',
    };
  }

  const now = Date.now();
  if (now > entry.expiresAt) {
    pendingSignups.delete(emailLower);
    return {
      success: false,
      error: 'Verification code has expired. Please request a new code.',
    };
  }

  if (entry.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    pendingSignups.delete(emailLower);
    return {
      success: false,
      error: 'Too many incorrect attempts. Please start your registration again.',
    };
  }

  const cleanProvided = providedOtp.replace(/\D/g, '').trim();
  if (cleanProvided !== entry.otp) {
    entry.attempts += 1;
    const remaining = MAX_VERIFICATION_ATTEMPTS - entry.attempts;
    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // OTP verified successfully
  const signupData = entry.data;
  pendingSignups.delete(emailLower);

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
  const emailLower = email.trim().toLowerCase();
  const entry = pendingSignups.get(emailLower);

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
  const emailLower = email.trim().toLowerCase();
  pendingSignups.delete(emailLower);
}

// For unit tests
export function _resetOtpStore(): void {
  pendingSignups.clear();
}
