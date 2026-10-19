/**
 * @file account-health.test.ts
 * @description Unit tests for the single account-health model (Spec 102).
 * Every surface reads connection health from here — no independent status strings.
 */

import { describe, it, expect } from 'vitest';
import { STATUS_SIGNALS } from '@/lib/theme';
import {
  getAccountHealth,
  getAccountHealthLabel,
  getAccountHealthSignal,
  isTokenExpiringSoon,
} from '@/components/accounts/account-health';

const NOW = new Date('2026-10-19T12:00:00Z');
const future = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
const past = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('getAccountHealth (Spec 102)', () => {
  it('returns connected for an active account with a future token expiry', () => {
    expect(
      getAccountHealth({ status: 'active', tokenExpiresAt: future(30) }, NOW)
    ).toBe('connected');
  });

  it('returns connected when no expiry is known', () => {
    expect(getAccountHealth({ status: 'active' }, NOW)).toBe('connected');
  });

  it('returns expired for explicit expired status even with a future expiry', () => {
    expect(
      getAccountHealth({ status: 'expired', tokenExpiresAt: future(30) }, NOW)
    ).toBe('expired');
  });

  it('returns expired when the token expiry is in the past', () => {
    expect(
      getAccountHealth({ status: 'active', tokenExpiresAt: past(1) }, NOW)
    ).toBe('expired');
  });

  it('returns error for a disconnected account', () => {
    expect(getAccountHealth({ status: 'disconnected' }, NOW)).toBe('error');
  });

  it('ignores malformed token expiry dates', () => {
    expect(
      getAccountHealth({ status: 'active', tokenExpiresAt: 'not-a-date' }, NOW)
    ).toBe('connected');
  });
});

describe('isTokenExpiringSoon (Spec 102)', () => {
  it('is true within the 7-day window', () => {
    expect(
      isTokenExpiringSoon({ status: 'active', tokenExpiresAt: future(3) }, NOW)
    ).toBe(true);
  });

  it('is false outside the window', () => {
    expect(
      isTokenExpiringSoon({ status: 'active', tokenExpiresAt: future(30) }, NOW)
    ).toBe(false);
  });

  it('is false for expired or error accounts', () => {
    expect(
      isTokenExpiringSoon({ status: 'expired', tokenExpiresAt: future(3) }, NOW)
    ).toBe(false);
    expect(
      isTokenExpiringSoon(
        { status: 'disconnected', tokenExpiresAt: future(3) },
        NOW
      )
    ).toBe(false);
  });
});

describe('getAccountHealthLabel (Spec 102)', () => {
  it('uses one consistent status string per state', () => {
    expect(getAccountHealthLabel('connected')).toBe('Connected');
    expect(getAccountHealthLabel('expired')).toBe('Session expired');
    expect(getAccountHealthLabel('error')).toBe('Connection error');
  });
});

describe('getAccountHealthSignal (Spec 102)', () => {
  it('maps health to theme signals', () => {
    expect(getAccountHealthSignal('connected')).toBe('operational');
    expect(getAccountHealthSignal('expired')).toBe('critical');
    expect(getAccountHealthSignal('error')).toBe('critical');
    // Sanity: the signals exist in the theme
    expect(STATUS_SIGNALS.operational.color).toBeTruthy();
    expect(STATUS_SIGNALS.critical.color).toBeTruthy();
  });
});
