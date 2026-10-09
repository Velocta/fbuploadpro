# Requirements Checklist: Spec 023 — Supabase Auth Native SMTP OTP Delivery

- [ ] `resend` dependency completely uninstalled from `apps/web/package.json`.
- [ ] `apps/web/src/lib/email-service.ts` deleted.
- [ ] `apps/web/src/app/api/auth/signup/route.ts` dispatches confirmation via `supabase.auth.signUp`.
- [ ] Profile created in `users` table with status `pending_verification` on initial signup.
- [ ] `apps/web/src/app/api/auth/signup/verify-otp/route.ts` verifies token via `supabase.auth.verifyOtp` and activates status to `active`.
- [ ] `apps/web/src/app/api/auth/signup/resend-otp/route.ts` triggers fresh code via `supabase.auth.resend`.
- [ ] `apps/web/src/app/api/auth/forgot-password/route.ts` dispatches recovery token via `supabase.auth.resetPasswordForEmail`.
- [ ] `apps/web/src/app/api/auth/reset-password/route.ts` validates recovery token via `supabase.auth.verifyOtp` and sets new password.
- [ ] Local & CI fallbacks simulate OTP dispatch when Supabase client is not available so tests pass 100%.
- [ ] `DESIGN.md` remains untouched.
- [ ] Roadmap in `docs/foundational-knowledge.md` updated in the SAME PR.
