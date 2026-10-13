import { describe, expect, it } from 'vitest';
import {
  WorkspaceItemSchema,
  CreateWorkspaceRequestSchema,
  SwitchWorkspaceRequestSchema,
  BYOCCredentialsViewSchema,
  SaveBYOCCredentialsRequestSchema,
  TestBYOCResponseSchema,
} from '../src/domain/workspace.js';

describe('Workspace Domain Contracts', () => {
  describe('WorkspaceItemSchema', () => {
    it('validates a valid workspace item', () => {
      const valid = {
        id: '11111111-1111-4111-a111-111111111111',
        ownerId: '22222222-2222-4222-a222-222222222222',
        name: 'Growth Agency',
        subdomain: 'growth-agency',
      };
      const parsed = WorkspaceItemSchema.parse(valid);
      expect(parsed.name).toBe('Growth Agency');
      expect(parsed.subdomain).toBe('growth-agency');
    });

    it('rejects invalid UUIDs or empty names', () => {
      expect(
        WorkspaceItemSchema.safeParse({
          id: 'invalid-uuid',
          ownerId: '22222222-2222-4222-a222-222222222222',
          name: '',
          subdomain: 'growth-agency',
        }).success
      ).toBe(false);
    });
  });

  describe('CreateWorkspaceRequestSchema', () => {
    it('validates valid workspace creation requests', () => {
      const valid = {
        name: 'Velocta Media',
        subdomain: 'velocta-media',
      };
      const parsed = CreateWorkspaceRequestSchema.parse(valid);
      expect(parsed.name).toBe('Velocta Media');
      expect(parsed.subdomain).toBe('velocta-media');
    });

    it('rejects reserved subdomains', () => {
      const result = CreateWorkspaceRequestSchema.safeParse({
        name: 'Admin Workspace',
        subdomain: 'admin',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short workspace names', () => {
      const result = CreateWorkspaceRequestSchema.safeParse({
        name: 'A',
        subdomain: 'valid-slug',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SwitchWorkspaceRequestSchema', () => {
    it('validates valid subdomain targets', () => {
      const parsed = SwitchWorkspaceRequestSchema.parse({
        subdomain: 'alpha-team',
      });
      expect(parsed.subdomain).toBe('alpha-team');
    });
  });

  describe('BYOCCredentialsViewSchema & SaveBYOCCredentialsRequestSchema', () => {
    it('validates sanitized BYOC view without leaking secret', () => {
      const view = {
        workspaceId: '11111111-1111-4111-a111-111111111111',
        subdomain: 'alpha-team',
        fbAppId: '123456789012345',
        hasSecret: true,
        status: 'valid' as const,
        lastTestedAt: '2026-10-13T10:00:00.000Z',
      };
      const parsed = BYOCCredentialsViewSchema.parse(view);
      expect(parsed.hasSecret).toBe(true);
      expect(parsed.fbAppId).toBe('123456789012345');
      expect(parsed.status).toBe('valid');
    });

    it('validates save BYOC request with numeric App ID and secret', () => {
      const req = {
        fbAppId: '987654321098765',
        fbAppSecret: 'abcdef0123456789abcdef0123456789',
        webhookVerifyToken: 'my-custom-verify-token-123',
      };
      const parsed = SaveBYOCCredentialsRequestSchema.parse(req);
      expect(parsed.fbAppId).toBe('987654321098765');
      expect(parsed.fbAppSecret).toBe('abcdef0123456789abcdef0123456789');
    });

    it('rejects non-numeric App ID', () => {
      const result = SaveBYOCCredentialsRequestSchema.safeParse({
        fbAppId: 'app-id-with-letters',
        fbAppSecret: 'validsecret123',
      });
      expect(result.success).toBe(false);
    });

    it('validates test BYOC diagnostic response schema', () => {
      const testRes = {
        success: true,
        status: 'valid' as const,
        message: 'Successfully verified Facebook App connection',
        testedAt: new Date().toISOString(),
        appName: 'FBUploadPro Production App',
      };
      const parsed = TestBYOCResponseSchema.parse(testRes);
      expect(parsed.success).toBe(true);
      expect(parsed.status).toBe('valid');
    });
  });
});
