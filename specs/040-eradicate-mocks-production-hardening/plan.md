# Implementation Plan: Spec 040 - Eradicate Mocks & Production Hardening

## Architecture & Design

### 1. Pure PostgREST Route Handlers Pattern
Replace all remaining `db.query(...)` SQL calls across tenant route handlers with native `@supabase/supabase-js` PostgREST queries.

Each route handler signature is updated to accept an optional `supabaseClient?: SupabaseClient<Database>` for test isolation:
```ts
export async function handleListAccounts(
  request: NextRequest,
  subdomain: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();
  // ... session verification ...
  
  const supabase = supabaseClient ?? getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('facebook_accounts')
    .select('id, fb_account_id, display_name, profile_picture_url, gender, account_link, status, token_expires_at, created_at, updated_at, facebook_pages(id, page_name, profile_picture_url)')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to retrieve accounts' }, { status: 500 });
  }
  // ... map response ...
}
```

Once all route handlers are migrated, `apps/web/src/lib/db.ts` is permanently deleted.

---

### 2. Fail-Fast Storage Service (`apps/web/src/lib/storage.ts`)
Prevent silent fallbacks to `mock-r2.fbuploadpro.com`:
```ts
export function getStorageService(): IStorageService {
  const config = getR2Config();
  if (config) {
    return new R2StorageProvider(config);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cloudflare R2 storage credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are required in production');
  }
  return getMockStorageProvider();
}
```

---

### 3. Serverless-Safe Supabase Auth & Native OTP
- Remove `localPasswordStore`, `localUserStore`, and `localResetTokenStore` from `apps/web/src/lib/supabase-auth.ts`.
- In `findUserByEmail`, execute strictly via `supabase.from('users').select(...)`.
- For OTP generation and verification, execute strictly via `supabase.auth.signInWithOtp` / `supabase.auth.verifyOtp`.
- Update test suites to mock Supabase Auth client methods directly rather than relying on in-memory Node `Map` stores.

---

### 4. Strict Session Secret Helper (`getSessionSecret`)
Consolidate session secret resolution into a single validated utility function:
```ts
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production');
    }
    return 'super-secret-session-signing-key-minimum-32-chars-long';
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long');
  }
  return secret;
}
```
All routes and middleware will import `getSessionSecret()` instead of inline fallbacks.

---

### 5. Distributed Upstash Redis Rate Limiting
- Add Upstash Redis REST support in `apps/web/src/lib/rate-limiter.ts`.
- In production (`NODE_ENV === 'production'`), verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. If missing in production, throw an explicit error.
- In test and local development, in-memory sliding window is preserved.
