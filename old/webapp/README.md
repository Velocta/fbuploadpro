# Webapp

Next.js App Router frontend for agency and super-admin workflows, structured for API-heavy growth and Vercel-first deployment. Posting, analytics, and scraper workers live in [`../backend_v3/`](../backend_v3/README.md).

## Getting Started

1. Copy env file and fill required values:

```bash
cp .env.example .env.local
```

2. Install dependencies and run dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- `npm run dev`: start local dev server.
- `npm run build`: build for production.
- `npm run start`: run production build.
- `npm run lint`: run ESLint.
- `npm run typecheck`: run TypeScript check.
- `npm run test`: placeholder test command (upgrade as test suites are added).

## Key Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAGIC_LINK_SIGNING_SECRET`
- `NEXT_PUBLIC_MAIN_DOMAIN`
- `NEXT_PUBLIC_COOKIE_DOMAIN`

## Notes

- Main-domain and subdomain routing behavior is enforced in `src/proxy.ts`.
- Supabase session synchronization and role gates are handled in `src/lib/supabase/middleware.ts`.
- Versioned APIs live under `src/app/api/v1`.
- Business logic is being centralized under `src/server/services` and `src/server/repositories`.
- Reusable feature slices live under `src/features`.

## API-First Structure

- `src/app`: routes, layouts, and page composition only.
- `src/app/api/v1`: HTTP endpoints for UI and future clients.
- `src/server/services`: application use-cases and orchestration.
- `src/server/repositories`: Supabase data access.
- `src/server/integrations`: external API clients (e.g., Facebook Graph).
- `src/contracts`: API request/response schemas.

## Vercel Deployment Notes

- Use Node.js runtime for Supabase-heavy and external-integration endpoints.
- Keep environment variables aligned with `.env.example`.
- Validate required env vars in production (`src/lib/config/env.ts`).
- Use preview deployments as merge gates for auth/dashboard smoke tests.

## Documentation

- [`../documentation/webapp/`](../documentation/webapp/README.md) — architecture, API, performance, onboarding
- [`../documentation/webapp/ui-ux-reference.md`](../documentation/webapp/ui-ux-reference.md) — Green Mist UI/UX system (canonical design reference)
