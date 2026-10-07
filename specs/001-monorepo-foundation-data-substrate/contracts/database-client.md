# Contract: Database Clients & Atomic Operations

This document specifies the dual client interfaces exposed by `@fbuploadpro/database`.

---

## 1. Node.js Database Client (`@fbuploadpro/database`)

### Core Interface
```typescript
export interface DatabaseClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
  withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
  atomicDecrementTokens(userId: string, amount: number): Promise<number>;
  close(): Promise<void>;
}
```

### Atomic Token Decrement Contract
- **Inputs**:
  - `userId`: Valid UUID string
  - `amount`: Strictly positive integer (`amount > 0`)
- **SQL Execution**:
  ```sql
  UPDATE users
  SET tokens_balance = tokens_balance - $2, updated_at = now()
  WHERE id = $1 AND tokens_balance >= $2
  RETURNING tokens_balance;
  ```
- **Outcomes**:
  - If updated: returns `number` (new updated `tokens_balance`).
  - If 0 rows updated (insufficient balance or user missing): throws `InsufficientFundsError` (`DomainErrorCode = 'INSUFFICIENT_FUNDS'`, HTTP 402).

---

## 2. Edge Isolate Database Client (`@fbuploadpro/database/edge`)

### Core Interface
```typescript
export interface EdgeTransport {
  fetch(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export interface EdgeDatabaseClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
  atomicDecrementTokens(userId: string, amount: number): Promise<number>;
}
```

### Invariants
- Zero Node.js TCP socket dependencies (`net`, `tls`, `dns`).
- Bundle-safe for Cloudflare Workers standard V8 isolate execution.
