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
  atomicDecrementTokens(agencyId: string, amount: number): Promise<number>;
  close(): Promise<void>;
}
```

### Atomic Token Decrement Contract
- **Inputs**:
  - `agencyId`: Valid UUID string
  - `amount`: Strictly positive integer (`amount > 0`)
- **SQL Execution**:
  ```sql
  UPDATE token_balances
  SET balance = balance - $2, updated_at = now()
  WHERE agency_id = $1 AND balance >= $2
  RETURNING balance;
  ```
- **Outcomes**:
  - If updated: returns `number` (new updated balance).
  - If 0 rows updated (insufficient balance or missing record): throws `InsufficientFundsError` (`DomainErrorCode = 'INSUFFICIENT_FUNDS'`, HTTP 402).

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
  atomicDecrementTokens(agencyId: string, amount: number): Promise<number>;
}
```

### Invariants
- Zero Node.js TCP socket dependencies (`net`, `tls`, `dns`).
- Bundle-safe for Cloudflare Workers standard V8 isolate execution.
