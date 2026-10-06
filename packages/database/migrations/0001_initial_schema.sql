-- 1. Agencies
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  subdomain VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_agencies_status CHECK (status IN ('active', 'suspended', 'trial'))
);

-- 2. Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'agency_member',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_role CHECK (role IN ('super_admin', 'agency_admin', 'agency_member')),
  CONSTRAINT chk_users_status CHECK (status IN ('active', 'invited', 'deactivated'))
);
CREATE INDEX idx_users_agency ON users(agency_id);

-- 3. Facebook Accounts
CREATE TABLE facebook_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  fb_user_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fb_accounts_status CHECK (status IN ('active', 'invalid_token', 'checkpoint', 'disconnected')),
  CONSTRAINT uq_fb_accounts_agency_user UNIQUE (agency_id, fb_user_id),
  CONSTRAINT uq_fb_accounts_agency_id UNIQUE (agency_id, id)
);
CREATE INDEX idx_fb_accounts_agency ON facebook_accounts(agency_id);

-- 4. Facebook Pages (Composite Foreign Key enforces strict tenant isolation)
CREATE TABLE facebook_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  facebook_account_id UUID NOT NULL,
  fb_page_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  followers_count INT NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fb_pages_status CHECK (status IN ('active', 'fb_rate_limited', 'invalid_token', 'disconnected')),
  CONSTRAINT fk_fb_pages_agency_account FOREIGN KEY (agency_id, facebook_account_id)
    REFERENCES facebook_accounts(agency_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_fb_pages_agency_page UNIQUE (agency_id, fb_page_id)
);
CREATE INDEX idx_fb_pages_agency ON facebook_pages(agency_id);
CREATE INDEX idx_fb_pages_account ON facebook_pages(facebook_account_id);

-- 5. Token Balances (Non-negative balance invariant)
CREATE TABLE token_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_token_balances_agency UNIQUE (agency_id)
);

-- 6. Token Transactions (Positive magnitude, direction determined by type)
CREATE TABLE token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  amount INT NOT NULL CHECK (amount > 0),
  transaction_type VARCHAR(20) NOT NULL,
  reference_id VARCHAR(100),
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_token_txn_type CHECK (transaction_type IN ('credit', 'debit', 'refund', 'adjustment'))
);
CREATE INDEX idx_token_txns_agency ON token_transactions(agency_id);
