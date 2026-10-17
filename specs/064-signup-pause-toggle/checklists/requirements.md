# Quality Checklist: Spec 064 Temporary Signup Pause Toggle

- [ ] **Guard Integrity**: Helper `isSignupEnabled` defaults to `true` when unset, and returns `false` for `'false'`, `'0'`, `'off'`, `'disabled'`.
- [ ] **UI Rendering**: When disabled, `/signup` displays the `<SignupPausedCard />` within `AuthSplitLayout` with zero flash of registration inputs.
- [ ] **In-Flight Preservation**: `/signup?step=otp` remains accessible so in-flight registrants can verify their code.
- [ ] **API Security**: `POST /api/auth/signup` rejects with HTTP 403 when signups are disabled, with zero database/auth calls.
- [ ] **UX Voice & Theme Tokens**: All text conforms to universal UX writing rules (purposeful, concise, clear) and imports colors from `@/lib/theme`.
- [ ] **CI & Vercel Sync**: Variable `NEXT_PUBLIC_SIGNUPS_ENABLED` registered in `sync-vercel-env.mjs` and documented in `docs/`.
