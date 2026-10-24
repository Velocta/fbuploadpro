import { describe, it, expect } from 'vitest';
import { resolvePublishLimitWindow } from '@fbuploadpro/contracts';
import { formatLimitWindowLabel, getXLimitIndicator } from './x-limit-indicator';

describe('getXLimitIndicator (spec 132 §6 D5 — single source of truth)', () => {
  it('derives its numbers from the contracts limits config, never literals', () => {
    const config = resolvePublishLimitWindow('x', 'publishedPosts');
    expect(config).not.toBeNull();
    const indicator = getXLimitIndicator();
    expect(indicator).not.toBeNull();
    expect(indicator?.maxCount).toBe(config?.maxCount);
    expect(indicator?.windowSeconds).toBe(config?.windowSeconds);
    expect(indicator?.message).toContain(String(config?.maxCount));
    expect(indicator?.message).toContain(formatLimitWindowLabel(config?.windowSeconds ?? 0));
  });

  it('states the defer behaviour in plain language (caps defer, never fail)', () => {
    expect(getXLimitIndicator()?.message).toContain('never fail');
    expect(getXLimitIndicator()?.message).toContain("This account's limit on X is");
  });
});

describe('formatLimitWindowLabel', () => {
  it('renders minutes, hours and seconds plainly', () => {
    expect(formatLimitWindowLabel(900)).toBe('15 minutes');
    expect(formatLimitWindowLabel(60)).toBe('1 minute');
    expect(formatLimitWindowLabel(3600)).toBe('1 hour');
    expect(formatLimitWindowLabel(7200)).toBe('2 hours');
    expect(formatLimitWindowLabel(45)).toBe('45 seconds');
  });
});
