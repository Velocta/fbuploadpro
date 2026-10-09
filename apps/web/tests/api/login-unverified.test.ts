import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleLogin } from '../../src/app/api/auth/login/route';
import { createPendingSignup, _resetOtpStore, getPendingSignup } from '../../src/lib/otp-service';
import { _resetRateLimiter } from '../../src/lib/rate-limiter';
import * as dbModule from '../../src/lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

describe('Login Unverified Registration Recovery (Spec 021 US1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetOtpStore();
    _resetRateLimiter();
    process.env.SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
    delete process.env.DATABASE_URL;
  });

  it('detects unverified pending registration with correct password, issues fresh OTP, and returns 403 requiresOtp', async () => {
    // Stage an unverified pending signup
    const signupData = {
      name: 'Arthur Morgan',
      phone: '+14155552671',
      email: 'arthur.morgan@gmail.com',
      password: 'Outlaws123!',
    };
    const { otp: initialOtp } = createPendingSignup(signupData);

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        email: 'arthur.morgan@gmail.com',
        password: 'Outlaws123!',
      }),
    });

    const res = await handleLogin(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.requiresOtp).toBe(true);
    expect(body.email).toBe('arthurmorgan@gmail.com');
    expect(body.error).toContain('verify your email address');

    // Verify OTP was refreshed
    const updated = getPendingSignup('arthurmorgan@gmail.com');
    expect(updated).not.toBeNull();
    expect(updated?.otp).toBeDefined();
    // New OTP should be valid 6 digits
    expect(updated?.otp).toMatch(/^\d{6}$/);
  });

  it('returns standard 401 Invalid email or password when password does not match pending registration', async () => {
    // Stage an unverified pending signup
    createPendingSignup({
      name: 'John Marston',
      phone: '+14155552671',
      email: 'john.marston@gmail.com',
      password: 'CorrectPassword123!',
    });

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.2',
      },
      body: JSON.stringify({
        email: 'john.marston@gmail.com',
        password: 'WrongPassword123!',
      }),
    });

    const res = await handleLogin(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.requiresOtp).toBeUndefined();
    expect(body.error).toBe('Invalid email or password');
  });

  it('returns uniform rate limit message without leaking whether account exists', async () => {
    const email = 'unknown.user@gmail.com';

    // Send 5 rapid failed login attempts to exhaust account rate limit (limit is 5 per 60s)
    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `192.168.1.${i + 1}`, // different IPs so we isolate email rate limiter
        },
        body: JSON.stringify({
          email,
          password: 'RandomPassword123!',
        }),
      });
      await handleLogin(req);
    }

    // 6th attempt hits email rate limit
    const lockedReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.100',
      },
      body: JSON.stringify({
        email,
        password: 'RandomPassword123!',
      }),
    });

    const res = await handleLogin(lockedReq);
    expect(res.status).toBe(429);

    const body = await res.json();
    // Must be uniform: "Too many sign in attempts. Please wait..." (no "for this account")
    expect(body.error).toContain('Too many sign in attempts.');
    expect(body.error).not.toContain('for this account');
  });
});
