import { z } from 'zod';

export const TokenTransactionTypeSchema = z.enum(['credit', 'debit', 'refund', 'adjustment']);
export type TokenTransactionType = z.infer<typeof TokenTransactionTypeSchema>;

export const TokenTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().int().positive('Token transaction amount must be greater than zero'),
  transactionType: TokenTransactionTypeSchema,
  referenceId: z.string().max(100).nullable().optional(),
  description: z.string().max(255).nullable().optional(),
  createdAt: z.coerce.date(),
});

export type TokenTransaction = z.infer<typeof TokenTransactionSchema>;
