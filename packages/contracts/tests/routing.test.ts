import { describe, it, expect } from 'vitest';
import { extractSubdomain, getTenantRewriteUrl } from '../src/domain/routing';

describe('Tenant Subdomain Routing Contracts', () => {
  describe('extractSubdomain', () => {
    it.each([
      ['fbuploadpro.com', 'fbuploadpro.com', 'apex domain without subdomain'],
      ['www.fbuploadpro.com', 'fbuploadpro.com', 'www prefix as apex domain'],
      ['localhost:3000', 'localhost', 'localhost:3000 as apex domain'],
      ['127.0.0.1:3000', 'localhost', 'IP address as apex domain'],
    ])('correctly identifies %s as %s', (host, rootDomain) => {
      const result = extractSubdomain(host, rootDomain);
      expect(result.isApex).toBe(true);
      expect(result.subdomain).toBeNull();
      expect(result.isReserved).toBe(false);
    });

    it('extracts valid tenant subdomain on production domain', () => {
      const result = extractSubdomain('acme.fbuploadpro.com', 'fbuploadpro.com');
      expect(result.isApex).toBe(false);
      expect(result.subdomain).toBe('acme');
      expect(result.isReserved).toBe(false);
    });

    it('extracts valid tenant subdomain on localhost with port', () => {
      const result = extractSubdomain('client-a.localhost:3000', 'localhost');
      expect(result.isApex).toBe(false);
      expect(result.subdomain).toBe('client-a');
      expect(result.isReserved).toBe(false);
    });

    it('identifies reserved subdomains', () => {
      const adminResult = extractSubdomain('admin.fbuploadpro.com', 'fbuploadpro.com');
      expect(adminResult.isApex).toBe(false);
      expect(adminResult.subdomain).toBe('admin');
      expect(adminResult.isReserved).toBe(true);

      const apiResult = extractSubdomain('api.localhost:3000', 'localhost');
      expect(apiResult.isApex).toBe(false);
      expect(apiResult.subdomain).toBe('api');
      expect(apiResult.isReserved).toBe(true);
    });

    it('normalizes uppercase host headers to lowercase', () => {
      const result = extractSubdomain('ACME-CORP.localhost:3000', 'localhost');
      expect(result.subdomain).toBe('acme-corp');
    });

    it('handles empty or missing host header gracefully', () => {
      const result = extractSubdomain(null, 'fbuploadpro.com');
      expect(result.isApex).toBe(true);
      expect(result.subdomain).toBeNull();
    });
  });

  describe('getTenantRewriteUrl', () => {
    it('generates internal rewrite URL for root tenant path', () => {
      const rewrite = getTenantRewriteUrl('acme', '/', 'http://acme.localhost:3000');
      expect(rewrite.pathname).toBe('/tenant/acme');
    });

    it('generates internal rewrite URL preserving nested subpaths', () => {
      const rewrite = getTenantRewriteUrl('acme', '/dashboard/settings', 'http://acme.localhost:3000/dashboard/settings');
      expect(rewrite.pathname).toBe('/tenant/acme/dashboard/settings');
    });

    it('preserves query search parameters during rewrite', () => {
      const rewrite = getTenantRewriteUrl('acme', '/dashboard', 'http://acme.localhost:3000/dashboard?tab=analytics');
      expect(rewrite.pathname).toBe('/tenant/acme/dashboard');
      expect(rewrite.searchParams.get('tab')).toBe('analytics');
    });
  });
});
