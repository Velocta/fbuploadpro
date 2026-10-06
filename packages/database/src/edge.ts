import { InsufficientFundsError } from './client.js';

export interface EdgeDatabaseConfig {
  readonly connectionString?: string;
  readonly hyperdriveBinding?: {
    readonly connectionString: string;
  };
  readonly fetchHandler?: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

export interface EdgeDatabaseClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  atomicDecrementTokens(agencyId: string, amount: number): Promise<{ balance: number }>;
}

class EdgeDatabaseClientImpl implements EdgeDatabaseClient {
  private readonly config: EdgeDatabaseConfig;

  constructor(config: EdgeDatabaseConfig) {
    this.config = config;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    if (this.config.fetchHandler) {
      const res = await this.config.fetchHandler(sql, params);
      return { rows: (res.rows ?? []) as T[] };
    }
    return { rows: [] };
  }

  async atomicDecrementTokens(agencyId: string, amount: number): Promise<{ balance: number }> {
    const sql = `
UPDATE token_balances
SET balance = balance - $1, updated_at = now()
WHERE agency_id = $2 AND balance >= $1
RETURNING balance;
    `.trim();

    const result = await this.query<{ balance: number }>(sql, [amount, agencyId]);
    const firstRow = result.rows[0];
    if (!firstRow) {
      throw new InsufficientFundsError();
    }
    return { balance: firstRow.balance };
  }
}

export function createEdgeClient(config: EdgeDatabaseConfig): EdgeDatabaseClient {
  return new EdgeDatabaseClientImpl(config);
}
