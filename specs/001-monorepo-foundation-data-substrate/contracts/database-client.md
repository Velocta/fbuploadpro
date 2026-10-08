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
  close(): Promise<void>;
}
```

### [RETIRED] Atomic Token Decrement Contract
> [!NOTE]
> The per-action token decrement helper and operational balance tracking have been retired and deleted as the platform adopted a direct workspace subscription model without token metering.

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
}
```

### Invariants
- Zero Node.js TCP socket dependencies (`net`, `tls`, `dns`).
- Bundle-safe for Cloudflare Workers standard V8 isolate execution.
