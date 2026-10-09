import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as signupHandler } from '../../src/app/api/auth/signup/route';
import { POST as verifyOtpHandler } from '../../src/app/api/auth/signup/verify-otp/route';
import { POST as resendOtpHandler } from '../../src/app/api/auth/signup/resend-otp/route';
import { _resetOtpStore, getPendingSignup } from '../../src/lib/otp-service';

describe('Signup OTP API Flow (Spec 013 - Email Confirmation with Resend)', () => {
  beforeEach(() => {
    _resetOtpStore();
    process.env.SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
  });

  it('initiates signup and returns requiresOtp without issuing session cookie immediately', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ellen Ripley',
        phone: '+15554321098',
        email: 'ripley@weyland.corp',
        password: 'Password123!',
      }),
    });

    const res = await signupHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.requiresOtp).toBe(true);
    expect(body.email).toBe('ripley@weyland.corp');

    // Cookie must NOT be set until OTP is verified
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeNull();

    // Pending registration must exist
    const pending = getPendingSignup('ripley@weyland.corp');
    expect(pending).not.toBeNull();
    expect(pending?.otp).toHaveLength(6);
  });

  it('rejects invalid or short OTP on verification', async () => {
    const signupReq = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ripley Jr',
        phone: '+15554321099',
        email: 'ripleyj@weyland.corp',
        password: 'Password123!',
      }),
    });
    await signupHandler(signupReq);

    const verifyReq = new NextRequest('http://localhost:3000/api/auth/signup/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ripleyj@weyland.corp',
        otp: '000000',
      }),
    });

    const verifyRes = await verifyOtpHandler(verifyReq);
    expect(verifyRes.status).toBe(400);
    const body = await verifyRes.json();
    expect(body.error).toContain('Invalid verification code');
  });

  it('activates account, sets session cookie, and returns workspace redirect on valid OTP', async () => {
    const email = 'hero@domain.com';
    const signupReq = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hero User',
        phone: '+15551112222',
        email,
        password: 'Password123!',
      }),
    });
    await signupHandler(signupReq);

    const pending = getPendingSignup(email);
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
    expect(body.user.email).toBe(email);
    expect(body.redirectUrl).toContain('/media');

    // Cookie must be set
    const setCookie = verifyRes.headers.get('set-cookie');
    expect(setCookie).toContain('fbup_session=');
  });

  it('rejects duplicate signup if email already exists', async () => {
    const email = 'duplicate@domain.com';
    // First signup and verification
    const signupReq1 = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'First User',
        phone: '+15550001111',
        email,
        password: 'Password123!',
      }),
    });
    await signupHandler(signupReq1);
    const pending = getPendingSignup(email);
    const verifyReq = new NextRequest('http://localhost:3000/api/auth/signup/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: pending!.otp }),
    });
    await verifyOtpHandler(verifyReq);

    // Second signup with same email should return 409
    const signupReq2 = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Second User',
        phone: '+15550002222',
        email,
        password: 'Password123!',
      }),
    });
    const res2 = await signupHandler(signupReq2);
    expect(res2.status).toBe(409);
    const body2 = await res2.json();
    expect(body2.error).toContain('Email is already registered');
  });
});
