export interface EdgeTransport {
  fetch(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export interface EdgeDatabaseClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
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
  };
}
