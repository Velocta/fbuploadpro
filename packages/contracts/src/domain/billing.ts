import { z } from 'zod';

export const TokenTransactionTypeSchema = z.enum(['credit', 'debit', 'refund', 'adjustment']);
export type TokenTransactionType = z.infer<typeof TokenTransactionTypeSchema>;

export const TokenBalanceSchema = z.object({
  id: z.string().uuid(),
  agencyId: z.string().uuid(),
  balance: z.number().int().nonnegative().default(0),
  reserved: z.number().int().nonnegative().default(0),
  updatedAt: z.coerce.date(),
});
export type TokenBalance = z.infer<typeof TokenBalanceSchema>;

export const TokenTransactionSchema = z.object({
  id: z.string().uuid(),
  agencyId: z.string().uuid(),
  amount: z.number().int().positive(),
  transactionType: TokenTransactionTypeSchema,
  referenceId: z.string().nullable(),
  description: z.string().min(1).max(255),
  createdAt: z.coerce.date(),
});
export type TokenTransaction = z.infer<typeof TokenTransactionSchema>;
