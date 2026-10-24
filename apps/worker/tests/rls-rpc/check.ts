/**
 * Spec 117 rls-rpc assertion suite (real PostgreSQL, SQL level).
 *
 * Two modes:
 *   hardened (default) — run against a database with ALL migrations
 *     (incl. 20261023120000_rls_rpc_hardening.sql AND the Phase 7 drop
 *     20261024130000_drop_legacy_facebook_schema.sql) applied. Every
 *     assertion must pass:
 *       (a) Phase 7 drop: the six legacy tables and the six legacy
 *           RPC signatures are ABSENT from pg_class/pg_proc; the
 *           unified claim/settle/recover overloads and the retention
 *           RPC are present; a dropped function is uncallable (42883)
 *           even for service_role.
 *       (b) authenticated self-update of users.role / users.status
 *           fails; a profile-column update (name) succeeds;
 *           service_role can still update role/status.
 *       (b2) INSERT-path role planting (fold-in, 2026-10-23):
 *           an authenticated self-INSERT planting role='admin' /
 *           status='suspended' is neutralised to the column defaults
 *           ('user' / 'active'); anon cannot insert at all;
 *           a service_role INSERT keeps its explicit role/status
 *           (the app-side admin-client row-creation path). In
 *           vulnerable mode the planted values are stored verbatim,
 *           documenting the hole.
 *       (c) platform_credentials (the unified BYOC home): the
 *           workspace-owner policy denies an authenticated INSERT
 *           into a foreign workspace, allows an own-workspace INSERT,
 *           and a planted row in another user's workspace is
 *           invisible to SELECT.
 *       (e) regression: the unified claim/settle/recover overloads are
 *           still denied to authenticated and allowed to service_role.
 *       (f) media_download_jobs: all four policies carry
 *           roles = {authenticated}.
 *   vulnerable — run against a database built with
 *     RLS_RPC_MIGRATIONS_UNTIL=20261022140000_claim_rpc_grouped_usage.sql
 *     (pre-hardening, pre-drop). Asserts the ORIGINAL holes are OPEN —
 *     legacy RPC lockdown section (a-legacy), the user_id-only BYOC
 *     policy (c-legacy), and the uncapped legacy claim (d) — proving
 *     the rig can actually detect them (and producing the
 *     before-state evidence). Sections (b)/(b2)/(e)/(f) run in both
 *     modes.
 *
 * Both modes print an ACL/policy dump (pg_proc.proacl for the
 * claim/settle/recover/counts/fail/slot-claim/retention signatures in
 * scope + pg_policies for users, platform_credentials,
 * media_download_jobs — plus the legacy BYOC table in vulnerable
 * mode). Pass RLS_RPC_DUMP_FILE=<path> to also write the dump to a
 * file.
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
const USER_C = '33333333-3333-3333-3333-333333333333';
const USER_D = '44444444-4444-4444-4444-444444444444';
const USER_E = '55555555-5555-5555-5555-555555555555';
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

const DROPPED_TABLES = [
  'legacy_publish_logs',
  'legacy_queue_items',
  'page_queue_slots',
  'facebook_pages',
  'facebook_accounts',
  'workspace_byoc_credentials',
] as const;

/**
 * Hardened-mode replacement for the legacy sections (Phase 7): the
 * legacy schema is gone, so instead of asserting its lockdown the rig
 * asserts its ABSENCE — by exact pg_proc identity arguments, so a
 * surviving legacy overload cannot hide behind the shared names —
 * plus the survival of everything the drop had to keep.
 */
