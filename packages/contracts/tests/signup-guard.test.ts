import { describe, expect, it } from 'vitest';
import { isSignupEnabled } from '../src/domain/auth.js';

describe('isSignupEnabled', () => {
  it('defaults to true when environment variables are undefined', () => {
    expect(isSignupEnabled({})).toBe(true);
  });

  it('returns true when NEXT_PUBLIC_SIGNUPS_ENABLED is "true"', () => {
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: 'true' })).toBe(true);
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: 'TRUE' })).toBe(true);
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: '  true  ' })).toBe(true);
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: '1' })).toBe(true);
  });

  it('returns false when NEXT_PUBLIC_SIGNUPS_ENABLED is "false"', () => {
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: 'false' })).toBe(false);
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: 'FALSE' })).toBe(false);
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: '  false  ' })).toBe(false);
  });

  it('returns false for alternative falsy values (0, off, disabled)', () => {
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: '0' })).toBe(false);
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: 'off' })).toBe(false);
    expect(isSignupEnabled({ NEXT_PUBLIC_SIGNUPS_ENABLED: 'disabled' })).toBe(false);
  });

  it('falls back to ENABLE_SIGNUPS if NEXT_PUBLIC_SIGNUPS_ENABLED is omitted', () => {
    expect(isSignupEnabled({ ENABLE_SIGNUPS: 'false' })).toBe(false);
    expect(isSignupEnabled({ ENABLE_SIGNUPS: 'disabled' })).toBe(false);
    expect(isSignupEnabled({ ENABLE_SIGNUPS: 'true' })).toBe(true);
  });

  it('prefers NEXT_PUBLIC_SIGNUPS_ENABLED over ENABLE_SIGNUPS', () => {
    expect(
      isSignupEnabled({
        NEXT_PUBLIC_SIGNUPS_ENABLED: 'false',
        ENABLE_SIGNUPS: 'true',
      })
    ).toBe(false);
  });
});
