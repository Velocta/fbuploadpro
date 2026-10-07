import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Database Migrations Substrate', () => {
  it('0001_initial_schema.sql contains users table with constraints and indexes', () => {
    const migrationPath = path.resolve(__dirname, '../migrations/0001_initial_schema.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);

    const ddl = fs.readFileSync(migrationPath, 'utf8');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(ddl).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
    expect(ddl).toContain('email VARCHAR(255) NOT NULL UNIQUE');
    expect(ddl).toContain('subdomain VARCHAR(50) NOT NULL UNIQUE');
    expect(ddl).toContain("role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'seller', 'admin'))");
    expect(ddl).toContain('tokens_balance BIGINT NOT NULL DEFAULT 0 CHECK (tokens_balance >= 0)');
    expect(ddl).toContain("status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'))");
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_users_subdomain ON users(subdomain)');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  });

  it('0001_initial_schema.sql contains facebook_accounts and facebook_pages with composite constraints', () => {
    const migrationPath = path.resolve(__dirname, '../migrations/0001_initial_schema.sql');
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS facebook_accounts');
    expect(ddl).toContain('CONSTRAINT uq_fb_accounts_user_account UNIQUE (user_id, fb_account_id)');
    expect(ddl).toContain('CONSTRAINT uq_fb_accounts_user_id UNIQUE (user_id, id)');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS facebook_pages');
    expect(ddl).toContain('CONSTRAINT fk_fb_pages_user_account FOREIGN KEY (user_id, facebook_account_id)');
    expect(ddl).toContain('REFERENCES facebook_accounts(user_id, id) ON DELETE CASCADE');
    expect(ddl).toContain('CONSTRAINT uq_fb_pages_user_page UNIQUE (user_id, fb_page_id)');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_fb_accounts_user_id ON facebook_accounts(user_id)');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_fb_pages_user_id ON facebook_pages(user_id)');
  });

  it('0001_initial_schema.sql contains token_transactions table with constraints and indexes', () => {
    const migrationPath = path.resolve(__dirname, '../migrations/0001_initial_schema.sql');
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS token_transactions');
    expect(ddl).toContain('user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(ddl).toContain('amount BIGINT NOT NULL CHECK (amount > 0)');
    expect(ddl).toContain("transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'adjustment'))");
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id)');
  });
});
