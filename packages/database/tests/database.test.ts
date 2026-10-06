import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';
import {
  query,
  queryOne,
  atomicDecrementTokens,
  withTransaction,
  InsufficientFundsError,
  type Queryable
} from '../src/client.js';
import { createEdgeClient } from '../src/edge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('PostgreSQL Schema v1 DDL Invariants', () => {
  const migrationPath = resolve(__dirname, '../migrations/0001_initial_schema.sql');

  it('migration file exists and contains valid DDL for all core tables', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf-8');

    expect(sql).toContain('CREATE TABLE agencies');
    expect(sql).toContain('CREATE TABLE users');
    expect(sql).toContain('CREATE TABLE facebook_accounts');
    expect(sql).toContain('CREATE TABLE facebook_pages');
    expect(sql).toContain('CREATE TABLE token_balances');
    expect(sql).toContain('CREATE TABLE token_transactions');
  });

  it('enforces composite foreign key for multi-tenant isolation', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain('CONSTRAINT fk_fb_pages_agency_account FOREIGN KEY (agency_id, facebook_account_id)');
    expect(sql).toContain('REFERENCES facebook_accounts(agency_id, id) ON DELETE CASCADE');
  });

  it('enforces compound unique constraints on agency social entities', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain('CONSTRAINT uq_fb_accounts_agency_user UNIQUE (agency_id, fb_user_id)');
    expect(sql).toContain('CONSTRAINT uq_fb_pages_agency_page UNIQUE (agency_id, fb_page_id)');
    expect(sql).toContain('CONSTRAINT uq_token_balances_agency UNIQUE (agency_id)');
  });

  it('enforces non-negative balance and reserved check constraints', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain('balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0)');
    expect(sql).toContain('reserved INT NOT NULL DEFAULT 0 CHECK (reserved >= 0)');
    expect(sql).toContain('amount INT NOT NULL CHECK (amount > 0)');
  });

  it('contains zero legacy tables or references', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).not.toContain('posting_jobs_v2');
    expect(sql).not.toContain('reels_v1');
  });
});

describe('Node.js Database Client & Helpers', () => {
  it('executes parameterized query and returns typed rows', async () => {
    const mockQueryable: Queryable = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'agency-1', name: 'Acme Corp' }],
        rowCount: 1,
      }),
    };

    const rows = await query<{ id: string; name: string }>(
      mockQueryable,
      'SELECT id, name FROM agencies WHERE id = $1',
      ['agency-1']
    );

    expect(rows).toEqual([{ id: 'agency-1', name: 'Acme Corp' }]);
    expect(mockQueryable.query).toHaveBeenCalledWith(
      'SELECT id, name FROM agencies WHERE id = $1',
      ['agency-1']
    );
  });

  it('queryOne returns first row or null if empty', async () => {
    const mockQueryable: Queryable = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };

    const row = await queryOne(mockQueryable, 'SELECT id FROM agencies WHERE id = $1', ['missing']);
    expect(row).toBeNull();
  });

  it('atomicDecrementTokens successfully decrements balance when funds are sufficient', async () => {
    const mockQueryable: Queryable = {
      query: vi.fn().mockResolvedValue({
        rows: [{ balance: 3 }],
        rowCount: 1,
      }),
    };

    const result = await atomicDecrementTokens(mockQueryable, 'agency-123', 2);
    expect(result).toEqual({ balance: 3 });
    expect(mockQueryable.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE token_balances'),
      [2, 'agency-123']
    );
  });

  it('atomicDecrementTokens throws InsufficientFundsError when balance < amount', async () => {
    const mockQueryable: Queryable = {
      query: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      }),
    };

    await expect(atomicDecrementTokens(mockQueryable, 'agency-123', 10)).rejects.toThrow(
      InsufficientFundsError
    );
    await expect(atomicDecrementTokens(mockQueryable, 'agency-123', 10)).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      status: 402,
    });
  });

  it('withTransaction executes transaction workflow with commit and release', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    const res = await withTransaction(mockPool, async (client) => {
      await client.query('INSERT INTO agencies (name) VALUES ($1)', ['Test']);
      return 'ok';
    });

    expect(res).toBe('ok');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('withTransaction rolls back and releases client on error', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    await expect(
      withTransaction(mockPool, async () => {
        throw new Error('db failure');
      })
    ).rejects.toThrow('db failure');

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

describe('Edge Database Client', () => {
  it('creates edge client and executes query via transport', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      rows: [{ id: 'page-1', name: 'My Page' }],
    });

    const edgeClient = createEdgeClient({ fetchHandler: mockFetch });
    const result = await edgeClient.query('SELECT id, name FROM facebook_pages WHERE id = $1', ['page-1']);

    expect(result.rows).toEqual([{ id: 'page-1', name: 'My Page' }]);
    expect(mockFetch).toHaveBeenCalledWith('SELECT id, name FROM facebook_pages WHERE id = $1', ['page-1']);
  });

  it('edge client atomicDecrementTokens decrements when sufficient and throws when insufficient', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ balance: 8 }] })
      .mockResolvedValueOnce({ rows: [] });

    const edgeClient = createEdgeClient({ fetchHandler: mockFetch });

    const success = await edgeClient.atomicDecrementTokens('agency-1', 2);
    expect(success).toEqual({ balance: 8 });

    await expect(edgeClient.atomicDecrementTokens('agency-1', 20)).rejects.toThrow(
      InsufficientFundsError
    );
  });
});
