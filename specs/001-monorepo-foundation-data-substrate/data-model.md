# Data Model: Core Monorepo Foundation & Data Substrate

This document defines the schema, invariants, validation rules, and relational relationships for the PostgreSQL data substrate.

---

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    AGENCIES ||--o{ USERS : "has members"
    AGENCIES ||--o{ FACEBOOK_ACCOUNTS : "owns"
    AGENCIES ||--o{ FACEBOOK_PAGES : "manages"
    AGENCIES ||--|| TOKEN_BALANCES : "maintains balance"
    AGENCIES ||--o{ TOKEN_TRANSACTIONS : "logs transactions"
    USERS ||--o{ FACEBOOK_ACCOUNTS : "links"
    FACEBOOK_ACCOUNTS ||--o{ FACEBOOK_PAGES : "composite parent (agency_id, account_id)"

    AGENCIES {
        uuid id PK
        varchar name
        varchar subdomain UK
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    USERS {
        uuid id PK
        uuid agency_id FK
        varchar email UK
        varchar role
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    FACEBOOK_ACCOUNTS {
        uuid id PK
        uuid agency_id FK
        uuid user_id FK
        varchar fb_account_id
        varchar display_name
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    FACEBOOK_PAGES {
        uuid id PK
        uuid agency_id FK
        uuid facebook_account_id FK
        varchar fb_page_id
        varchar page_name
        int followers_count
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    TOKEN_BALANCES {
        uuid id PK
        uuid agency_id FK, UK
        int balance
        int reserved
        timestamptz updated_at
    }

    TOKEN_TRANSACTIONS {
        uuid id PK
        uuid agency_id FK
        int amount
        varchar transaction_type
        varchar reference_id
        varchar description
        timestamptz created_at
    }
```

---

## 2. Table Specifications & Invariants

### 2.1 `agencies`
Represents an isolated multi-tenant organization.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique tenant identifier |
| `name` | `VARCHAR(100)` | `NOT NULL` | Human-readable agency name |
| `subdomain` | `VARCHAR(50)` | `NOT NULL UNIQUE` | Normalized tenant subdomain slug |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'))` | Tenant state |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Last update timestamp |

**Invariants & Validation**:
- Subdomain must match regex: `/^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/`
- Reserved subdomains are rejected: `admin`, `api`, `app`, `auth`, `billing`, `dashboard`, `internal`, `mail`, `status`, `system`, `test`, `webhook`, `www`.

---

### 2.2 `users`
Represents authenticated team members within an agency.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique user identifier |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id) ON DELETE CASCADE` | Owning tenant |
| `email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | User email address |
| `role` | `VARCHAR(20)` | `NOT NULL DEFAULT 'member' CHECK (role IN ('agency_admin', 'member'))` | Access permission tier |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'deactivated'))` | User lifecycle state |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Last update timestamp |

---

### 2.3 `facebook_accounts`
Represents connected Facebook OAuth user identities.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique account record ID |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id) ON DELETE CASCADE` | Owning tenant |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | User who connected account |
| `fb_account_id`| `VARCHAR(100)` | `NOT NULL` | Facebook Graph user ID |
| `display_name` | `VARCHAR(255)` | `NOT NULL` | Social account name |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired'))` | Connection state |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Last update timestamp |

**Multi-Tenant Composite Keys**:
- `CONSTRAINT uq_fb_accounts_agency_user UNIQUE (agency_id, user_id)`
- `CONSTRAINT uq_fb_accounts_agency_id UNIQUE (agency_id, id)` — Target for composite foreign key from `facebook_pages`.

---

### 2.4 `facebook_pages`
Represents managed Facebook publishing destinations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique page record ID |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id) ON DELETE CASCADE` | Owning tenant |
| `facebook_account_id` | `UUID` | `NOT NULL` | Owning Facebook account ID |
| `fb_page_id` | `VARCHAR(100)` | `NOT NULL` | Facebook Graph Page ID |
| `page_name` | `VARCHAR(255)` | `NOT NULL` | Facebook Page display title |
| `followers_count` | `INT` | `NOT NULL DEFAULT 0 CHECK (followers_count >= 0)` | Page audience metric |
| `status` | `VARCHAR(30)` | `NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fb_rate_limited', 'invalid_token', 'disconnected'))` | Publishing readiness |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Last update timestamp |

**Defense-in-Depth Relational Keys**:
- `CONSTRAINT fk_fb_pages_agency_account FOREIGN KEY (agency_id, facebook_account_id) REFERENCES facebook_accounts(agency_id, id) ON DELETE CASCADE`
- `CONSTRAINT uq_fb_pages_agency_page UNIQUE (agency_id, fb_page_id)`

---

### 2.5 `token_balances`
Represents the prepaid balance ledger for each tenant.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique record identifier |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id) ON DELETE CASCADE UNIQUE` | Owning tenant |
| `balance` | `INT` | `NOT NULL DEFAULT 0 CHECK (balance >= 0)` | Available operational tokens |
| `reserved` | `INT` | `NOT NULL DEFAULT 0 CHECK (reserved >= 0)` | Reserved pending tokens |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Last balance change |

**Invariants**:
- `balance` and `reserved` can never drop below 0.
- Decrements must use atomic SQL expressions (`WHERE balance >= :amount`).

---

### 2.6 `token_transactions`
Immutable financial audit trail of all token credits and debits.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique transaction ID |
| `agency_id` | `UUID` | `NOT NULL REFERENCES agencies(id) ON DELETE CASCADE` | Owning tenant |
| `amount` | `INT` | `NOT NULL CHECK (amount > 0)` | Transaction magnitude |
| `transaction_type` | `VARCHAR(20)` | `NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'adjustment'))` | Transaction category |
| `reference_id` | `VARCHAR(100)` | `NULL` | External job or invoice ID |
| `description` | `VARCHAR(255)` | `NOT NULL` | Audit explanation |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Timestamp of transaction |

---

## 3. State Transition Life Cycles

### 3.1 Agency Status
- `active` ➔ `suspended` (e.g., non-payment or administrative lock)
- `suspended` ➔ `active` (re-activation)

### 3.2 Facebook Page Status
- `active` ➔ `fb_rate_limited` (Graph API rate limit exceeded; pause publishing)
- `active` ➔ `invalid_token` (user changed password or token revoked)
- `active` ➔ `disconnected` (user manually removed page)
- `fb_rate_limited` ➔ `active` (cool-off timer elapsed)
- `invalid_token` ➔ `active` (re-authenticated via OAuth)
