import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  // Native addons — must not be bundled by Turbopack/webpack
  serverExternalPackages: [
    '@napi-rs/canvas',
    '@napi-rs/canvas-linux-x64-gnu',
    'sharp',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
