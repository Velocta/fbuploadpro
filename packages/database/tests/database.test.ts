import { describe, expect, it, vi } from 'vitest';
import { DomainError, InsufficientFundsError } from '@fbuploadpro/contracts';
import { createDatabaseClient } from '../src/client.js';
import { createEdgeDatabaseClient, type EdgeTransport } from '../src/edge.js';
import type { Pool, PoolClient } from 'pg';

describe('Database Client Suite', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  describe('Node.js DatabaseClient', () => {
    it('executes parameterized query and queryOne', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ id: userId, email: 'test@example.com' }],
        }),
      } as unknown as Pool;

      const client = createDatabaseClient(mockPool);
      const rows = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      expect(rows).toHaveLength(1);

      const one = await client.queryOne('SELECT * FROM users WHERE id = $1', [userId]);
      expect(one).toEqual({ id: userId, email: 'test@example.com' });
    });

    it('manages transaction with commit on success', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const client = createDatabaseClient(mockPool);
      const result = await client.withTransaction(async (c) => {
        await c.query('INSERT INTO something VALUES (1)');
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back transaction on error', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as unknown as Pool;

      const client = createDatabaseClient(mockPool);
      await expect(
        client.withTransaction(async () => {
          throw new Error('tx-failed');
        })
      ).rejects.toThrow('tx-failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('atomicDecrementTokens returns updated balance on success', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rowCount: 1,
          rows: [{ tokens_balance: '850' }],
        }),
      } as unknown as Pool;

      const client = createDatabaseClient(mockPool);
      const remaining = await client.atomicDecrementTokens(userId, 150);
      expect(remaining).toBe(850);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [userId, 150]
      );
    });

    it('atomicDecrementTokens throws InsufficientFundsError when balance is insufficient', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rowCount: 0,
          rows: [],
        }),
      } as unknown as Pool;

      const client = createDatabaseClient(mockPool);
      await expect(client.atomicDecrementTokens(userId, 500)).rejects.toThrow(InsufficientFundsError);
    });

    it('atomicDecrementTokens rejects non-positive or float amounts', async () => {
      const mockPool = { query: vi.fn() } as unknown as Pool;
      const client = createDatabaseClient(mockPool);

      await expect(client.atomicDecrementTokens(userId, 0)).rejects.toThrow(DomainError);
      await expect(client.atomicDecrementTokens(userId, -10)).rejects.toThrow(DomainError);
      await expect(client.atomicDecrementTokens(userId, 5.5)).rejects.toThrow(DomainError);
    });
  });

  describe('Edge Isolate DatabaseClient', () => {
    it('executes edge query and atomic token decrement without node sockets', async () => {
      const mockTransport: EdgeTransport = {
        fetch: vi.fn().mockResolvedValue([{ tokens_balance: 400 }]),
      };

      const edgeClient = createEdgeDatabaseClient(mockTransport);
      const remaining = await edgeClient.atomicDecrementTokens(userId, 100);
      expect(remaining).toBe(400);
      expect(mockTransport.fetch).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [userId, 100]
      );
    });

    it('throws InsufficientFundsError when edge update returns 0 rows', async () => {
      const mockTransport: EdgeTransport = {
        fetch: vi.fn().mockResolvedValue([]),
      };

      const edgeClient = createEdgeDatabaseClient(mockTransport);
      await expect(edgeClient.atomicDecrementTokens(userId, 1000)).rejects.toThrow(
        InsufficientFundsError
      );
    });
  });
});
