/**
 * Per-route first-load JS measurement and budget enforcement
 * (spec 137 §3.6.2 / PR-A4; D137-3 superseded 2026-10-24).
 *
 * Usage (from apps/web, after a production build):
 *   ANALYZE=true npx next build --webpack   # or a plain production build
 *   node scripts/measure-bundle.mjs          # report only
 *   node scripts/measure-bundle.mjs --check  # enforce bundle-budgets.json
 *
 * Method: Next 16's build output no longer prints per-route sizes, so
 * first-load JS per page route is computed from the build artifacts:
 *   shared  = build-manifest.json rootMainFiles (runtime + framework,
 *             loaded by every route)
 *   route   = the route's page-*.js chunk under static/chunks/app/**,
 *             plus the layout-*.js chunks on its path (root layout,
 *             tenant layout)
 * Sizes are the emitted files on disk, raw and gzip (zlib level 9).
 * Webpack split chunks shared by several routes are attributed to the
 * shared row only when they are in rootMainFiles; route rows therefore
 * read as "shared + route-attributable" — the honest floor of a route's
 * first load, consistent across builds.
 *
 * `--check` compares the shared bundle, every page route, and total
 * emitted client JS against apps/web/bundle-budgets.json. A missing or
 * stale route budget is also a failure, so a new route cannot silently
 * enter the product without an explicit budget.
 */
import console from 'node:console';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

const argv = process.argv.slice(2);
const optionValue = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1];
};
const checkBudgets = argv.includes('--check');
const printJson = argv.includes('--json');
const budgetsPath = path.resolve(
  process.cwd(),
  optionValue('--budgets') ?? 'bundle-budgets.json'
);
const reportOut = optionValue('--report-out');

const nextDir = path.resolve(process.cwd(), '.next');
const chunksDir = path.join(nextDir, 'static', 'chunks');
const appChunksDir = path.join(chunksDir, 'app');

if (!existsSync(path.join(nextDir, 'build-manifest.json'))) {
  console.error('No production build found in .next — run a production build first.');
  process.exit(1);
}
if (!existsSync(appChunksDir)) {
  console.error(
    '.next has no per-route app chunks (Turbopack build). Measure against the analyzer build: ANALYZE=true npx next build --webpack'
  );
  process.exit(1);
}

const sizeOf = (rel) => {
  const buf = readFileSync(path.join(nextDir, rel));
  return { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
};
const sum = (files) =>
  files.reduce(
    (acc, f) => ({ raw: acc.raw + f.raw, gzip: acc.gzip + f.gzip }),
    { raw: 0, gzip: 0 }
  );
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const byteCount = (bytes) => `${bytes.toLocaleString('en-US')} bytes`;

const buildManifest = JSON.parse(
  readFileSync(path.join(nextDir, 'build-manifest.json'), 'utf8')
);
const sharedFiles = buildManifest.rootMainFiles.map(sizeOf);
const shared = sum(sharedFiles);

const routesManifest = JSON.parse(
  readFileSync(path.join(nextDir, 'app-path-routes-manifest.json'), 'utf8')
);

const chunksIn = (dir, prefix) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && f.endsWith('.js'))
        .map((f) => path.relative(nextDir, path.join(dir, f)))
    : [];

const rows = [];
for (const [fileKey, route] of Object.entries(routesManifest)) {
  if (!fileKey.endsWith('/page')) continue;
  const relDir = fileKey.slice(0, -'/page'.length); // e.g. /tenant/[subdomain]/media
  const segments = relDir.split('/').filter(Boolean);
  const layoutFiles = [];
  let cursor = appChunksDir;
  layoutFiles.push(...chunksIn(cursor, 'layout-'));
  for (const seg of segments) {
    cursor = path.join(cursor, seg);
    layoutFiles.push(...chunksIn(cursor, 'layout-'));
  }
  const pageFiles = chunksIn(path.join(appChunksDir, ...segments), 'page-');
  const own = sum([...layoutFiles, ...pageFiles].map((f) => sizeOf(f)));
  rows.push({
    route: route === '' ? '/' : route,
    own,
    total: { raw: shared.raw + own.raw, gzip: shared.gzip + own.gzip },
  });
}
rows.sort((a, b) => b.total.gzip - a.total.gzip);

// Total client JS emitted (every chunk, incl. lazily loaded ones).
let totalRaw = 0;
let totalGzip = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.js')) {
      const s = sizeOf(path.relative(nextDir, p));
      totalRaw += s.raw;
      totalGzip += s.gzip;
    }
  }
};
walk(chunksDir);

const measurement = {
  shared: { gzipBytes: shared.gzip, rawBytes: shared.raw },
  routes: Object.fromEntries(
    rows.map((row) => [
      row.route,
      {
        firstLoadGzipBytes: row.total.gzip,
        firstLoadRawBytes: row.total.raw,
        routeSpecificGzipBytes: row.own.gzip,
        routeSpecificRawBytes: row.own.raw,
      },
    ])
  ),
  totalClientJs: { gzipBytes: totalGzip, rawBytes: totalRaw },
  routeCount: rows.length,
};

