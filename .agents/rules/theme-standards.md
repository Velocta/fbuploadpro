# Theme Standards & Design System Enforcement

**Canonical Authority**: [`apps/web/src/lib/theme.ts`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/verify_speckit_access/apps/web/src/lib/theme.ts) & [`apps/web/src/app/globals.css`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/verify_speckit_access/apps/web/src/app/globals.css)  
**System Specification**: [`DESIGN.md`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/verify_speckit_access/DESIGN.md)

---

## 0. Absolute Immutability of `DESIGN.md` (Never Modify `DESIGN.md`)

> **CRITICAL DIRECTIVE**: AI agents and automated tools MUST NEVER edit, rewrite, reformat, overwrite, or truncate [`DESIGN.md`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/verify_speckit_access/DESIGN.md). `DESIGN.md` is permanently frozen as the repository's immutable design system specification. All frontend code, theme configurations, and components MUST strictly conform to `DESIGN.md` via `apps/web/src/lib/theme.ts` and `apps/web/src/app/globals.css`. Only the human project lead may directly edit `DESIGN.md`.

---

## 1. The Cardinal Rule: Never Declare, Always Reference

AI agents and software engineers operating in this workspace MUST follow this non-negotiable directive:

> **ALL visual tokens, colors, borders, typography metrics, spacing units, corner radii, elevation shadows, and status signals MUST be imported and referenced directly from `apps/web/src/lib/theme.ts` (or consumed via CSS variables from `globals.css`). NEVER declare, invent, or hardcode ad-hoc styling literals in component files.**

---

## 2. Forbidden Anti-Patterns vs. Mandated Patterns

### A. Color Declarations
* ❌ **FORBIDDEN**: Hardcoding hex codes, RGB, or HSL strings in inline styles, CSS, or Tailwind classes:
  ```tsx
  // VIOLATION: Ad-hoc hardcoded colors
  <div style={{ backgroundColor: '#000000', color: '#ffffff', borderColor: '#1f242d' }}>
  <button style={{ backgroundColor: '#fad734', color: '#000000' }}>Submit</button>
  <span style={{ color: '#2ebd85' }}>Active</span>
  ```
* ✅ **MANDATED**: Importing from `PALETTE`, `THEME`, or `COMPONENT_STYLES`:
  ```tsx
  // COMPLIANT: Referencing canonical tokens
  import { PALETTE, THEME, COMPONENT_STYLES } from '@/lib/theme';

  <div style={{ backgroundColor: THEME.default.surfaces.canvas, color: THEME.default.text.primary, borderColor: THEME.default.borders.hairline }}>
  <button style={COMPONENT_STYLES.primaryButton}>Submit</button>
  <span style={{ color: PALETTE.accent4 }}>Active</span>
  ```
  Or using CSS custom properties:
  ```tsx
  <div style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-main)', borderColor: 'var(--border-subtle)' }}>
  ```

---

### B. Status Indicators & Badges (Permanent Ban on Capsule Pills)
* ❌ **FORBIDDEN**: Wrapping status text or tags inside rounded capsule pill bubbles:
  ```tsx
  // VIOLATION: Capsule pill badge bubble
  <span style={{ backgroundColor: '#e6f4ea', color: '#137333', borderRadius: '9999px', padding: '2px 8px' }}>
    Active
  </span>
  ```
* ✅ **MANDATED**: Unboxed 6px luminous micro-dots with ambient halos from `STATUS_SIGNALS` or `COMPONENT_STYLES.statusDot`:
  ```tsx
  // COMPLIANT: Unboxed luminous signal
  import { STATUS_SIGNALS, COMPONENT_STYLES, THEME } from '@/lib/theme';

  <div style={{ display: 'flex', alignItems: 'center', gap: THEME.default.spacing.sm }}>
    <span style={COMPONENT_STYLES.statusDot('operational')} />
    <span style={{ color: THEME.default.text.primary, fontWeight: 600, fontSize: '0.875rem' }}>
      {STATUS_SIGNALS.operational.label}
    </span>
  </div>
  ```

---

### C. Borders & Hairlines
* ❌ **FORBIDDEN**: Arbitrary border widths, random gray borders, or thick outlines:
  ```tsx
  // VIOLATION: Arbitrary borders
  <div style={{ border: '1px solid #ccc' }}>
  <div style={{ border: '2px solid #333' }}>
  ```
* ✅ **MANDATED**: Explicit 1px hairline borders referencing the neutral token:
  ```tsx
  // COMPLIANT: 1px hairline definition
  <div style={{ border: `1px solid ${THEME.default.borders.hairline}` }}>
  // or
  <div style={{ border: '1px solid var(--border-subtle)' }}>
  ```

---

### D. Corner Radii & Spacing
* ❌ **FORBIDDEN**: Random pixel values (`borderRadius: '5px'`, `padding: '13px'`).
* ✅ **MANDATED**: Referencing `RADII` and `SPACING`:
  ```tsx
  import { RADII, SPACING } from '@/lib/theme';

  // Controls (4px), Buttons/Inputs (6px), Cards/Dialogs (8px)
  <div style={{ borderRadius: RADII.md, padding: SPACING.lg }}>
  ```

---

### E. Primary Action Buttons
* ❌ **FORBIDDEN**: Multiple solid yellow/gold buttons on the same view, or yellow buttons with low-contrast white text.
* ✅ **MANDATED**: Exactly ONE primary button per screen or major action surface, pairing Gold (`#fad734`) with bold Pitch Black (`#000000`) text for 14.86:1 WCAG AAA contrast, using `COMPONENT_STYLES.primaryButton`.

---

## 3. Quick Reference: Token Hierarchy in `apps/web/src/lib/theme.ts`

| Token Group | Export Name | Sample Keys | Usage |
| :--- | :--- | :--- | :--- |
| **Primitives** | `PALETTE` | `primary`, `accent1`, `accent2`, `accent3`, `accent4`, `background`, `text`, `neutral` | Raw 8-color palette anchors |
| **Theme Modes** | `THEME.dark`, `THEME.light`, `THEME.default` | `surfaces.*`, `borders.*`, `text.*`, `shadows.*` | Active theme surface & text mapping |
| **Spacing** | `SPACING` | `xs` (4px), `sm` (8px), `md` (12px), `lg` (16px), `xl` (24px), `xxl` (32px), `xxxl` (48px) | Padding, margin, gap |
| **Radii** | `RADII` | `xs` (4px), `sm` (6px), `md` (8px), `full` (9999px) | Corner curvature |
| **Typography** | `TYPOGRAPHY` | `fontFamily`, `tabularNums`, `tracking.*`, `weights.*` | Fonts, letter-spacing, numbers |
| **Status** | `STATUS_SIGNALS` | `operational`, `queued`, `critical`, `idle` | 6px luminous signals & labels |
| **Component Presets** | `COMPONENT_STYLES` | `primaryButton`, `secondaryButton()`, `input()`, `card()`, `statusDot()` | Reusable component style objects |

---

## 4. Verification & Linting Gate

Any pull request or code review that introduces hardcoded color literals (e.g., regex `#[0-9a-fA-F]{3,8}`) in component JSX/TSX files outside `theme.ts` violates repository quality standards and will be blocked.
