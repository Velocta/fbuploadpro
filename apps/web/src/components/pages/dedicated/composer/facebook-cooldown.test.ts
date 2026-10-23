import { describe, it, expect } from 'vitest';
import { PLATFORM_PUBLISH_LIMITS, resolvePublishLimit } from '@fbuploadpro/contracts';
import {
  getFacebookCooldownState,
  FACEBOOK_COOLDOWN_MESSAGE,
} from './facebook-cooldown';

describe('getFacebookCooldownState — D5 Facebook indicator (spec 132 §6)', () => {
  it('derives from the contracts config: Facebook has no centred window', () => {
    // Single-source proof: the numbers live only in contracts; Facebook's
    // entry is null, so the composer must never draw a usage window.
    expect(PLATFORM_PUBLISH_LIMITS.facebook).toBeNull();
    expect(resolvePublishLimit('facebook')).toBeNull();
  });

  it('shows the cooldown state when the Page status is fb_rate_limited', () => {
    const state = getFacebookCooldownState({ status: 'fb_rate_limited' });
    expect(state.inCooldown).toBe(true);
    expect(state.message).toBe(FACEBOOK_COOLDOWN_MESSAGE);
    // No invented time or numbers (OD132-3): the existing page endpoint
    // returns no cooldown end time, so the copy carries none.
    expect(state.message).not.toMatch(/\d/);
  });

  it('shows nothing for an active Page', () => {
    expect(getFacebookCooldownState({ status: 'active' })).toEqual({
      inCooldown: false,
      message: null,
    });
  });

  it('shows nothing when the page has not loaded yet', () => {
    expect(getFacebookCooldownState(null)).toEqual({ inCooldown: false, message: null });
    expect(getFacebookCooldownState(undefined)).toEqual({
      inCooldown: false,
      message: null,
    });
    expect(getFacebookCooldownState({})).toEqual({ inCooldown: false, message: null });
  });

  it('does not treat other paused states as a cooldown', () => {
    expect(getFacebookCooldownState({ status: 'paused' }).inCooldown).toBe(false);
    expect(getFacebookCooldownState({ status: 'disconnected' }).inCooldown).toBe(false);
  });
});