async function sectionDropAbsence(pool: Pool): Promise<void> {
  console.log('\n(a) Phase 7 drop — legacy objects absent, unified intact');
  const tables = await pool.query<{ relname: string }>(
    `SELECT relname FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
        AND relname = ANY($1::text[])`,
    [[...DROPPED_TABLES]]
  );
  check(
    tables.rows.length === 0,
    'all six legacy tables absent from pg_class',
    `still present: ${tables.rows.map((r) => r.relname).join(', ')}`
  );

  const fns = await pool.query<{ proname: string; args: string }>(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
        AND p.proname = ANY($1::text[])`,
    [[
      'claim_due_queue_items',
      'settle_queue_item_outcome',
      'recover_stuck_publishing_items',
      'get_page_queue_status_counts',
      'fail_stuck_download_jobs',
      'claim_queue_slot_insert',
      'cleanup_expired_publish_history',
    ]]
  );
  const has = (name: string, pred: (args: string) => boolean): boolean =>
    fns.rows.some((r) => r.proname === name && pred(r.args));

  check(!has('get_page_queue_status_counts', () => true), 'get_page_queue_status_counts(UUID, UUID) absent');
  check(!has('fail_stuck_download_jobs', () => true), 'fail_stuck_download_jobs(INT) absent (media_download_jobs table kept)');
  check(!has('claim_queue_slot_insert', () => true), 'claim_queue_slot_insert(9-arg) absent');
  check(
    !has('claim_due_queue_items', (a) => a.includes('p_max_per_page')),
    'legacy claim_due_queue_items(INT, INT) absent'
  );
  check(
    has('claim_due_queue_items', (a) => a.includes('p_platform')),
    'unified claim_due_queue_items(platform, …) present'
  );
  check(
    !has('settle_queue_item_outcome', (a) => a.includes('p_fb_page_id')),
    'legacy settle_queue_item_outcome(16-arg, INT codes) absent'
  );
  check(
    has('settle_queue_item_outcome', (a) => a.includes('p_destination_id')),
    'unified settle_queue_item_outcome(…destination…) present'
  );
  check(
    !has('recover_stuck_publishing_items', (a) => !a.includes('p_platform')),
    'legacy recover_stuck_publishing_items(INT) absent'
  );
  check(
    has('recover_stuck_publishing_items', (a) => a.includes('p_platform')),
    'unified recover_stuck_publishing_items(platform, …) present'
  );
  check(
    has('cleanup_expired_publish_history', () => true),
    'retention RPC cleanup_expired_publish_history intact'
  );

  const gone = await attempt(
    pool,
    'service_role',
    null,
    'SELECT * FROM public.get_page_queue_status_counts($1::uuid, $2::uuid)',
    [PAGE_A, USER_A]
  );
  check(
    !gone.ok && gone.code === '42883',
    'dropped counts RPC uncallable even for service_role (42883)',
    gone.ok ? 'call succeeded' : `${gone.code} ${gone.message}`
  );
}

async function sectionLegacyRpcs(pool: Pool, legacyItem: string): Promise<void> {
  console.log('\n(a-legacy) legacy RPC EXECUTE lockdown');
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

async function sectionUsersInsert(pool: Pool): Promise<void> {
  console.log('\n(b2) users INSERT-path role planting');
  const plantSql = `INSERT INTO public.users (id, email, name, role, status)
                    VALUES ($1::uuid, $2, $3, 'admin', 'suspended')`;
  // An authenticated caller with a self-obtained Auth JWT (sub = their
  // own auth id) inserts their public.users row BEFORE any app flow
  // creates it, planting a privileged role/status. users_self_access's
  // WITH CHECK only pins id = auth.uid(), so RLS lets it through; only
  // the guard trigger can neutralise the planted values.
  await asRole(
    pool,
    'authenticated',
    USER_C,
    async (client) => {
      const res = await client.query(plantSql, [USER_C, 'rls117.c@gmail.com', 'Rig User C']);
      check(res.rowCount === 1, 'authenticated self-INSERT of own users row succeeds (RLS permits own-id insert)');
    },
    { commit: true }
  );
  const planted = await pool.query<{ role: string; status: string }>('SELECT role, status FROM public.users WHERE id = $1', [USER_C]);
  if (hardened) {
    check(planted.rows[0]?.role === 'user', "planted role='admin' neutralised to default 'user'", `stored role=${planted.rows[0]?.role}`);
    check(planted.rows[0]?.status === 'active', "planted status='suspended' neutralised to default 'active'", `stored status=${planted.rows[0]?.status}`);
  } else {
    check(planted.rows[0]?.role === 'admin', "planted role='admin' stored verbatim (pre-hardening hole)", `stored role=${planted.rows[0]?.role}`);
    check(planted.rows[0]?.status === 'suspended', "planted status='suspended' stored verbatim (pre-hardening hole)", `stored status=${planted.rows[0]?.status}`);
  }
  // anon has no INSERT policy on users at all (users_self_access is
  // TO authenticated) — denied in both modes.
  const anonIns = await attempt(pool, 'anon', null, plantSql, [USER_E, 'rls117.e@gmail.com', 'Rig User E']);
  check(!anonIns.ok && anonIns.code === '42501', 'anon INSERT into users denied (no anon policy)', anonIns.ok ? 'insert succeeded' : `${anonIns.code}`);
  // The app-side creation path: service_role (admin client) upserts
  // user rows and may set role/status explicitly — fully preserved.
  await asRole(
    pool,
    'service_role',
    null,
    async (client) => {
      const res = await client.query(plantSql, [USER_D, 'rls117.d@gmail.com', 'Rig User D']);
      check(res.rowCount === 1, 'service_role INSERT of a users row succeeds');
    },
    { commit: true }
  );
  const svcRow = await pool.query<{ role: string; status: string }>('SELECT role, status FROM public.users WHERE id = $1', [USER_D]);
  check(svcRow.rows[0]?.role === 'admin', "service_role INSERT keeps explicit role='admin'", `stored role=${svcRow.rows[0]?.role}`);
  check(svcRow.rows[0]?.status === 'suspended', "service_role INSERT keeps explicit status='suspended'", `stored status=${svcRow.rows[0]?.status}`);
}

async function sectionByoc(pool: Pool): Promise<void> {
  console.log('\n(c-legacy) workspace_byoc_credentials compound policy');
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

/**
 * The unified BYOC home's policy (spec 120 §5): workspace-owner
 * compound USING/WITH CHECK, correct from creation — the assertions
 * are the same in both modes (the vulnerable database predates the
 * hardening but not the unified schema).
 */
async function sectionCredentials(pool: Pool): Promise<void> {
  console.log('\n(c) platform_credentials workspace-owner policy');
  const insertSql = `INSERT INTO public.platform_credentials (workspace_id, platform, client_id, encrypted_client_secret)
                     VALUES ($1::uuid, 'facebook', $2, 'dummy-secret')`;
  const foreignIns = await attempt(pool, 'authenticated', USER_A, insertSql, [WS_C, 'app-foreign']);
  check(
    !foreignIns.ok && foreignIns.code === '42501',
    'credentials INSERT with foreign workspace_id -> denied (RLS WITH CHECK)',
    foreignIns.ok ? 'insert succeeded' : `${foreignIns.code} ${foreignIns.message}`
  );
  await asRole(
    pool,
    'authenticated',
    USER_A,
    async (client) => {
      const res = await client.query(insertSql, [WS_A2, 'app-a2']);
      check(res.rowCount === 1, 'credentials INSERT with own workspace_id succeeds');
      const seen = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM public.platform_credentials WHERE workspace_id = $1::uuid',
        [WS_B]
      );
      check(seen.rows[0]?.n === 0, "planted credentials row in B's workspace is invisible to A (workspace-owner USING)");
      const own = await client.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM public.platform_credentials WHERE workspace_id = ANY($1::uuid[])',
        [[WS_A, WS_A2]]
      );
      check(own.rows[0]?.n === 2, 'own credentials rows remain visible to A');
    },
    { commit: true }
  );
}

async function sectionClaimCap(pool: Pool): Promise<void> {
  console.log('\n(d) legacy claim p_limit cap');
  await pool.query('SELECT public.rls117_reset()');
  await pool.query('SELECT public.rls117_reset_legacy()');
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
                          'get_page_queue_status_counts', 'fail_stuck_download_jobs',
                          'claim_queue_slot_insert', 'cleanup_expired_publish_history')
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
        AND tablename IN ('users', 'workspace_byoc_credentials', 'platform_credentials', 'media_download_jobs')
      ORDER BY tablename, policyname`
  );
  const lines: string[] = ['--- pg_proc.proacl (in-scope functions) ---'];
  for (const r of fns.rows) lines.push(`${r.proname}(${r.args})  ${r.acl}`);
  lines.push('--- pg_policies (users / workspace_byoc_credentials / platform_credentials / media_download_jobs) ---');
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
    if (!hardened) {
      // The vulnerable database predates the Phase 7 drop, so the
      // legacy fixture graph can (and must) be seeded there.
      await pool.query(readFileSync(join(here, 'fixtures-legacy.sql'), 'utf8'));
    }
    await pool.query('SELECT public.rls117_reset()');

    console.log(`\n== spec 117 rls-rpc rig — mode: ${mode} ==`);
    if (hardened) {
      await sectionDropAbsence(pool);
    } else {
      await pool.query('SELECT public.rls117_reset_legacy()');
      await pool.query('SELECT public.rls117_seed_legacy_items(3)');
      const seeded = await pool.query<{ id: string }>('SELECT id FROM public.legacy_queue_items ORDER BY id LIMIT 1');
      const legacyItem = seeded.rows[0]?.id as string;
      await sectionLegacyRpcs(pool, legacyItem);
    }
    await sectionUsers(pool);
    await sectionUsersInsert(pool);
    if (hardened) {
      await sectionCredentials(pool);
    } else {
      await sectionByoc(pool);
      await sectionClaimCap(pool);
    }
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
