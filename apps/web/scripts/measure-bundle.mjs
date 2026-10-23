/**
 * Per-route first-load JS baseline (spec 137 §3.6.2 / PR-A4).
 *
 * Usage (from apps/web, after a production build):
 *   ANALYZE=true npx next build --webpack   # or a plain production build
 *   node scripts/measure-bundle.mjs
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
 * first load, consistent across builds, which is what a report-only
 * baseline (decision D137-3) needs. Budgets are NOT enforced here.
 */
import console from 'node:console';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

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

console.log('| Route | First-load JS (gzip) | First-load JS (raw) | of which route-specific (gzip) |');
console.log('| --- | ---: | ---: | ---: |');
console.log(
  `| _shared (all routes)_ | ${kb(shared.gzip)} | ${kb(shared.raw)} | — |`
);
for (const row of rows) {
  console.log(
    `| ${row.route} | ${kb(row.total.gzip)} | ${kb(row.total.raw)} | ${kb(row.own.gzip)} |`
  );
}
console.log(
  `\n${rows.length} page routes. Total client JS emitted (all chunks, incl. lazy): ${kb(totalGzip)} gzip / ${kb(totalRaw)} raw.`
);
