# Requirements & Quality Checklist: Spec 040 Eradicate Mocks & Production Hardening

## 1. Pure PostgREST Route Execution
- [ ] All tenant route handlers in `apps/web/src/app/api/tenant/[subdomain]/` query Supabase via `@supabase/supabase-js`.
- [ ] Zero files in `apps/web` call `db.query(...)` or `db.queryOne(...)`.
- [ ] `apps/web/src/lib/db.ts` is deleted from the codebase.
- [ ] Route handlers accept optional typed `supabaseClient?: SupabaseClient<Database>` for test mocking.

## 2. Fail-Fast Cloudflare R2 Storage
- [ ] `getStorageService()` throws an explicit error if R2 environment variables are missing when `NODE_ENV === 'production'`.
- [ ] `MockStorageProvider` is never returned in production runtime.

## 3. Serverless-Safe Supabase Auth & Native OTP
- [ ] `localPasswordStore`, `localUserStore`, and `localResetTokenStore` are removed from `apps/web/src/lib/supabase-auth.ts`.
- [ ] Auth operations execute natively against Supabase Auth (`supabase.auth.*`) and PostgreSQL `users` table.
- [ ] No in-memory `Map` stores are used for user credentials or OTPs in production.

## 4. Strict Session Secret Enforcement
- [ ] `getSessionSecret()` throws if `SESSION_SECRET` is missing in production (`NODE_ENV === 'production'`).
- [ ] Zero routes or middleware use inline fallback secrets.

## 5. Distributed Rate Limiting in Production
- [ ] In production, rate limiting verifies `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` and throws if missing.
- [ ] In-memory rate limiting is restricted exclusively to development and test environments.

## 6. Monorepo Quality Gate
- [ ] `pnpm turbo run build lint typecheck test` passes 100% with 0 errors.
- [ ] `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` passes with 0 errors.
