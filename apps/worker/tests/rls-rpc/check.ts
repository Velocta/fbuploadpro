/**
 * Spec 117 rls-rpc assertion suite (real PostgreSQL, SQL level).
 *
 * Two modes:
 *   hardened (default) — run against a database with ALL migrations
 *     (incl. 20261023120000_rls_rpc_hardening.sql) applied. Every
 *     assertion must pass:
 *       (a) authenticated + anon are DENIED EXECUTE on the five legacy
 *           RPC overloads; service_role can execute all five.
 *       (b) authenticated self-update of users.role / users.status
 *           fails; a profile-column update (name) succeeds;
 *           service_role can still update role/status.
 *       (c) BYOC: authenticated INSERT into a foreign workspace fails,
 *           into an own workspace succeeds, and a planted row whose
 *           workspace belongs to another user is invisible to SELECT.
 *       (d) legacy claim as service_role with p_limit = 100000 returns
 *           at most 100 rows (exactly 100 against a 150-row seed).
 *       (e) regression: the unified claim/settle/recover overloads are
 *           still denied to authenticated and allowed to service_role.
 *       (f) media_download_jobs: all four policies carry
 *           roles = {authenticated}.
 *   vulnerable — run against a database built with
 *     RLS_RPC_MIGRATIONS_UNTIL=20261022140000_claim_rpc_grouped_usage.sql
 *     (pre-hardening). Asserts the holes are OPEN, proving the rig can
 *     actually detect them (and producing the before-state evidence).
 *
 * Both modes print an ACL/policy dump (pg_proc.proacl for the ten
 * claim/settle/recover/counts/fail signatures in scope + pg_policies
 * for users, workspace_byoc_credentials, media_download_jobs). Pass
 * RLS_RPC_DUMP_FILE=<path> to also write the dump to a file.
 *
 * Usage:
 *   RLS_RPC_PG_URL=postgres://postgres@/rls117?host=<socket dir>&port=<port> \
 *     pnpm --filter @fbuploadpro/worker exec tsx tests/rls-rpc/check.ts
 * (database must already have bootstrap + migrations applied — see
 * README.md; fixtures.sql from this directory is applied by the runner.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const WS_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WS_A2 = 'acacacac-acac-acac-acac-acacacacacac';
const WS_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const WS_C = 'abababab-abab-abab-abab-abababababab';
const PAGE_A = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const UNIFIED_ITEM = 'f0000000-0000-0000-0000-000000000003';
const UNIFIED_DEST = 'f0000000-0000-0000-0000-000000000002';

type Role = 'authenticated' | 'anon' | 'service_role';

const mode = process.env.RLS_RPC_MODE === 'vulnerable' ? 'vulnerable' : 'hardened';
const hardened = mode === 'hardened';

let checks = 0;
let failures = 0;

function check(cond: boolean, label: string, detail?: string): void {
  checks += 1;
  if (cond) {
    console.log(`  ok: ${label}`);
  } else {
    failures += 1;
    const suffix = detail ? ' (' + detail + ')' : '';
    console.error(`  FAIL: ${label}${suffix}`);
  }
}

interface Attempt {
  ok: boolean;
  code: string | undefined;
  message: string | undefined;
  rowCount: number;
  rows: Record<string, unknown>[];
}

/**
 * Runs fn inside one transaction as the given role (SET LOCAL ROLE +
 * request.jwt.claim.sub), then rolls back unless commit=true.
 */
