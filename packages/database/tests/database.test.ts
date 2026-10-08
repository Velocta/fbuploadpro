import { describe, expect, it, vi } from 'vitest';
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
  });

  describe('Edge Isolate DatabaseClient', () => {
    it('executes edge query without node sockets', async () => {
      const mockTransport: EdgeTransport = {
        fetch: vi.fn().mockResolvedValue([{ id: 'test-1' }]),
      };

      const edgeClient = createEdgeDatabaseClient(mockTransport);
      const rows = await edgeClient.query('SELECT id FROM users WHERE id = $1', ['test-1']);
      expect(rows).toEqual([{ id: 'test-1' }]);
      expect(mockTransport.fetch).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE id = $1',
        ['test-1']
      );
    });

    it('executes edge queryOne correctly', async () => {
      const mockTransport: EdgeTransport = {
        fetch: vi.fn().mockResolvedValue([{ id: 'test-1' }]),
      };

      const edgeClient = createEdgeDatabaseClient(mockTransport);
      const row = await edgeClient.queryOne('SELECT id FROM users WHERE id = $1', ['test-1']);
      expect(row).toEqual({ id: 'test-1' });
    });
  });
});
