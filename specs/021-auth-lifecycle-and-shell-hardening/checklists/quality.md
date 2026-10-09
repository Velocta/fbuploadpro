# Quality & Acceptance Checklist: Spec 021

## 1. Authentication Lifecycle & OTP
- [ ] Unverified pending sign-up login detection (`findPendingSignup` & `verifyPendingSignupPassword`).
- [ ] Fresh OTP dispatch on unverified login with router forwarding to OTP step.
- [ ] Unverified login with incorrect password returns standard `Invalid email or password`.
- [ ] "Wrong email? Edit details" button restores Step 1 with form fields preserved.
- [ ] Resuming `/signup?step=otp&email=...` persists state across browser reloads.
- [ ] Expired OTP error offers 1-click "Send fresh code" trigger.
- [ ] Duplicate email registration (409 Conflict) renders direct links to "Sign in instead" and "Reset password".

## 2. Sign-Out & Cross-Tab Resilience
- [ ] Proactive client-side session cookie wiping on Sign Out (`Max-Age=0`).
- [ ] Cross-tab logout broadcast via `BroadcastChannel('fbup_auth')` and `localStorage` storage events.
- [ ] Canonical central gateway target: `https://app.${rootDomain}/login?logout=success`.
- [ ] Middleware permits `/login?logout=success` without auto-forwarding active sessions.
- [ ] Back-Forward Cache (bfcache) mitigation via `Cache-Control: no-store` and `pageshow` listener.

## 3. Workspace Shell & UX Hardening
- [ ] Theme selection saved in `localStorage` and `fbup_theme` cookie.
- [ ] Mobile drawer auto-closes when navigation link is clicked (`setOpenMobile(false)`).
- [ ] Mobile layout reserves left gutter/padding (`pl-14` / 56px) to avoid floating trigger overlap.
- [ ] User popover menu has viewport collision safety.
- [ ] Caps Lock indicator badge appears when Caps Lock is active on password inputs.
- [ ] Uniform rate-limit error copy across existing and non-existent accounts.
- [ ] Client-side API fetch transitions to `/account-suspended` on 403 `ACCOUNT_SUSPENDED`.

## 4. Quality Gates
- [ ] 100% tests passing (`pnpm turbo run test`).
- [ ] 0 linter warnings or errors (`pnpm turbo run lint`).
- [ ] 0 TypeScript typecheck errors (`pnpm turbo run typecheck`).
- [ ] 0 build errors (`pnpm turbo run build`).
