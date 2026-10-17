# Tasks: High-Contrast Browser Tab Icon & Cache Busting

**Branch**: `fix/066-high-contrast-tab-icon` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: High-Contrast Asset Implementation
- [x] T001 [US1] Embed brand dark squircle container (`#0c0d10` fill with `#2b323c` hairline border, `rx=14`) into `apps/web/src/app/icon.svg` and `apps/web/public/icon.svg`
- [x] T002 [US1] Regenerate multi-resolution `favicon.ico` (16x16, 32x32, 48x48) with embedded dark squircle container in `apps/web/src/app/favicon.ico` and `apps/web/public/favicon.ico`

## Phase 2: Metadata Cache Busting Configuration
- [x] T003 [US2] Update `apps/web/src/app/layout.tsx` metadata with cache-busted versioned URLs (`/icon.svg?v=2` and `/favicon.ico?v=2`)
- [x] T004 [US2] Clean up redundant icon link definitions to avoid browser tag collisions

## Phase 3: Documentation & Knowledge Synchronization
- [x] T005 Synchronize `docs/foundational-knowledge.md` with Spec 066 high-contrast tab icon delivery standards

