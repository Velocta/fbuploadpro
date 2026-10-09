# Quality Checklist: Password Reset & Recovery Flow

## 1. UX & Visual Presentation
- [x] "Forgot password?" link appears directly above the password field on `/login`.
- [x] `/forgot-password` renders in `AuthSplitLayout` with email input and "Send Recovery Link" button.
- [x] Confirmation state is displayed on `/forgot-password` once email is submitted.
- [x] `/reset-password` renders in `AuthSplitLayout` with "New Password" and "Confirm New Password" fields.
- [x] Show/hide password eye toggles work on `/reset-password`.
- [x] All pages collapse into a single column on mobile (<1024px).

## 2. Professional UX Writing & Security
- [x] All copy is purposeful, concise, conversational, and clear.
- [x] No technical plumbing jargon exposed to the user.
- [x] Password match validation operates client-side before dispatch.
- [x] Minimum 8-character password constraint is enforced.
- [x] No decorative or fake status dots on the recovery views.

## 3. Verification & Quality Gates
- [x] Unit tests for `/forgot-password` and `/reset-password` views pass.
- [x] `pnpm turbo run build lint typecheck test` passes with zero errors.
