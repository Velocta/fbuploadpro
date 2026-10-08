import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabaseClient } from '../src/client.js';
import type { Pool } from 'pg';

describe('Facebook Page Insights Database Substrate & Migration Suite (T151, T152, T153)', () => {
  const migrationPath = path.resolve(__dirname, '../migrations/0005_page_insights.sql');

  it('0005_page_insights.sql exists and defines page_insights_daily_snapshots with compound uniqueness', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const ddl = fs.readFileSync(migrationPath, 'utf8');

    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS public.page_insights_daily_snapshots');
    expect(ddl).toContain('user_id UUID NOT NULL');
    expect(ddl).toContain('fb_page_id VARCHAR(64) NOT NULL');
    expect(ddl).toContain('snapshot_date DATE NOT NULL');
    expect(ddl).toContain('fan_count BIGINT NOT NULL DEFAULT 0');
    expect(ddl).toContain('followers_count BIGINT NOT NULL DEFAULT 0');
    expect(ddl).toContain('video_complete_views_30s INT NOT NULL DEFAULT 0');
    expect(ddl).toContain('reactions_summary JSONB NOT NULL DEFAULT \'{}\'::jsonb');
    expect(ddl).toContain('demographics_summary JSONB NOT NULL DEFAULT \'{}\'::jsonb');
    expect(ddl).toContain('CONSTRAINT fk_page_insights_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE');
    expect(ddl).toContain('CONSTRAINT uq_page_insights_user_page_date UNIQUE (user_id, fb_page_id, snapshot_date)');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS idx_page_insights_user_page_date');
  });

  it('createDatabaseClient exposes upsertPageInsightsSnapshot and executes parameterized upsert', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const mockPool = {
      query: mockQuery,
      connect: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    const db = createDatabaseClient(mockPool);
    expect(typeof db.upsertPageInsightsSnapshot).toBe('function');
    expect(typeof db.getPageInsightsSnapshots).toBe('function');

    await db.upsertPageInsightsSnapshot({
      userId: '11111111-1111-1111-1111-111111111111',
      fbPageId: 'fb-page-123',
      snapshotDate: '2026-10-01',
      fanCount: 12000,
      followersCount: 15000,
      dailyFollows: 50,
      dailyUnfollows: 5,
      mediaViews: 2000,
      videoViews: 1500,
      videoCompleteViews30s: 800,
      videoViewTimeSeconds: 45000,
      reactionsSummary: { like: 100, love: 30 },
      demographicsSummary: {
        topCountries: [{ name: 'US', count: 50, percentage: 50 }],
      },
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0];
    const params = mockQuery.mock.calls[0][1];

    expect(sql).toContain('INSERT INTO page_insights_daily_snapshots');
    expect(sql).toContain('ON CONFLICT (user_id, fb_page_id, snapshot_date)');
    expect(sql).toContain('DO UPDATE SET');
    expect(params[0]).toBe('11111111-1111-1111-1111-111111111111');
    expect(params[1]).toBe('fb-page-123');
    expect(params[2]).toBe('2026-10-01');
    expect(params[3]).toBe(12000);
    expect(params[4]).toBe(15000);
  });

  it('createDatabaseClient.getPageInsightsSnapshots enforces compound tenant isolation on user_id and fb_page_id', async () => {
    const mockRows = [
      {
        id: 'snapshot-1',
        user_id: '11111111-1111-1111-1111-111111111111',
        fb_page_id: 'fb-page-123',
        snapshot_date: '2026-10-01',
        fan_count: 12000,
        followers_count: 15000,
        daily_follows: 50,
        daily_unfollows: 5,
        media_views: 2000,
        video_views: 1500,
        video_complete_views_30s: 800,
        video_view_time_seconds: 45000,
        reactions_summary: { like: 100 },
        demographics_summary: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1, rows: mockRows });
    const mockPool = {
      query: mockQuery,
      connect: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;

    const db = createDatabaseClient(mockPool);
    const results = await db.getPageInsightsSnapshots(
      '11111111-1111-1111-1111-111111111111',
      'fb-page-123',
      '2026-10-01',
      '2026-10-28'
    );

    expect(results).toHaveLength(1);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0];
    const params = mockQuery.mock.calls[0][1];

    expect(sql).toContain('WHERE user_id = $1 AND fb_page_id = $2');
    expect(params).toEqual([
      '11111111-1111-1111-1111-111111111111',
      'fb-page-123',
      '2026-10-01',
      '2026-10-28',
    ]);
  });
});
