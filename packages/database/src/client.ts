import pg from 'pg';
import type { Pool, PoolClient, PoolConfig } from 'pg';
import { DomainError, DomainErrorCode, InsufficientFundsError } from '@fbuploadpro/contracts';

const { Pool: PgPool } = pg;

export interface PageInsightsDailySnapshot {
  id?: string;
  userId: string;
  fbPageId: string;
  snapshotDate: string;
  fanCount: number;
  followersCount: number;
  dailyFollows?: number;
  dailyUnfollows?: number;
  mediaViews?: number;
  videoViews?: number;
  videoCompleteViews30s?: number;
  videoViewTimeSeconds?: number;
  reactionsSummary?: Record<string, number>;
  demographicsSummary?: {
    topCountries?: Array<{ name: string; count: number; percentage: number }>;
    topCities?: Array<{ name: string; count: number; percentage: number }>;
  };
}

export interface PageInsightsDailySnapshotRow {
  id: string;
  user_id: string;
  fb_page_id: string;
  snapshot_date: string;
  fan_count: string | number;
  followers_count: string | number;
  daily_follows: number;
  daily_unfollows: number;
  media_views: number;
  video_views: number;
  video_complete_views_30s: number;
  video_view_time_seconds: string | number;
  reactions_summary: Record<string, number>;
  demographics_summary: {
    topCountries?: Array<{ name: string; count: number; percentage: number }>;
    topCities?: Array<{ name: string; count: number; percentage: number }>;
  };
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DatabaseClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null>;
  withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
  atomicDecrementTokens(userId: string, amount: number): Promise<number>;
  upsertPageInsightsSnapshot(snapshot: PageInsightsDailySnapshot): Promise<void>;
  getPageInsightsSnapshots(userId: string, fbPageId: string, sinceDate: string, untilDate: string): Promise<PageInsightsDailySnapshotRow[]>;
  close(): Promise<void>;
}

export function createDatabaseClient(poolOrConfig?: Pool | PoolConfig): DatabaseClient {
  const pool = (poolOrConfig && (typeof (poolOrConfig as Pool).query === 'function' || typeof (poolOrConfig as Pool).connect === 'function'))
    ? (poolOrConfig as Pool)
    : new PgPool(poolOrConfig as PoolConfig);

  return {
    async query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
      const result = await pool.query(text, params);
      return result.rows as T[];
    },

    async queryOne<T = unknown>(text: string, params?: unknown[]): Promise<T | null> {
      const result = await pool.query(text, params);
      return (result.rows[0] as T) ?? null;
    },

    async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const res = await callback(client);
        await client.query('COMMIT');
        return res;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async atomicDecrementTokens(userId: string, amount: number): Promise<number> {
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new DomainError(
          DomainErrorCode.VALIDATION_FAILED,
          'Token decrement amount must be a positive integer'
        );
      }

      const sql = `
        UPDATE users
        SET tokens_balance = tokens_balance - $2, updated_at = now()
        WHERE id = $1 AND tokens_balance >= $2
        RETURNING tokens_balance;
      `;

      const result = await pool.query(sql, [userId, amount]);
      if (result.rowCount === 0 || result.rows.length === 0) {
        throw new InsufficientFundsError('User has insufficient token balance for this operation');
      }

      return Number((result.rows[0] as { tokens_balance: string | number }).tokens_balance);
    },

    async upsertPageInsightsSnapshot(snapshot: PageInsightsDailySnapshot): Promise<void> {
      const sql = `
        INSERT INTO page_insights_daily_snapshots (
          user_id, fb_page_id, snapshot_date, fan_count, followers_count,
          daily_follows, daily_unfollows, media_views, video_views,
          video_complete_views_30s, video_view_time_seconds,
          reactions_summary, demographics_summary
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        ON CONFLICT (user_id, fb_page_id, snapshot_date)
        DO UPDATE SET
          fan_count = EXCLUDED.fan_count,
          followers_count = EXCLUDED.followers_count,
          daily_follows = EXCLUDED.daily_follows,
          daily_unfollows = EXCLUDED.daily_unfollows,
          media_views = EXCLUDED.media_views,
          video_views = EXCLUDED.video_views,
          video_complete_views_30s = EXCLUDED.video_complete_views_30s,
          video_view_time_seconds = EXCLUDED.video_view_time_seconds,
          reactions_summary = EXCLUDED.reactions_summary,
          demographics_summary = EXCLUDED.demographics_summary,
          updated_at = now();
      `;
      await pool.query(sql, [
        snapshot.userId,
        snapshot.fbPageId,
        snapshot.snapshotDate,
        snapshot.fanCount,
        snapshot.followersCount,
        snapshot.dailyFollows ?? 0,
        snapshot.dailyUnfollows ?? 0,
        snapshot.mediaViews ?? 0,
        snapshot.videoViews ?? 0,
        snapshot.videoCompleteViews30s ?? 0,
        snapshot.videoViewTimeSeconds ?? 0,
        JSON.stringify(snapshot.reactionsSummary ?? {}),
        JSON.stringify(snapshot.demographicsSummary ?? {}),
      ]);
    },

    async getPageInsightsSnapshots(
      userId: string,
      fbPageId: string,
      sinceDate: string,
      untilDate: string
    ): Promise<PageInsightsDailySnapshotRow[]> {
      const sql = `
        SELECT * FROM page_insights_daily_snapshots
        WHERE user_id = $1 AND fb_page_id = $2 AND snapshot_date >= $3 AND snapshot_date <= $4
        ORDER BY snapshot_date ASC;
      `;
      const result = await pool.query(sql, [userId, fbPageId, sinceDate, untilDate]);
      return result.rows as PageInsightsDailySnapshotRow[];
    },

    async close(): Promise<void> {
      await pool.end();
    },
  };
}
