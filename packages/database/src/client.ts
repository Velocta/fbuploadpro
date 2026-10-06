import { Pool, type PoolClient, type PoolConfig } from 'pg';

export class InsufficientFundsError extends Error {
  readonly code = 'INSUFFICIENT_FUNDS';
  readonly status = 402;

  constructor(message = 'Insufficient token balance to perform this operation.') {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

export interface Queryable {
  query<R = unknown>(queryText: string, values?: unknown[]): Promise<{ rows: R[]; rowCount?: number | null }>;
}

export function createPool(config?: PoolConfig): Pool {
  return new Pool(config);
}

export async function query<T>(queryable: Queryable, text: string, params: unknown[] = []): Promise<T[]> {
  const result = await queryable.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T>(queryable: Queryable, text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(queryable, text, params);
  return rows[0] ?? null;
}

export async function atomicDecrementTokens(
  queryable: Queryable,
  agencyId: string,
  amount: number
): Promise<{ balance: number }> {
  const sql = `
UPDATE token_balances
SET balance = balance - $1, updated_at = now()
WHERE agency_id = $2 AND balance >= $1
RETURNING balance;
  `.trim();

  const result = await queryable.query<{ balance: number }>(sql, [amount, agencyId]);
  if (!result.rows || result.rows.length === 0) {
    throw new InsufficientFundsError();
  }

  const row = result.rows[0];
  if (!row) {
    throw new InsufficientFundsError();
  }
  return { balance: row.balance };
}

export async function withTransaction<T>(
  pool: { connect: () => Promise<PoolClient> },
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
