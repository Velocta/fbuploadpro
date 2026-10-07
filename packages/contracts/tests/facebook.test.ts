import { describe, expect, it } from 'vitest';
import {
  FacebookAccountSchema,
  FacebookAccountStatusSchema,
  FacebookPageSchema,
  FacebookPageStatusSchema,
} from '../src/domain/facebook.js';

describe('Facebook Account & Page Domain Schemas', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const accountId = '660e8400-e29b-41d4-a716-446655440001';
  const pageId = '770e8400-e29b-41d4-a716-446655440002';

  describe('FacebookAccountStatusSchema', () => {
    it('accepts valid statuses', () => {
      expect(FacebookAccountStatusSchema.parse('active')).toBe('active');
      expect(FacebookAccountStatusSchema.parse('disconnected')).toBe('disconnected');
      expect(FacebookAccountStatusSchema.parse('expired')).toBe('expired');
    });

    it('rejects invalid statuses', () => {
      expect(FacebookAccountStatusSchema.safeParse('pending').success).toBe(false);
      expect(FacebookAccountStatusSchema.safeParse('banned').success).toBe(false);
    });
  });

  describe('FacebookAccountSchema', () => {
    const validAccount = {
      id: accountId,
      userId,
      fbAccountId: 'act_1092837465',
      displayName: 'Main Media Ops',
      status: 'active' as const,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('validates a correct Facebook account entity', () => {
      const parsed = FacebookAccountSchema.parse(validAccount);
      expect(parsed.id).toBe(accountId);
      expect(parsed.userId).toBe(userId);
      expect(parsed.fbAccountId).toBe('act_1092837465');
      expect(parsed.status).toBe('active');
    });

    it('applies default status when omitted', () => {
      const { status: _, ...omittedStatus } = validAccount;
      const parsed = FacebookAccountSchema.parse(omittedStatus);
      expect(parsed.status).toBe('active');
    });

    it('rejects invalid UUIDs or empty account identifiers', () => {
      expect(FacebookAccountSchema.safeParse({ ...validAccount, id: 'not-uuid' }).success).toBe(false);
      expect(FacebookAccountSchema.safeParse({ ...validAccount, userId: 'not-uuid' }).success).toBe(false);
      expect(FacebookAccountSchema.safeParse({ ...validAccount, fbAccountId: '' }).success).toBe(false);
      expect(FacebookAccountSchema.safeParse({ ...validAccount, displayName: '' }).success).toBe(false);
    });
  });

  describe('FacebookPageStatusSchema', () => {
    it('accepts valid page statuses', () => {
      expect(FacebookPageStatusSchema.parse('active')).toBe('active');
      expect(FacebookPageStatusSchema.parse('fb_rate_limited')).toBe('fb_rate_limited');
      expect(FacebookPageStatusSchema.parse('invalid_token')).toBe('invalid_token');
      expect(FacebookPageStatusSchema.parse('disconnected')).toBe('disconnected');
    });

    it('rejects invalid statuses', () => {
      expect(FacebookPageStatusSchema.safeParse('active_live').success).toBe(false);
    });
  });

  describe('FacebookPageSchema', () => {
    const validPage = {
      id: pageId,
      userId,
      facebookAccountId: accountId,
      fbPageId: 'page_987654321',
      pageName: 'Tech Deals Daily',
      followersCount: 12500,
      status: 'active' as const,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('validates a correct Facebook page entity with composite identifiers', () => {
      const parsed = FacebookPageSchema.parse(validPage);
      expect(parsed.id).toBe(pageId);
      expect(parsed.userId).toBe(userId);
      expect(parsed.facebookAccountId).toBe(accountId);
      expect(parsed.followersCount).toBe(12500);
    });

    it('defaults followersCount to 0 and status to active', () => {
      const minimalPage = {
        id: pageId,
        userId,
        facebookAccountId: accountId,
        fbPageId: 'page_987654321',
        pageName: 'Tech Deals Daily',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const parsed = FacebookPageSchema.parse(minimalPage);
      expect(parsed.followersCount).toBe(0);
      expect(parsed.status).toBe('active');
    });

    it('rejects negative followersCount', () => {
      expect(FacebookPageSchema.safeParse({ ...validPage, followersCount: -1 }).success).toBe(false);
    });

    it('rejects invalid foreign key UUIDs or empty fields', () => {
      expect(FacebookPageSchema.safeParse({ ...validPage, facebookAccountId: 'bad-id' }).success).toBe(false);
      expect(FacebookPageSchema.safeParse({ ...validPage, pageName: '' }).success).toBe(false);
      expect(FacebookPageSchema.safeParse({ ...validPage, fbPageId: '' }).success).toBe(false);
    });
  });
});