async function asRole(
  pool: Pool,
  role: Role,
  sub: string | null,
  fn: (client: PoolClient) => Promise<void>,
  opts: { commit?: boolean } = {}
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [sub ?? '']);
    await fn(client);
    await client.query(opts.commit ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Single-statement probe in a rolled-back transaction. */
async function attempt(pool: Pool, role: Role, sub: string | null, sql: string, params: unknown[] = []): Promise<Attempt> {
  let result: Attempt = { ok: false, code: undefined, message: undefined, rowCount: 0, rows: [] };
  try {
    await asRole(pool, role, sub, async (client) => {
      try {
        const res = await client.query(sql, params as never[]);
        result = { ok: true, code: undefined, message: undefined, rowCount: res.rowCount ?? 0, rows: res.rows as Record<string, unknown>[] };
      } catch (err) {
        const e = err as { code?: string; message?: string };
        result = { ok: false, code: e.code, message: e.message, rowCount: 0, rows: [] };
      }
    });
  } catch (err) {
    // A statement error aborts the transaction; asRole's cleanup can
    // surface that. The probe result was already captured inside fn —
    // only rethrow when it was not (a harness-level failure).
    if (!result.ok && !result.code) throw err;
  }
  return result;
}

interface RpcCall {
  name: string;
  sql: string;
  params: unknown[];
}

function deniedOrOpen(res: Attempt, call: RpcCall, role: Role): void {
  if (hardened) {
    check(!res.ok && res.code === '42501', `${call.name} denied to ${role}`, res.ok ? 'call succeeded' : `${res.code} ${res.message}`);
  } else {
    check(res.ok, `${call.name} still executable by ${role} (pre-hardening)`, `${res.code} ${res.message}`);
  }
}

async function probeCall(pool: Pool, call: RpcCall): Promise<void> {
  for (const role of ['authenticated', 'anon'] as const) {
    const res = await attempt(pool, role, role === 'authenticated' ? USER_A : null, call.sql, call.params);
    deniedOrOpen(res, call, role);
  }
  const svc = await attempt(pool, 'service_role', null, call.sql, call.params);
  check(svc.ok, `${call.name} executable by service_role`, `${svc.code} ${svc.message}`);
}

async function sectionLegacyRpcs(pool: Pool, legacyItem: string): Promise<void> {
  console.log('\n(a) legacy RPC EXECUTE lockdown');
  const legacyCalls: RpcCall[] = [
    { name: 'claim_due_queue_items(INT, INT)', sql: 'SELECT * FROM public.claim_due_queue_items(5, 5)', params: [] },
    {
      name: 'settle_queue_item_outcome(16-arg legacy)',
      sql: `SELECT public.settle_queue_item_outcome($1::uuid, $2::uuid, $3::uuid, 'failed',
              NULL, NULL, 0, 300, NULL::int, NULL::int, 'rig error', NULL, NULL, NULL, NULL::int, NULL::smallint)`,
      params: [legacyItem, USER_A, PAGE_A],
    },
    { name: 'recover_stuck_publishing_items(INT)', sql: 'SELECT public.recover_stuck_publishing_items(10) AS n', params: [] },
    {
      name: 'get_page_queue_status_counts(UUID, UUID)',
      sql: 'SELECT * FROM public.get_page_queue_status_counts($1::uuid, $2::uuid)',
      params: [PAGE_A, USER_A],
    },
    { name: 'fail_stuck_download_jobs(INT)', sql: 'SELECT public.fail_stuck_download_jobs(15) AS n', params: [] },
  ];
  for (const call of legacyCalls) {
    await probeCall(pool, call);
  }
}

async function sectionUsers(pool: Pool): Promise<void> {
  console.log('\n(b) users role/status self-escalation');
  const roleUpd = await attempt(pool, 'authenticated', USER_A, 'UPDATE public.users SET role = $2 WHERE id = $1', [USER_A, 'admin']);
  const statusUpd = await attempt(pool, 'authenticated', USER_A, 'UPDATE public.users SET status = $2 WHERE id = $1', [USER_A, 'suspended']);
  if (hardened) {
    check(!roleUpd.ok && roleUpd.code === '42501', 'authenticated UPDATE users.role -> denied', roleUpd.ok ? 'update succeeded' : `${roleUpd.code}`);
    check(!statusUpd.ok && statusUpd.code === '42501', 'authenticated UPDATE users.status -> denied', statusUpd.ok ? 'update succeeded' : `${statusUpd.code}`);
  } else {
    check(roleUpd.ok && roleUpd.rowCount === 1, 'authenticated UPDATE users.role still succeeds (pre-hardening)');
    check(statusUpd.ok && statusUpd.rowCount === 1, 'authenticated UPDATE users.status still succeeds (pre-hardening)');
  }
  // Profile update must work in both modes (legitimate self-service).
  await asRole(
    pool,
    'authenticated',
    USER_A,
    async (client) => {
      const res = await client.query('UPDATE public.users SET name = $2 WHERE id = $1', [USER_A, 'Rig User A Renamed']);
      check(res.rowCount === 1, 'authenticated UPDATE users.name (profile column) succeeds');
    },
    { commit: true }
  );
  const renamed = await pool.query<{ name: string }>('SELECT name FROM public.users WHERE id = $1', [USER_A]);
  check(renamed.rows[0]?.name === 'Rig User A Renamed', 'profile rename persisted');
  // service_role keeps full control of role/status.
  await asRole(
    pool,
    'service_role',
    null,
    async (client) => {
      const r1 = await client.query('UPDATE public.users SET role = $2 WHERE id = $1', [USER_B, 'seller']);
      const r2 = await client.query('UPDATE public.users SET status = $2 WHERE id = $1', [USER_B, 'suspended']);
      check(r1.rowCount === 1 && r2.rowCount === 1, 'service_role UPDATE users.role/status succeeds');
    },
    { commit: true }
  );
}

async function sectionByoc(pool: Pool): Promise<void> {
  console.log('\n(c) workspace_byoc_credentials compound policy');
  const insertSql = `INSERT INTO public.workspace_byoc_credentials (workspace_id, user_id, fb_app_id, encrypted_fb_app_secret)
                     VALUES ($1::uuid, $2::uuid, $3, 'dummy-secret')`;
  const foreignIns = await attempt(pool, 'authenticated', USER_A, insertSql, [WS_C, USER_A, 'app-foreign']);
  if (hardened) {
    check(
      !foreignIns.ok && foreignIns.code === '42501',
      'BYOC INSERT with foreign workspace_id -> denied (RLS WITH CHECK)',
      foreignIns.ok ? 'insert succeeded' : `${foreignIns.code} ${foreignIns.message}`
    );
  } else {
    check(foreignIns.ok, 'BYOC INSERT with foreign workspace_id still succeeds (pre-hardening)');
  }
  await asRole(
    pool,
    'authenticated',
    USER_A,
    async (client) => {
      const res = await client.query(insertSql, [WS_A2, USER_A, 'app-a2']);
      check(res.rowCount === 1, 'BYOC INSERT with own workspace_id succeeds');
      const seen = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM public.workspace_byoc_credentials WHERE workspace_id = $1::uuid',
        [WS_B]
      );
      if (hardened) {
        check(seen.rows[0]?.n === 0, "planted BYOC row in B's workspace is invisible to A (compound USING)");
      } else {
        check(seen.rows[0]?.n === 1, 'planted BYOC row still visible to A (pre-hardening: user_id-only USING)');
      }
      const own = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM public.workspace_byoc_credentials WHERE workspace_id = ANY($1::uuid[])',
        [[WS_A, WS_A2]]
      );
      check(own.rows[0]?.n === 2, 'own BYOC rows remain visible to A');
    },
    { commit: true }
  );
}

