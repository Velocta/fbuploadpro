import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as signupHandler } from '../../src/app/api/auth/signup/route';
import { _resetOtpStore } from '../../src/lib/otp-service';
import { _resetRateLimiter } from '../../src/lib/rate-limiter';

describe('POST /api/auth/signup Guard (Spec 064)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SIGNUPS_ENABLED;

  beforeEach(() => {
    _resetOtpStore();
    _resetRateLimiter();
    process.env.SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SIGNUPS_ENABLED = originalEnv;
  });

  it('rejects signup with HTTP 403 when NEXT_PUBLIC_SIGNUPS_ENABLED="false"', async () => {
    process.env.NEXT_PUBLIC_SIGNUPS_ENABLED = 'false';

    const req = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        phone: '+1 415 555 2671',
        email: 'john.doe@gmail.com',
        password: 'Password123!',
      }),
    });

    const res = await signupHandler(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe(
      'Account registration is temporarily paused. Please check back shortly or sign in to your existing account.'
    );
  });

  it('rejects signup with HTTP 403 for other falsy tokens ("0", "off", "disabled")', async () => {
    for (const val of ['0', 'off', 'disabled', 'FALSE']) {
      process.env.NEXT_PUBLIC_SIGNUPS_ENABLED = val;

      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Smith',
          phone: '+1 415 555 2672',
          email: 'jane.smith@gmail.com',
          password: 'Password123!',
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Account registration is temporarily paused');
    }
  });

  it('allows request through the guard when NEXT_PUBLIC_SIGNUPS_ENABLED="true"', async () => {
    process.env.NEXT_PUBLIC_SIGNUPS_ENABLED = 'true';

    const req = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Valid User',
        phone: '+1 415 555 2673',
        email: 'valid.user@gmail.com',
        password: 'Password123!',
      }),
    });

    const res = await signupHandler(req);
    // When enabled, request succeeds (200) with requiresOtp
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.requiresOtp).toBe(true);
  });
});
