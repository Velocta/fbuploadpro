/**
 * Applies the settle-rpc rig bootstrap + repo migrations, in filename
 * order, to a plain PostgreSQL database (spec 139 settle-rpc rig).
 * Modelled verbatim on the spec 117 rls-rpc rig's db/run-migrations.ts.
 *
 * Usage:
 *   SETTLE_RPC_PG_URL=postgres://postgres@/settle139?host=/path/to/pgsocket&port=5432 \
 *     pnpm --filter @fbuploadpro/worker exec tsx tests/settle-rpc/db/run-migrations.ts
 *
 * Prerequisite: the target database exists and is empty (or disposable).
 * See tests/settle-rpc/README.md for the full reproducible setup.
 *
 * SETTLE_RPC_MIGRATIONS_UNTIL=<filename> applies only migrations up to and
 * including that file — used to build a PRE-HARDENING database (all
 * migrations except 20261023130000_settle_rpc_hardening.sql) when
 * investigating before-state behaviour.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', '..', '..', '..', 'supabase', 'migrations');

async function main(): Promise<void> {
  const url = process.env.SETTLE_RPC_PG_URL;
  if (!url) throw new Error('SETTLE_RPC_PG_URL is required');
  const until = process.env.SETTLE_RPC_MIGRATIONS_UNTIL;
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

try {
  await main();
} catch (err) {
  console.error('[migrations] FAILED:', err);
  process.exit(1);
}
