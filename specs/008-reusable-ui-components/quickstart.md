# Quickstart & Verification Guide: Essential Reusable UI Components

**Feature**: Essential Reusable UI Components  
**Directory**: `specs/008-reusable-ui-components`  
**Date**: 2026-10-08  

---

## 1. Prerequisites

Ensure environment has Node.js and pnpm available:

```bash
export PATH="/home/agent/.local/nodejs/bin:$PATH"
pnpm --version
```

---

## 2. Interactive Verification in `apps/web`

Launch the Next.js web application:

```bash
export PATH="/home/agent/.local/nodejs/bin:$PATH"
pnpm turbo run dev --filter=@fbuploadpro/web
```

Navigate to `http://localhost:3000` to test:
1. **Interactive Form Benches**:
   - Verify `Button` states (Primary Gold, Secondary Slate, Ghost, Danger Rose, Loading spinner).
   - Test `Input` focus halos (`rgba(250, 215, 52, 0.35)`), password toggle, error states.
   - Toggle `Checkbox` and `Switch` states with keyboard `Space`.
   - Test `Select` dropdown options.
2. **Surfaces & Dialogs**:
   - Inspect `Card` 1px hairlines and background elevation.
   - Trigger `Modal` / `Dialog`: verify backdrop blur, focus trapping, and `Escape` key dismissal.
3. **Tabulation & Feedback**:
   - Switch `Tabs` using arrow keys.
   - Inspect `Table` row dividers and tabular monospace figures.
   - Verify `StatusDot` unboxed 6px luminous dots with micro-halos (operational, queued, critical, idle).
   - Inspect `Skeleton` shimmer animations with 0 CLS.
4. **Theme Inversion**:
   - Toggle between **Dark Mode** and **Light Mode** using the top-bar theme switch.
   - Verify all contrast ratios, background surfaces, and borders invert crisply without visual clipping.

---

## 3. Automated Test Suite Execution

Run unit, snapshot, and accessibility tests across the components:

```bash
export PATH="/home/agent/.local/nodejs/bin:$PATH"
pnpm turbo run test --filter=@fbuploadpro/web
```

### Expected Output:
```text
✓ tests/components/button.test.tsx (passed)
✓ tests/components/input.test.tsx (passed)
✓ tests/components/dialog.test.tsx (passed)
✓ tests/components/tabs.test.tsx (passed)
✓ tests/components/status-dot.test.tsx (passed)
✓ tests/components/accessibility.test.tsx (passed)

Test Files  6 passed (6)
Tests       24 passed (24)
```

---

## 4. Full Quality Gate Verification

```bash
export PATH="/home/agent/.local/nodejs/bin:$PATH"
pnpm turbo run build lint typecheck test
```
All packages must exit with status `0` and zero warnings.