async function sectionClaimCap(pool: Pool): Promise<void> {
  console.log('\n(d) legacy claim p_limit cap');
  await pool.query('SELECT public.rls117_reset()');
  await pool.query('SELECT public.rls117_seed_legacy_items(150)');
  let claimed = -1;
  await asRole(pool, 'service_role', null, async (client) => {
    const res = await client.query('SELECT count(*)::int AS n FROM public.claim_due_queue_items(100000, 100000)');
    claimed = res.rows[0]?.n as number;
  });
  if (hardened) {
    check(claimed === 100, `claim(100000, 100000) over 150 due rows returns exactly 100 (got ${claimed})`);
  } else {
    check(claimed === 150, `claim(100000, 100000) still uncapped: returns all 150 (got ${claimed})`);
  }
}

async function sectionUnified(pool: Pool): Promise<void> {
  console.log('\n(e) unified overloads unchanged');
  const unifiedCalls: RpcCall[] = [
    {
      name: 'claim_due_queue_items(platform, TEXT[], INT, INT)',
      sql: "SELECT * FROM public.claim_due_queue_items('facebook'::public.platform, ARRAY['text']::text[], 5, 5)",
      params: [],
    },
    {
      name: 'settle_queue_item_outcome(16-arg unified, TEXT codes)',
      sql: `SELECT public.settle_queue_item_outcome($1::uuid, $2::uuid, $3::uuid, 'failed',
              NULL, NULL, 0, 300, 'E1'::text, 'S1'::text, 'rig error', NULL, NULL, NULL, NULL::int, NULL::smallint)`,
      params: [UNIFIED_ITEM, WS_A, UNIFIED_DEST],
    },
    {
      name: 'recover_stuck_publishing_items(platform, INT)',
      sql: "SELECT public.recover_stuck_publishing_items('facebook'::public.platform, 10) AS n",
      params: [],
    },
  ];
  await pool.query('SELECT public.rls117_reset()');
  for (const call of unifiedCalls) {
    const auth = await attempt(pool, 'authenticated', USER_A, call.sql, call.params);
    check(!auth.ok && auth.code === '42501', `${call.name} denied to authenticated`, auth.ok ? 'call succeeded' : `${auth.code}`);
    const svc = await attempt(pool, 'service_role', null, call.sql, call.params);
    check(svc.ok, `${call.name} executable by service_role`, `${svc.code} ${svc.message}`);
  }
}

