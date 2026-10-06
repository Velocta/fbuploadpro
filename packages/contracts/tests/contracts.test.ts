import { describe, it, expect } from 'vitest';
import {
  RESERVED_SUBDOMAINS, SubdomainSchema, AgencySchema, AgencyStatusSchema,
  UserRoleSchema, UserSchema, FacebookAccountSchema, FacebookAccountStatusSchema,
  FacebookPageSchema, FacebookPageStatusSchema, TokenBalanceSchema,
  TokenTransactionSchema, TokenTransactionTypeSchema, DomainError,
  DomainErrorCode, DOMAIN_ERROR_STATUS_MAP,
} from '../src/index.js';

const UUID1 = '11111111-1111-4111-8111-111111111111';
const UUID2 = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-01-01T00:00:00.000Z';

describe('Domain Contracts & Taxonomy', () => {
  it('validates subdomains and blocks invalid / reserved names', () => {
    expect(SubdomainSchema.parse('my-agency')).toBe('my-agency');
    ['a', '-bad', 'bad-', 'Bad'].forEach((s) => expect(() => SubdomainSchema.parse(s)).toThrow());
    RESERVED_SUBDOMAINS.forEach((r) => expect(() => SubdomainSchema.parse(r)).toThrow('Subdomain is reserved'));
  });

  it('validates agency and user with date coercion', () => {
    const agency = AgencySchema.parse({ id: UUID1, name: 'Agency', subdomain: 'agency', status: 'active', createdAt: NOW, updatedAt: NOW });
    expect(agency.createdAt).toBeInstanceOf(Date);
    expect(AgencyStatusSchema.parse('trial')).toBe('trial');

    const user = UserSchema.parse({ id: UUID2, agencyId: UUID1, email: 'u@test.com', role: 'agency_admin', status: 'active', createdAt: NOW, updatedAt: NOW });
    expect(user.role).toBe('agency_admin');
    expect(UserRoleSchema.parse('super_admin')).toBe('super_admin');
  });

  it('validates facebook account and page contracts', () => {
    const acc = FacebookAccountSchema.parse({ id: UUID1, agencyId: UUID1, fbUserId: '1', name: 'FB', status: 'active', tokenExpiresAt: null, createdAt: NOW, updatedAt: NOW });
    expect(acc.tokenExpiresAt).toBeNull();
    expect(FacebookAccountStatusSchema.parse('checkpoint')).toBe('checkpoint');

    const page = FacebookPageSchema.parse({ id: UUID2, agencyId: UUID1, facebookAccountId: UUID1, fbPageId: 'p1', name: 'P', status: 'active', createdAt: NOW, updatedAt: NOW });
    expect(page.followersCount).toBe(0);
    expect(FacebookPageStatusSchema.parse('fb_rate_limited')).toBe('fb_rate_limited');
    expect(() => FacebookPageSchema.parse({ ...page, followersCount: -1 })).toThrow();
  });

  it('enforces token balance and transaction invariants', () => {
    const bal = TokenBalanceSchema.parse({ id: UUID1, agencyId: UUID1, balance: 10, reserved: 0, updatedAt: NOW });
    expect(bal.balance).toBe(10);
    expect(() => TokenBalanceSchema.parse({ ...bal, balance: -1 })).toThrow();

    const txn = TokenTransactionSchema.parse({ id: UUID1, agencyId: UUID1, amount: 5, transactionType: 'debit', referenceId: null, description: 'fee', createdAt: NOW });
    expect(txn.amount).toBe(5);
    expect(TokenTransactionTypeSchema.parse('credit')).toBe('credit');
    expect(() => TokenTransactionSchema.parse({ ...txn, amount: 0 })).toThrow();
    expect(() => TokenTransactionSchema.parse({ ...txn, amount: -5 })).toThrow();
  });

  it('verifies domain error taxonomy and HTTP status mapping', () => {
    const err = new DomainError('VALIDATION_FAILED', 'Invalid input');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.httpStatus).toBe(400);
    expect(DOMAIN_ERROR_STATUS_MAP[DomainErrorCode.UNAUTHORIZED]).toBe(401);
    expect(DOMAIN_ERROR_STATUS_MAP[DomainErrorCode.FORBIDDEN]).toBe(403);
    expect(DOMAIN_ERROR_STATUS_MAP[DomainErrorCode.NOT_FOUND]).toBe(404);
    expect(DOMAIN_ERROR_STATUS_MAP[DomainErrorCode.CONFLICT_STATE]).toBe(409);
    expect(DOMAIN_ERROR_STATUS_MAP[DomainErrorCode.INSUFFICIENT_FUNDS]).toBe(402);
    expect(DOMAIN_ERROR_STATUS_MAP[DomainErrorCode.INTERNAL_ERROR]).toBe(500);
  });
});
