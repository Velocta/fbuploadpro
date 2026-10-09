import { describe, it, expect } from 'vitest';
import { sanitizeAuthRedirectUrl } from '../../src/lib/auth-redirect';

describe('Open Redirect Defense - sanitizeAuthRedirectUrl (Spec 017 / AUTH-01)', () => {
  const subdomain = 'acmecorp';
  const rootDomain = 'localhost:3000';
  const defaultDashboard = 'http://acmecorp.localhost:3000/dashboard';

  it('allows safe relative paths starting with single forward slash', () => {
    expect(sanitizeAuthRedirectUrl('/media', subdomain, rootDomain)).toBe(
      'http://acmecorp.localhost:3000/media'
    );
    expect(sanitizeAuthRedirectUrl('/dashboard/reels', subdomain, rootDomain)).toBe(
      'http://acmecorp.localhost:3000/dashboard/reels'
    );
  });

  it('rejects protocol-relative URLs (//evil.com) and falls back to default dashboard', () => {
    expect(sanitizeAuthRedirectUrl('//evil.com', subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('//attacker.com/subdomain', subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('/\\evil.com', subdomain, rootDomain)).toBe(defaultDashboard);
  });

  it('rejects external URLs attempting subdomain substring spoofing', () => {
    expect(sanitizeAuthRedirectUrl('https://evil.com/?acmecorp', subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('https://evil.com/acmecorp', subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('https://acmecorp.evil.com', subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('https://attacker.com#acmecorp', subdomain, rootDomain)).toBe(defaultDashboard);
  });

  it('rejects dangerous schemes such as javascript:, data:, and vbscript:', () => {
    expect(sanitizeAuthRedirectUrl('javascript:alert(1)', subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('data:text/html,<script>alert(1)</script>', subdomain, rootDomain)).toBe(defaultDashboard);
  });

  it('accepts exact fully-qualified URL matching the users specific tenant workspace', () => {
    const validFullUrl = 'http://acmecorp.localhost:3000/media?filter=ready';
    expect(sanitizeAuthRedirectUrl(validFullUrl, subdomain, rootDomain)).toBe(validFullUrl);
  });

  it('handles null, undefined, whitespace, or malformed inputs gracefully', () => {
    expect(sanitizeAuthRedirectUrl(null, subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl(undefined, subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('', subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('   ', subdomain, rootDomain)).toBe(defaultDashboard);
    expect(sanitizeAuthRedirectUrl('not-a-url', subdomain, rootDomain)).toBe(defaultDashboard);
  });
});
