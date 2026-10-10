import { describe, expect, it } from 'vitest';
import {
  DiscoveredPageSchema,
  FacebookAccountSchema,
  FacebookAccountStatusSchema,
  FacebookAccountViewSchema,
  FacebookPageSchema,
  FacebookPageStatusSchema,
  FacebookPageViewSchema,
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
      expect(parsed.profilePictureUrl).toBeNull();
      expect(parsed.gender).toBeNull();
      expect(parsed.accountLink).toBeNull();
    });

    it('accepts profilePictureUrl, gender, and accountLink and defaults them to null when omitted', () => {
      const withMetadata = FacebookAccountSchema.parse({
        ...validAccount,
        profilePictureUrl: 'https://platform-lookaside.fbsbx.com/platform/profilepic/account.jpg',
        gender: 'female',
        accountLink: 'https://www.facebook.com/app_scoped_user_id/1092837465/',
      });
      expect(withMetadata.profilePictureUrl).toBe(
        'https://platform-lookaside.fbsbx.com/platform/profilepic/account.jpg'
      );
      expect(withMetadata.gender).toBe('female');
      expect(withMetadata.accountLink).toBe(
        'https://www.facebook.com/app_scoped_user_id/1092837465/'
      );

      const viewWithMetadata = FacebookAccountViewSchema.parse({
        id: accountId,
        fbAccountId: 'act_1092837465',
        displayName: 'Main Media Ops',
        profilePictureUrl: 'https://platform-lookaside.fbsbx.com/platform/profilepic/account.jpg',
        gender: 'female',
        accountLink: 'https://www.facebook.com/app_scoped_user_id/1092837465/',
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(viewWithMetadata.profilePictureUrl).toBe(
        'https://platform-lookaside.fbsbx.com/platform/profilepic/account.jpg'
      );
      expect(viewWithMetadata.gender).toBe('female');
      expect(viewWithMetadata.accountLink).toBe(
        'https://www.facebook.com/app_scoped_user_id/1092837465/'
      );
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
      expect(parsed.profilePictureUrl).toBeNull();
    });

    it('accepts profilePictureUrl on FacebookPageSchema, FacebookPageViewSchema, and DiscoveredPageSchema', () => {
      const picUrl = 'https://platform-lookaside.fbsbx.com/platform/profilepic/page.jpg';
      const parsedPage = FacebookPageSchema.parse({ ...validPage, profilePictureUrl: picUrl });
      expect(parsedPage.profilePictureUrl).toBe(picUrl);

      const parsedPageView = FacebookPageViewSchema.parse({
        id: pageId,
        facebookAccountId: accountId,
        fbPageId: 'page_987654321',
        pageName: 'Tech Deals Daily',
        profilePictureUrl: picUrl,
        status: 'active',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(parsedPageView.profilePictureUrl).toBe(picUrl);

      const parsedDiscovered = DiscoveredPageSchema.parse({
        fbPageId: 'page_987654321',
        pageName: 'Tech Deals Daily',
        profilePictureUrl: picUrl,
      });
      expect(parsedDiscovered.profilePictureUrl).toBe(picUrl);
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
