/**
 * Applies the harness DB bootstrap + ALL repo migrations, in filename
 * order, to a plain PostgreSQL database (spec 122 load harness).
 *
 * Usage:
 *   LOAD_PG_URL=postgres://postgres@/loadharness?host=/path/to/pgsocket \
 *     pnpm --filter @fbuploadpro/worker exec tsx load-harness/db/run-migrations.ts
 *
 * Prerequisite: the target database exists and is empty (or disposable).
 * See load-harness/README.md for the full reproducible setup, including
 * the pgcrypto stub the pgserver wheel needs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', '..', '..', 'supabase', 'migrations');

async function main(): Promise<void> {
  const url = process.env.LOAD_PG_URL;
  if (!url) throw new Error('LOAD_PG_URL is required');
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

main().catch((err: unknown) => {
  console.error('[migrations] FAILED:', err);
  process.exit(1);
});
