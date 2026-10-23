import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

// Bundle visibility (spec 137 §3.6.2): the analyzer runs on a webpack
// build (`ANALYZE=true npx next build --webpack`) and emits its report
// under .next/analyze/; the CI bundle-report job uploads that report as
// an artifact on apps/web PRs. Budgets are report-only (decision
// D137-3) — the measured baseline lives in PR-A4; enforced numbers are
// proposed from it later. Production builds stay on Turbopack.
const analyzeBuild = process.env.ANALYZE === 'true';
const withBundleAnalyzer = bundleAnalyzer({
  enabled: analyzeBuild,
});

// Baseline security headers. Content-Security-Policy is issued per-request
// by middleware (src/lib/csp.ts, still Report-Only in Phase 1 of spec 114)
// because it carries a per-request nonce, so it is not set here.
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Analyzer builds only: webpack builds run Next's route-export type
  // validator, which rejects the test-exported route handlers that
  // exist across the API surface (pre-existing state; the Turbopack
  // production build and `tsc --noEmit` do not run that validator).
  // The measurement build exists to weigh bundles, not to re-litigate
  // types — type safety stays enforced by the typecheck gate and the
  // production build. Never set outside ANALYZE=true.
  typescript: {
    ignoreBuildErrors: analyzeBuild,
  },
  // Image optimisation hosts (spec 137 §3.5 / PR-A4). Every entry is a
  // host the app actually displays images from, derived from a grep of
  // the codebase at build time — no wildcard-everything pattern:
  //   media.fbuploadpro.com        production R2 public media host
  //                                (.env.production.example, tests,
  //                                tests/helpers/mock-storage.ts)
  //   media.dev.fbuploadpro.com    development R2 public host
  //                                (apps/web/.env.example R2_PUBLIC_URL)
  //   **.fbcdn.net                 Facebook CDN — Graph picture/media
  //                                URLs (packages/contracts downloader
  //                                domain list; profile_picture_url
  //                                values originate from Graph)
  //   platform-lookaside.fbsbx.com Facebook Graph profile pictures
  //                                (verbatim in API test fixtures)
  //   graph.facebook.com           Graph picture host
  // YouTube thumbnails (i.ytimg.com) are NOT listed: no surface displays
  // them today (grep: zero hits) — spec §3.5 includes the class only if
  // a surface uses it.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.fbuploadpro.com' },
      { protocol: 'https', hostname: 'media.dev.fbuploadpro.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: 'platform-lookaside.fbsbx.com' },
      { protocol: 'https', hostname: 'graph.facebook.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
