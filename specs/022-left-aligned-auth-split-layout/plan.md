# Architectural Plan: Spec 022 — Left-Aligned Authentication Split Layout Architecture

**Status**: Ready  
**Branch**: `feat/spec-022-left-aligned-auth-layout`  
**Constitution Reference**: FBUploadPro Constitution v2.11.0 (Principle 16)  

---

## 1. Technical Architecture & Component Changes

### Component: `AuthSplitLayout` (`apps/web/src/components/auth/auth-split-layout.tsx`)
- Introduce `formPosition?: 'left' | 'right'` to `AuthSplitLayoutProps` with `'left'` as the default.
- Layout rendering order:
  - When `formPosition === 'left'` (default):
    1. `<main className="auth-form-panel">`
    2. `<section className="auth-showcase-panel auth-showcase-right" aria-label="FBUploadPro Showcase">`
  - When `formPosition === 'right'`:
    1. `<section className="auth-showcase-panel" aria-label="FBUploadPro Showcase">`
    2. `<main className="auth-form-panel">`
- CSS rules:
  - Add `.auth-showcase-panel.auth-showcase-right`:
    - `border-right: none`
    - `border-left: 1px solid var(--border-subtle, #1f242d)`
    - `background: radial-gradient(circle at 82% 22%, rgba(250, 215, 52, 0.08) 0%, transparent 60%), #000000`
  - Ensure `.auth-split-wrapper` maintains `display: flex`, `min-height: 100vh`, `width: 100%`.
  - Maintain `@media (max-width: 1023px)` styles:
    - `.auth-showcase-panel { display: none !important; }`
    - `.auth-form-panel { flex: 1 1 100% !important; max-width: 100% !important; padding: 32px 16px !important; }`
    - `.auth-mobile-header { display: flex !important; }`

---

## 2. Page Integrations

All 4 authentication entry points will render with `formPosition="left"` (by virtue of default prop value):
1. `apps/web/src/app/login/page.tsx`
2. `apps/web/src/app/signup/page.tsx`
3. `apps/web/src/app/forgot-password/page.tsx`
4. `apps/web/src/app/reset-password/page.tsx`

---

## 3. Testing & Verification

- **Unit/Component Test**: Update `apps/web/tests/auth/auth-components.test.tsx` to verify:
  - `AuthSplitLayout` renders form panel first in the DOM by default.
  - Correct CSS classes and accessibility roles (`main` for form, `section` with `aria-label` for showcase).
  - Left-aligned vs right-aligned rendering order when `formPosition` prop is supplied.
- **Automated Quality Gate**: `pnpm turbo run build lint typecheck test` (100% green, 0 errors).
