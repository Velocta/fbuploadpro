import { describe, it, expect } from 'vitest';
import { sanitizeAuthRedirectUrl } from '../../src/lib/auth-redirect';

describe('Open Redirect Defense - sanitizeAuthRedirectUrl (Spec 017 / AUTH-01)', () => {
  const subdomain = 'acmecorp';
  const rootDomain = 'localhost:3000';
  const defaultHome = 'http://acmecorp.localhost:3000/';

  it('allows safe relative paths starting with single forward slash', () => {
    expect(sanitizeAuthRedirectUrl('/media', subdomain, rootDomain)).toBe(
      'http://acmecorp.localhost:3000/media'
    );
    expect(sanitizeAuthRedirectUrl('/accounts', subdomain, rootDomain)).toBe(
      'http://acmecorp.localhost:3000/accounts'
    );
  });

  it('rejects protocol-relative URLs (//evil.com) and falls back to default home', () => {
    expect(sanitizeAuthRedirectUrl('//evil.com', subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('//attacker.com/subdomain', subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('/\\evil.com', subdomain, rootDomain)).toBe(defaultHome);
  });

  it('rejects external URLs attempting subdomain substring spoofing', () => {
    expect(sanitizeAuthRedirectUrl('https://evil.com/?acmecorp', subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('https://evil.com/acmecorp', subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('https://acmecorp.evil.com', subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('https://attacker.com#acmecorp', subdomain, rootDomain)).toBe(defaultHome);
  });

  it('rejects dangerous schemes such as javascript:, data:, and vbscript:', () => {
    expect(sanitizeAuthRedirectUrl('javascript:alert(1)', subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('data:text/html,<script>alert(1)</script>', subdomain, rootDomain)).toBe(defaultHome);
  });

  it('accepts exact fully-qualified URL matching the users specific tenant workspace', () => {
    const validFullUrl = 'http://acmecorp.localhost:3000/media?filter=ready';
    expect(sanitizeAuthRedirectUrl(validFullUrl, subdomain, rootDomain)).toBe(validFullUrl);
  });

  it('handles null, undefined, whitespace, or malformed inputs gracefully', () => {
    expect(sanitizeAuthRedirectUrl(null, subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl(undefined, subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('', subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('   ', subdomain, rootDomain)).toBe(defaultHome);
    expect(sanitizeAuthRedirectUrl('not-a-url', subdomain, rootDomain)).toBe(defaultHome);
  });
});
