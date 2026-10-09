import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as signupHandler } from '../../src/app/api/auth/signup/route';
import { POST as verifyOtpHandler } from '../../src/app/api/auth/signup/verify-otp/route';
import { POST as resendOtpHandler } from '../../src/app/api/auth/signup/resend-otp/route';
import { _resetOtpStore, getPendingSignup } from '../../src/lib/otp-service';
import { _resetRateLimiter } from '../../src/lib/rate-limiter';

describe('Signup OTP API Flow (Spec 014 - Hardened)', () => {
  beforeEach(() => {
    _resetOtpStore();
    _resetRateLimiter();
    process.env.SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
  });

  it('initiates signup and returns requiresOtp with canonical email without issuing session cookie immediately', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ellen Ripley',
        phone: '+1 415 555 2671',
        email: 'Ellen.Ripley+promo@GMAIL.COM',
        password: 'Password123!',
      }),
    });

    const res = await signupHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.requiresOtp).toBe(true);
    expect(body.email).toBe('ellenripley@gmail.com');

    // Cookie must NOT be set until OTP is verified
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeNull();

    // Pending registration must exist under canonical email
    const pending = getPendingSignup('ellenripley@gmail.com');
    expect(pending).not.toBeNull();
    expect(pending?.otp).toHaveLength(6);
  });

  it('rejects invalid or short OTP on verification', async () => {
    const signupReq = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ripley Jr',
        phone: '+14155552672',
        email: 'ripleyj@gmail.com',
        password: 'Password123!',
      }),
    });
    await signupHandler(signupReq);

    const verifyReq = new NextRequest('http://localhost:3000/api/auth/signup/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ripleyj@gmail.com',
        otp: '000000',
      }),
    });

    const verifyRes = await verifyOtpHandler(verifyReq);
    expect(verifyRes.status).toBe(400);
    const body = await verifyRes.json();
    expect(body.error).toContain('Invalid verification code');
  });

  it('activates account, sets session cookie, and returns workspace redirect on valid OTP', async () => {
    const email = 'hero.user@gmail.com';
    const canonicalEmail = 'herouser@gmail.com';

    const signupReq = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hero User',
        phone: '+14155552673',
        email,
        password: 'Password123!',
      }),
    });
    await signupHandler(signupReq);

    const pending = getPendingSignup(canonicalEmail);
    expect(pending).not.toBeNull();
    const validOtp = pending!.otp;

    const verifyReq = new NextRequest('http://localhost:3000/api/auth/signup/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        otp: validOtp,
        returnUrl: '/media',
      }),
    });

    const verifyRes = await verifyOtpHandler(verifyReq);
    expect(verifyRes.status).toBe(201);
    const body = await verifyRes.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe(canonicalEmail);
    expect(body.redirectUrl).toContain('/media');

    // Cookie must be set
    const setCookie = verifyRes.headers.get('set-cookie');
    expect(setCookie).toContain('fbup_session=');
  });

  it('rejects duplicate signup if canonical email already exists (aliasing deduplication)', async () => {
    // First signup and verification
    const signupReq1 = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'First User',
        phone: '+14155552674',
        email: 'duplicate.user@gmail.com',
        password: 'Password123!',
      }),
    });
    await signupHandler(signupReq1);
    const pending = getPendingSignup('duplicateuser@gmail.com');
    const verifyReq = new NextRequest('http://localhost:3000/api/auth/signup/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'duplicateuser@gmail.com', otp: pending!.otp }),
    });
    await verifyOtpHandler(verifyReq);

    // Second signup with same underlying Gmail inbox using dots & plus tags should return 409
    const signupReq2 = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second User',
        phone: '+14155552675',
        email: 'd.u.p.l.i.c.a.t.e.u.s.e.r+alias@gmail.com',
        password: 'Password123!',
      }),
    });
    const res2 = await signupHandler(signupReq2);
    expect(res2.status).toBe(409);
    const body2 = await res2.json();
    expect(body2.error).toContain('Email is already registered');
  });

  it('rejects non-gmail addresses with validation error', async () => {
    const signupReq = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Domain',
        phone: '+14155552676',
        email: 'user@yahoo.com',
        password: 'Password123!',
      }),
    });

    const res = await signupHandler(signupReq);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('enforces IP rate limiting after excessive signup calls', async () => {
    const makeReq = (emailNum: number) =>
      new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.99' },
        body: JSON.stringify({
          name: 'Spam User',
          phone: '+14155552677',
          email: `spam.user${emailNum}@gmail.com`,
          password: 'Password123!',
        }),
      });

    for (let i = 0; i < 5; i++) {
      const res = await signupHandler(makeReq(i));
      expect([200, 409]).toContain(res.status);
    }

    // 6th request triggers IP rate limit 429
    const limitedRes = await signupHandler(makeReq(5));
    expect(limitedRes.status).toBe(429);
    const body = await limitedRes.json();
    expect(body.error).toContain('Too many registration attempts');
  });

  it('enforces email identifier rate limiting after 3 requests for same email', async () => {
    const makeReq = () =>
      new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Target User',
          phone: '+14155552678',
          email: 'target.email@gmail.com',
          password: 'Password123!',
        }),
      });

    for (let i = 0; i < 3; i++) {
      const res = await signupHandler(makeReq());
      expect([200, 409]).toContain(res.status);
    }

    // 4th request triggers email rate limit 429
    const limitedRes = await signupHandler(makeReq());
    expect(limitedRes.status).toBe(429);
    const body = await limitedRes.json();
    expect(body.error).toContain('Too many verification requests for this email address');
  });
});
