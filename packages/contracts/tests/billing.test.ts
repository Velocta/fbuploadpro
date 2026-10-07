import { describe, expect, it } from 'vitest';
import {
  TokenTransactionSchema,
  TokenTransactionTypeSchema,
} from '../src/domain/billing.js';

describe('Token Transaction Domain Schemas', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const txId = '880e8400-e29b-41d4-a716-446655440003';

  describe('TokenTransactionTypeSchema', () => {
    it('accepts valid transaction types', () => {
      expect(TokenTransactionTypeSchema.parse('credit')).toBe('credit');
      expect(TokenTransactionTypeSchema.parse('debit')).toBe('debit');
      expect(TokenTransactionTypeSchema.parse('refund')).toBe('refund');
      expect(TokenTransactionTypeSchema.parse('adjustment')).toBe('adjustment');
    });

    it('rejects unsupported transaction types', () => {
      expect(TokenTransactionTypeSchema.safeParse('charge').success).toBe(false);
      expect(TokenTransactionTypeSchema.safeParse('deposit').success).toBe(false);
    });
  });

  describe('TokenTransactionSchema', () => {
    const validTransaction = {
      id: txId,
      userId,
      amount: 100,
      transactionType: 'debit' as const,
      referenceId: 'ref_batch_992',
      description: 'Media publish charge',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    it('validates a complete token transaction entity', () => {
      const parsed = TokenTransactionSchema.parse(validTransaction);
      expect(parsed.id).toBe(txId);
      expect(parsed.userId).toBe(userId);
      expect(parsed.amount).toBe(100);
      expect(parsed.transactionType).toBe('debit');
    });

    it('allows null or omitted referenceId and description', () => {
      const minimalTx = {
        id: txId,
        userId,
        amount: 50,
        transactionType: 'credit' as const,
        createdAt: new Date().toISOString(),
      };
      const parsed = TokenTransactionSchema.parse(minimalTx);
      expect(parsed.amount).toBe(50);
      expect(parsed.referenceId).toBeUndefined();
    });

    it('strictly rejects zero and negative amounts', () => {
      expect(TokenTransactionSchema.safeParse({ ...validTransaction, amount: 0 }).success).toBe(false);
      expect(TokenTransactionSchema.safeParse({ ...validTransaction, amount: -10 }).success).toBe(false);
    });

    it('rejects floating point amounts', () => {
      expect(TokenTransactionSchema.safeParse({ ...validTransaction, amount: 12.5 }).success).toBe(false);
    });

    it('rejects invalid UUIDs', () => {
      expect(TokenTransactionSchema.safeParse({ ...validTransaction, userId: 'invalid' }).success).toBe(false);
    });
  });
});
