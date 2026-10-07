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
});
