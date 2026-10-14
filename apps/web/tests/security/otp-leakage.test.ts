import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { signUpTenantUser, sendPasswordResetOtpViaSupabase } from '@/lib/supabase-auth';

describe('Security Audit: Zero OTP Token Leakage in Logging (ISSUE-15)', () => {
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;
  let infoSpy: any;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signUpTenantUser does not emit the plain-text verification OTP to stdout or stderr', async () => {
    const res = await signUpTenantUser({
      email: 'security-test-user@domain.com',
      password: 'SecurePassword123!',
      name: 'Security Test User',
      phone: '+15551234567',
    });

    expect(res.requiresOtp).toBe(true);
    expect(res.simulatedOtp).toBeDefined();
    const otp = res.simulatedOtp!;

    // Check all log calls to ensure plain-text OTP is never logged
    for (const spy of [logSpy, warnSpy, errorSpy, infoSpy]) {
      for (const call of spy.mock.calls) {
        const logContent = call.join(' ');
        expect(logContent).not.toContain(otp);
      }
    }
  });

  it('sendPasswordResetOtpViaSupabase does not emit the plain-text password reset OTP to stdout or stderr', async () => {
    const res = await sendPasswordResetOtpViaSupabase('reset-user@domain.com');

    expect(res.success).toBe(true);
    expect(res.otp).toBeDefined();
    const otp = res.otp!;

    // Check all log calls to ensure plain-text OTP is never logged
    for (const spy of [logSpy, warnSpy, errorSpy, infoSpy]) {
      for (const call of spy.mock.calls) {
        const logContent = call.join(' ');
        expect(logContent).not.toContain(otp);
      }
    }
  });
});
