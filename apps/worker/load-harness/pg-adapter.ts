/**
 * PG-backed adapter for the spec 122 load harness.
 *
 * Implements BOTH pipeline DB interfaces against a real PostgreSQL database
 * (real migrations, real RPCs) using the `pg` driver:
 *   - ClaimerDbClient (claimer.ts): rpc()
 *   - ConsumerDbClient (consumers.ts): rpc() + from().select().eq().maybeSingle()
 *
 * Only the operations the real pipeline actually uses are implemented:
 *   - rpc('claim_due_queue_items' | 'settle_queue_item_outcome' |
 *         'recover_stuck_publishing_items') with explicit casts so the
 *     unified (spec 120/121) overloads win over the legacy overloads.
 *   - single-row loads of queue_items / destinations / social_accounts by id.
 *   - worker_heartbeats upsert (consumers report settled/DLQ counts through
 *     recordHeartbeat, which calls from('worker_heartbeats').upsert(...)).
 *
 * Like the Supabase client, failures are returned as { data: null, error }
 * rather than thrown, so the pipeline's own error paths run unchanged.
 */
import { Pool, type PoolConfig } from 'pg';

type RpcResult = { data: unknown; error: unknown };

function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

const SETTLE_ARG_ORDER = [
  'p_queue_item_id',
  'p_workspace_id',
  'p_destination_id',
  'p_outcome_status',
  'p_external_post_id',
  'p_external_comment_id',
  'p_retry_count',
  'p_retry_delay_seconds',
  'p_error_code',
  'p_error_subcode',
  'p_error_message',
  'p_comment_warning',
  'p_target_destination_status',
  'p_target_account_status',
  'p_destination_cooldown_seconds',
  'p_rate_usage_pct',
] as const;

export class PgPipelineDb {
  readonly pool: Pool;

  constructor(connectionString: string, poolMax = 48) {
    const config: PoolConfig = { connectionString, max: poolMax };
    this.pool = new Pool(config);
    // Local-harness session tuning for the claim RPC's window-function sort.
    // (Documented in the certification results; not a production change.)
    this.pool.on('connect', (client) => {
      client.query("SET work_mem = '64MB'").catch((err: unknown) => {
        console.error('[pg-adapter] SET work_mem failed:', err);
      });
    });
  }

  async rpc(fn: string, args: Record<string, unknown> = {}): Promise<RpcResult> {
    try {
      if (fn === 'claim_due_queue_items') {
        const res = await this.pool.query(
          'SELECT * FROM public.claim_due_queue_items($1::public.platform, $2::text[], $3::int, $4::int)',
          [args.p_platform, args.p_lane_kind_set, args.p_limit, args.p_max_per_destination]
        );
        return { data: res.rows.map((r) => normaliseRow(r as Record<string, unknown>)), error: null };
      }
      if (fn === 'settle_queue_item_outcome') {
        const values = SETTLE_ARG_ORDER.map((key) => args[key] ?? null);
        await this.pool.query(
          `SELECT public.settle_queue_item_outcome(
             $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text,
             $7::int, $8::int, $9::text, $10::text, $11::text, $12::text,
             $13::text, $14::text, $15::int, $16::smallint)`,
          values
        );
        return { data: null, error: null };
      }
      if (fn === 'recover_stuck_publishing_items') {
        if (args.p_platform !== undefined) {
          const res = await this.pool.query(
            'SELECT public.recover_stuck_publishing_items($1::public.platform, $2::int) AS n',
            [args.p_platform, args.p_timeout_minutes]
          );
          return { data: res.rows[0]?.n ?? 0, error: null };
        }
        const res = await this.pool.query(
          'SELECT public.recover_stuck_publishing_items($1::int) AS n',
          [args.p_timeout_minutes]
        );
        return { data: res.rows[0]?.n ?? 0, error: null };
      }
      return { data: null, error: new Error(`[pg-adapter] unsupported RPC: ${fn}`) };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  from(table: string): PgRowQueryBuilder {
    return new PgRowQueryBuilder(this.pool, table);
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

export class PgRowQueryBuilder {
  private readonly filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private readonly pool: Pool,
    private readonly table: string
  ) {}

  select(_columns: string): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  async maybeSingle(): Promise<RpcResult> {
    try {
      const where = this.filters.map((f, i) => `"${f.column}" = $${i + 1}`).join(' AND ');
      const sql = `SELECT * FROM public."${this.table}"${where ? ` WHERE ${where}` : ''} LIMIT 1`;
      const res = await this.pool.query(sql, this.filters.map((f) => f.value));
      const row = res.rows[0] as Record<string, unknown> | undefined;
      return { data: row ? normaliseRow(row) : null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  /** Used only by recordHeartbeat (worker_heartbeats counts writes). */
  async upsert(
    row: Record<string, unknown>,
    options: { onConflict: string }
  ): Promise<{ error: unknown }> {
    try {
      const cols = Object.keys(row);
      const key = options.onConflict;
      const updates = cols
        .filter((c) => c !== key)
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');
      const sql =
        `INSERT INTO public."${this.table}" (${cols.map((c) => `"${c}"`).join(', ')}) ` +
        `VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ` +
        `ON CONFLICT ("${key}") DO UPDATE SET ${updates}`;
      await this.pool.query(sql, cols.map((c) => row[c]));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }
}