function normalizeRoles(roles: string[] | string): string[] {
  if (Array.isArray(roles)) return roles;
  return String(roles).replace(/^\{|\}$/g, '').split(',').filter(Boolean);
}

async function sectionDownloadJobs(pool: Pool): Promise<void> {
  console.log('\n(f) media_download_jobs policies TO authenticated');
  const raw = await pool.query<{ policyname: string; roles: string[] | string }>(
    `SELECT policyname, roles FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'media_download_jobs' ORDER BY policyname`
  );
  // pg returns name[] either as a JS array or in Postgres text form
  // ("{authenticated}") depending on the type parser — normalize.
  const dlPols = raw.rows.map((p) => ({ policyname: p.policyname, roles: normalizeRoles(p.roles) }));
  check(dlPols.length === 4, `media_download_jobs has 4 policies (got ${dlPols.length})`);
  const expected = hardened ? ['authenticated'] : ['public'];
  const label = hardened ? 'roles = {authenticated}' : 'roles still {public} (pre-hardening)';
  for (const p of dlPols) {
    check(JSON.stringify(p.roles) === JSON.stringify(expected), `${p.policyname}: ${label}`, JSON.stringify(p.roles));
  }
  // Authenticated users still see exactly their own download jobs.
  await asRole(pool, 'authenticated', USER_A, async (client) => {
    const res = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM public.media_download_jobs');
    check(res.rows[0]?.n === 1, 'authenticated A sees exactly own download job (RLS intact)');
  });
}

async function dump(pool: Pool): Promise<string> {
  const fns = await pool.query<{ proname: string; args: string; acl: string }>(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
            COALESCE(p.proacl::text, '(default: EXECUTE TO PUBLIC)') AS acl
       FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
        AND p.proname IN ('claim_due_queue_items', 'settle_queue_item_outcome',
                          'recover_stuck_publishing_items',
                          'get_page_queue_status_counts', 'fail_stuck_download_jobs')
      ORDER BY p.proname, args`
  );
  const pols = await pool.query<{
    tablename: string;
    policyname: string;
    roles: string[] | string;
    cmd: string;
    qual: string | null;
    with_check: string | null;
  }>(
    `SELECT tablename, policyname, roles, cmd, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('users', 'workspace_byoc_credentials', 'media_download_jobs')
      ORDER BY tablename, policyname`
  );
  const lines: string[] = ['--- pg_proc.proacl (in-scope functions) ---'];
  for (const r of fns.rows) lines.push(`${r.proname}(${r.args})  ${r.acl}`);
  lines.push('--- pg_policies (users / workspace_byoc_credentials / media_download_jobs) ---');
  for (const r of pols.rows) {
    lines.push(
      `${r.tablename} :: ${r.policyname} :: roles=${JSON.stringify(r.roles)} :: cmd=${r.cmd} :: using=${r.qual ?? ''} :: with_check=${r.with_check ?? ''}`
    );
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const url = process.env.RLS_RPC_PG_URL;
  if (!url) throw new Error('RLS_RPC_PG_URL is required');
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(readFileSync(join(here, 'fixtures.sql'), 'utf8'));
    await pool.query('SELECT public.rls117_reset()');
    await pool.query('SELECT public.rls117_seed_legacy_items(3)');
    const seeded = await pool.query<{ id: string }>('SELECT id FROM public.legacy_queue_items ORDER BY id LIMIT 1');
    const legacyItem = seeded.rows[0]?.id as string;

    console.log(`\n== spec 117 rls-rpc rig — mode: ${mode} ==`);
    await sectionLegacyRpcs(pool, legacyItem);
    await sectionUsers(pool);
    await sectionByoc(pool);
    await sectionClaimCap(pool);
    await sectionUnified(pool);
    await sectionDownloadJobs(pool);

    const dumpText = await dump(pool);
    console.log(`\n== ACL / policy dump (${mode}) ==\n${dumpText}`);
    if (process.env.RLS_RPC_DUMP_FILE) {
      writeFileSync(process.env.RLS_RPC_DUMP_FILE, `${dumpText}\n`);
      console.log(`[dump written to ${process.env.RLS_RPC_DUMP_FILE}]`);
    }

    console.log(`\n== ${checks} assertions, ${failures} failures (${mode}) ==`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

try {
  await main();
} catch (err) {
  console.error('[rls-rpc] FAILED:', err);
  process.exit(1);
}
