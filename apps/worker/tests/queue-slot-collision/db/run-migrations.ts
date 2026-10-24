/**
 * Applies the queue-slot-collision rig bootstrap + repo migrations, in
 * filename order, to a plain PostgreSQL database (spec 139 A15 rig).
 * Modelled on the spec 139 db-hygiene rig's db/run-migrations.ts.
 *
 * Usage:
 *   QUEUE_SLOT_PG_URL=postgres://postgres@/qslot?host=/path/to/pgsocket&port=5432 \
 *     pnpm --filter @fbuploadpro/worker exec tsx tests/queue-slot-collision/db/run-migrations.ts
 *
 * Prerequisite: the target database exists and is empty (or disposable).
 * See tests/queue-slot-collision/README.md for the full reproducible setup.
 *
 * QUEUE_SLOT_MIGRATIONS_UNTIL=<filename> applies only migrations up to
 * and including that file — used to build the PRE-FIX database (all
 * migrations except 20261024120000_a15_atomic_queue_slot_insert.sql) for
 * the vulnerable-mode evidence run.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', '..', '..', '..', 'supabase', 'migrations');

async function main(): Promise<void> {
  const url = process.env.QUEUE_SLOT_PG_URL;
  if (!url) throw new Error('QUEUE_SLOT_PG_URL is required');
  const until = process.env.QUEUE_SLOT_MIGRATIONS_UNTIL;
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
