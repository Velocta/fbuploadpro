import { DomainError, DomainErrorCode, InsufficientFundsError } from '@fbuploadpro/contracts';

export interface EdgeTransport {
  fetch(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export interface EdgeDatabaseClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
  atomicDecrementTokens(userId: string, amount: number): Promise<number>;
}

export function createEdgeDatabaseClient(transport: EdgeTransport): EdgeDatabaseClient {
  return {
    async query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
      const rows = await transport.fetch(text, params);
      return rows as T[];
    },

    async queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
      const rows = await transport.fetch(text, params);
      return ((rows[0] as T) ?? null);
    },

    async atomicDecrementTokens(userId: string, amount: number): Promise<number> {
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new DomainError(
          DomainErrorCode.VALIDATION_FAILED,
          'Token decrement amount must be a positive integer'
        );
      }

      const sql = `
        UPDATE users
        SET tokens_balance = tokens_balance - $2, updated_at = now()
        WHERE id = $1 AND tokens_balance >= $2
        RETURNING tokens_balance;
      `;

      const rows = await transport.fetch(sql, [userId, amount]);
      if (rows.length === 0) {
        throw new InsufficientFundsError('User has insufficient token balance for this operation');
      }

      return Number((rows[0] as { tokens_balance: string | number }).tokens_balance);
    },
  };
}
