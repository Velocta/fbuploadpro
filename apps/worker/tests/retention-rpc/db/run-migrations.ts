/**
 * Applies the retention-rpc rig bootstrap + repo migrations, in filename
 * order, to a plain PostgreSQL database (spec 139 retention rig).
 * Modelled on the spec 139 db-hygiene rig's db/run-migrations.ts.
 *
 * Usage:
 *   RETENTION_RPC_PG_URL=postgres://postgres@/retentionrig?host=/path/to/pgsocket&port=5432 \
 *     pnpm --filter @fbuploadpro/worker exec tsx tests/retention-rpc/db/run-migrations.ts
 *
 * Prerequisite: the target database exists and is empty (or disposable).
 * See tests/retention-rpc/README.md for the full reproducible setup.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', '..', '..', '..', 'supabase', 'migrations');

async function main(): Promise<void> {
  const url = process.env.RETENTION_RPC_PG_URL;
  if (!url) throw new Error('RETENTION_RPC_PG_URL is required');
  const pool = new Pool({ connectionString: url });
  try {
    const bootstrap = readFileSync(join(here, 'bootstrap.sql'), 'utf8');
    await pool.query(bootstrap);
    console.log('[migrations] bootstrap applied');

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
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
