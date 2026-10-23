/**
 * Applies the claim-rpc rig bootstrap + repo migrations, in filename
 * order, to a plain PostgreSQL database (spec 138 claim-rpc rig).
 * Modelled on the spec 122 load harness's db/run-migrations.ts.
 *
 * Usage:
 *   CLAIM_RPC_PG_URL=postgres://postgres@/claimrpc138?host=/path/to/pgsocket \
 *     pnpm --filter @fbuploadpro/worker exec tsx tests/claim-rpc/db/run-migrations.ts
 *
 * Prerequisite: the target database exists and is empty (or disposable).
 * See tests/claim-rpc/README.md for the full reproducible setup, including
 * the pgcrypto stub the pgserver wheel needs.
 *
 * CLAIM_RPC_MIGRATIONS_UNTIL=<filename> applies only migrations up to and
 * including that file — used to build the PRE-FIX database (all migrations
 * except 20261022140000_claim_rpc_grouped_usage.sql) for the parity
 * suite's pre-fix run.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', '..', '..', '..', 'supabase', 'migrations');

async function main(): Promise<void> {
  const url = process.env.CLAIM_RPC_PG_URL;
  if (!url) throw new Error('CLAIM_RPC_PG_URL is required');
  const until = process.env.CLAIM_RPC_MIGRATIONS_UNTIL;
  const pool = new Pool({ connectionString: url });
  try {
    const bootstrap = readFileSync(join(here, 'bootstrap.sql'), 'utf8');
    await pool.query(bootstrap);
    console.log('[migrations] bootstrap applied');

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .filter((f) => !until || f <= until);
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      console.log(`[migrations] applied ${file}`);
    }
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log(`[migrations] done: ${files.length} migrations, ${rows[0]?.n} public tables`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('[migrations] FAILED:', err);
  process.exit(1);
});
