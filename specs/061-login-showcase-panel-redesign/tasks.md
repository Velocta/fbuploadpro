# Implementation Tasks: Spec 061 - Login Showcase Panel Redesign

## User Story 1 (P1): Verbatim Showcase Content & Hierarchy
- [x] **T001**: Create `apps/web/src/components/auth/login-showcase-panel.tsx` with BrandMark, bold title, and muted tagline.
- [x] **T002**: Implement unboxed eyebrow label `"CREATE · SCHEDULE · GROW"` with accent color and wide letter-spacing.
- [x] **T003**: Implement three-line headline with `"100% on the cloud."` styled in accent color.
- [x] **T004**: Implement subtext with ~420px max-width and secondary color.
- [x] **T005**: Implement three feature list rows separated by hairline dividers with accent line icons (Clock, 2x2 Grid, Padlock).
- [x] **T006**: Implement platform line (`"Facebook · Instagram · TikTok · YouTube · Threads · X"`) and footer row (`"Official platform logins · Encrypted end-to-end"` with zero external links).
- [x] **T007**: Export `LoginShowcasePanel` from `apps/web/src/components/auth/index.ts` if index exists.

## User Story 2 (P1): Left Sign-In Card Subtext Alignment
- [x] **T008**: Update description in `apps/web/src/app/login/page.tsx` to `"Welcome back! Sign in to keep your content flowing across every platform."`.
- [x] **T009**: Wire `LoginShowcasePanel` into `AuthSplitLayout` on `apps/web/src/app/login/page.tsx`.

## User Story 3 (P2): Responsive Stacking & Mobile Experience
- [x] **T010**: Support `showcase?: React.ReactNode` prop in `apps/web/src/components/auth/auth-split-layout.tsx`.
- [x] **T011**: Update responsive CSS in `AuthSplitLayout` to stack showcase panel above the sign-in form on narrow screens (<1024px) with reduced padding.

## Verification & Documentation Synchronization
- [x] **T012**: Write automated UI tests in `apps/web/tests/ui/login-showcase-panel.test.tsx` verifying all verbatim strings, icons, and layout structure.
- [x] **T013**: Update `apps/web/tests/components/auth-pages.test.tsx` for the new `LoginPage` description copy.
- [x] **T014**: Update `docs/foundational-knowledge.md` to document the multi-platform showcase panel and login card copy alignment.