const compareMetric = (violations, scope, metric, actual, budget) => {
  if (!Number.isFinite(budget)) {
    violations.push(`${scope} ${metric}: missing budget`);
    return 0;
  }
  if (actual > budget) {
    const over = actual - budget;
    const overPercent = ((over / budget) * 100).toFixed(1);
    violations.push(
      `${scope} ${metric}: ${byteCount(actual)} exceeds budget ${byteCount(budget)} by ${byteCount(over)} (+${overPercent}%)`
    );
    return 0;
  }
  return 1;
};

const evaluateBudgets = (config) => {
  const violations = [];
  let passed = 0;
  const budgets = config.budgets ?? {};

  passed += compareMetric(
    violations,
    'shared (all routes)',
    'first-load gzip',
    measurement.shared.gzipBytes,
    budgets.shared?.firstLoadGzipBytes
  );
  passed += compareMetric(
    violations,
    'shared (all routes)',
    'first-load raw',
    measurement.shared.rawBytes,
    budgets.shared?.firstLoadRawBytes
  );

  const measuredRoutes = new Set(Object.keys(measurement.routes));
  const budgetedRoutes = new Set(Object.keys(budgets.routes ?? {}));
  for (const route of measuredRoutes) {
    if (!budgetedRoutes.has(route)) {
      violations.push(`${route}: missing route budget`);
    }
  }
  for (const route of budgetedRoutes) {
    if (!measuredRoutes.has(route)) {
      violations.push(`${route}: stale route budget (route not in build)`);
    }
  }

  for (const [route, actual] of Object.entries(measurement.routes)) {
    const budget = budgets.routes?.[route];
    if (!budget) continue;
    passed += compareMetric(
      violations,
      route,
      'first-load gzip',
      actual.firstLoadGzipBytes,
      budget.firstLoadGzipBytes
    );
    passed += compareMetric(
      violations,
      route,
      'first-load raw',
      actual.firstLoadRawBytes,
      budget.firstLoadRawBytes
    );
    passed += compareMetric(
      violations,
      route,
      'route-specific gzip',
      actual.routeSpecificGzipBytes,
      budget.routeSpecificGzipBytes
    );
    passed += compareMetric(
      violations,
      route,
      'route-specific raw',
      actual.routeSpecificRawBytes,
      budget.routeSpecificRawBytes
    );
  }

  passed += compareMetric(
    violations,
    'total client JS emitted',
    'gzip',
    measurement.totalClientJs.gzipBytes,
    budgets.totalClientJs?.gzipBytes
  );
  passed += compareMetric(
    violations,
    'total client JS emitted',
    'raw',
    measurement.totalClientJs.rawBytes,
    budgets.totalClientJs?.rawBytes
  );

  return { passed, violations };
};

let budgetConfig = null;
let budgetResult = null;
if (checkBudgets) {
  if (!existsSync(budgetsPath)) {
    console.error(`Bundle budget file not found: ${budgetsPath}`);
    process.exit(1);
  }
  budgetConfig = JSON.parse(readFileSync(budgetsPath, 'utf8'));
  budgetResult = evaluateBudgets(budgetConfig);
}

const reportLines = [
  '| Route | First-load JS (gzip) | First-load JS (raw) | of which route-specific (gzip) |',
  '| --- | ---: | ---: | ---: |',
  `| _shared (all routes)_ | ${kb(shared.gzip)} | ${kb(shared.raw)} | — |`,
  ...rows.map(
    (row) =>
      `| ${row.route} | ${kb(row.total.gzip)} | ${kb(row.total.raw)} | ${kb(row.own.gzip)} |`
  ),
  '',
  `${rows.length} page routes. Total client JS emitted (all chunks, incl. lazy): ${kb(totalGzip)} gzip / ${kb(totalRaw)} raw.`,
];

if (budgetResult) {
  reportLines.push('');
  if (budgetResult.violations.length === 0) {
    reportLines.push(
      `Bundle budgets: PASS — ${budgetResult.passed} metrics within budget (headroom ${budgetConfig.headroomPercent}% over the recorded baseline).`
    );
  } else {
    reportLines.push(
      `Bundle budgets: FAIL — ${budgetResult.violations.length} violation(s); ${budgetResult.passed} metrics within budget.`
    );
    reportLines.push(...budgetResult.violations.map((v) => `- ${v}`));
  }
}

const report = reportLines.join('\n');
if (printJson) {
  console.log(
    JSON.stringify({ measurement, budgetResult }, null, 2)
  );
} else {
  console.log(report);
}
if (reportOut) {
  writeFileSync(path.resolve(process.cwd(), reportOut), `${report}\n`);
}
if (budgetResult?.violations.length) {
  console.error('\nBundle budget violations:');
  for (const violation of budgetResult.violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}
