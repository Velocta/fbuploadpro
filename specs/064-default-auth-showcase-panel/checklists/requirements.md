# Requirements Quality Checklist: Spec 064 - Default Auth Showcase Panel Standardization

## 1. Code Cleanup & Elimination
- [ ] `VALUE_PILLARS` removed from `auth-split-layout.tsx`
- [ ] `ShieldCheckIcon` removed from `auth-split-layout.tsx`
- [ ] `CloudIcon` removed from `auth-split-layout.tsx`
- [ ] `CommentIcon` removed from `auth-split-layout.tsx`
- [ ] `LockIcon` removed from `auth-split-layout.tsx`
- [ ] Legacy headline and pill box removed from `auth-split-layout.tsx`

## 2. Canonical Default Showcase
- [ ] `AuthShowcasePanel` exported from `login-showcase-panel.tsx`
- [ ] `AuthSplitLayout` defaults to `<AuthShowcasePanel />` when `showcase` prop is undefined
- [ ] `/signup`, `/forgot-password`, `/reset-password` render new showcase panel without props

## 3. Test Coverage & Verification
- [ ] `auth-components.test.tsx` updated to assert new showcase strings
- [ ] `auth-components.test.tsx` verifies new default showcase on `AuthSplitLayout`
- [ ] `SignupPage` tested to verify it renders the new showcase panel
