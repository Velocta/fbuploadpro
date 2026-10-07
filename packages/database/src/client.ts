import pg from 'pg';
import type { Pool, PoolClient, PoolConfig } from 'pg';
import { DomainError, DomainErrorCode, InsufficientFundsError } from '@fbuploadpro/contracts';

const { Pool: PgPool } = pg;

export interface DatabaseClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
  withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
  atomicDecrementTokens(userId: string, amount: number): Promise<number>;
  close(): Promise<void>;
}

export function createDatabaseClient(poolOrConfig?: Pool | PoolConfig): DatabaseClient {
  const pool = (poolOrConfig && (typeof (poolOrConfig as Pool).query === 'function' || typeof (poolOrConfig as Pool).connect === 'function'))
    ? (poolOrConfig as Pool)
    : new PgPool(poolOrConfig as PoolConfig);

  return {
    async query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await pool.query(text, params);
      return result.rows as T[];
    },

    async queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
      const result = await pool.query(text, params);
      return (result.rows[0] as T) ?? null;
    },

    async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const res = await callback(client);
        await client.query('COMMIT');
        return res;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
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

      const result = await pool.query(sql, [userId, amount]);
      if (result.rowCount === 0 || result.rows.length === 0) {
        throw new InsufficientFundsError('User has insufficient token balance for this operation');
      }

      return Number((result.rows[0] as { tokens_balance: string | number }).tokens_balance);
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
