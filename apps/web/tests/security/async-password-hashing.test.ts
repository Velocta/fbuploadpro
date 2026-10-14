/**
 * @file async-password-hashing.test.ts
 * @description Security & Performance regression tests for ISSUE-37: Event-Loop Blocking via Synchronous crypto.pbkdf2Sync
 * Verifies that:
 * 1. hashPassword and verifyHashedPassword in otp-service are asynchronous and use non-blocking crypto.pbkdf2.
 * 2. Asynchronous password hashing allows event loop tasks (setImmediate/setTimeout) to execute concurrently.
 * 3. verifyPendingSignupPassword returns a Promise<boolean> and does not block the event loop.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyHashedPassword,
  createPendingSignup,
  verifyPendingSignupPassword,
  verifyPendingSignupPasswordSync,
  _resetOtpStore,
} from '@/lib/otp-service';

describe('ISSUE-37: Non-Blocking Asynchronous PBKDF2 Password Hashing', () => {
  beforeEach(() => {
    _resetOtpStore();
  });

  it('hashes passwords asynchronously without blocking the event loop', async () => {
    let eventLoopTicked = false;
    setImmediate(() => {
      eventLoopTicked = true;
    });

    const hashPromise = hashPassword('MySecurePassword123!');
    expect(hashPromise).toBeInstanceOf(Promise);

    const hash = await hashPromise;
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/i);
    // Event loop must have been free to process the immediate callback while PBKDF2 ran in worker pool
    expect(eventLoopTicked).toBe(true);
  });

  it('verifies password hashes asynchronously and accurately', async () => {
    const rawPassword = 'ValidPassword123!';
    const hash = await hashPassword(rawPassword);

    let eventLoopTicked = false;
    setImmediate(() => {
      eventLoopTicked = true;
    });

    const verifyPromise = verifyHashedPassword(rawPassword, hash);
    expect(verifyPromise).toBeInstanceOf(Promise);

    const isMatch = await verifyPromise;
    expect(isMatch).toBe(true);
    expect(eventLoopTicked).toBe(true);

    const isMismatch = await verifyHashedPassword('WrongPassword123!', hash);
    expect(isMismatch).toBe(false);
  });

  it('verifies pending signup passwords asynchronously via verifyPendingSignupPassword', async () => {
    const email = 'async-user@gmail.com';
    const password = 'UserPassword123!';

    createPendingSignup({
      name: 'Async User',
      phone: '+15555550199',
      email,
      password,
    });

    let eventLoopTicked = false;
    setImmediate(() => {
      eventLoopTicked = true;
    });

    const checkPromise = verifyPendingSignupPassword(email, password);
    expect(checkPromise).toBeInstanceOf(Promise);

    const isCorrect = await checkPromise;
    expect(isCorrect).toBe(true);
    expect(eventLoopTicked).toBe(true);

    const isIncorrect = await verifyPendingSignupPassword(email, 'WrongPassword!');
    expect(isIncorrect).toBe(false);
  });

  it('handles malformed hashes and exception handling in verifyHashedPassword gracefully', async () => {
    // Malformed regex
    expect(await verifyHashedPassword('password', 'not-a-valid-hash')).toBe(false);
    expect(await verifyHashedPassword('password', '')).toBe(false);
    expect(await verifyHashedPassword('password', null as unknown as string)).toBe(false);

    // Missing split parts or invalid hex length
    expect(await verifyHashedPassword('password', '0123456789abcdef0123456789abcdef:1234')).toBe(false);

    // Synchronous fallback verification test
    const email = 'sync-user@gmail.com';
    const password = 'SyncPassword123!';
    createPendingSignup({
      name: 'Sync User',
      phone: '+15555550188',
      email,
      password,
    });
    expect(verifyPendingSignupPasswordSync(email, password)).toBe(true);
    expect(verifyPendingSignupPasswordSync(email, 'WrongPassword!')).toBe(false);
    expect(verifyPendingSignupPasswordSync('unknown@example.com', password)).toBe(false);
  });
});
