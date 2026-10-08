# Data Model Specification: 007-remove-token-system

## 1. Updated User Entity (`packages/contracts/src/domain/user.ts`)

```typescript
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(255),
  name: z.string().max(100).nullable().optional(),
  subdomain: SubdomainSchema,
  role: UserRoleSchema.default('user'),
  status: UserStatusSchema.default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
```

*(Removed `tokensBalance` field)*

---

## 2. Updated PostgreSQL DDL (`packages/database/migrations/0001_initial_schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100),
    subdomain VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'seller', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

*(Removed `tokens_balance BIGINT NOT NULL DEFAULT 0 CHECK (tokens_balance >= 0)`, and removed entire `token_transactions` table definition)*

---

## 3. Updated Publish Logs DDL (`packages/database/migrations/0004_publishing_engine.sql`)

```sql
CREATE TABLE IF NOT EXISTS publish_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    queue_item_id UUID NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
    fb_page_id VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('success', 'retry', 'failure')),
    attempt_number INT NOT NULL CHECK (attempt_number >= 1),
    fb_response_code INT,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

*(Removed `tokens_deducted INT NOT NULL DEFAULT 0 CHECK (tokens_deducted >= 0)`)*
