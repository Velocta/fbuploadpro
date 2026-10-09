# Research: Essential Reusable UI Components

**Feature**: Essential Reusable UI Components  
**Directory**: `specs/008-reusable-ui-components`  
**Date**: 2026-10-08  

---

## 1. Technical Context & Key Decisions

### Decision 1: React 19 Native Primitives vs. External Component Library (Radix / Headless UI)

* **Decision**: Implement native, dependency-free React 19 functional components with WAI-ARIA compliance.
* **Rationale**:
  - `apps/web` currently runs React 19 and Next.js 16 without external headless UI wrappers.
  - Adding third-party UI libraries risks dependency mismatches with React 19 peer dependencies and bloats the client bundle.
  - Native HTML5 elements (`<button>`, `<input>`, `<textarea>`, `<table>`, `<dialog>`) with standard keyboard accessibility (`Escape`, `ArrowLeft`/`ArrowRight`, `Tab`, `Space`/`Enter`) and ARIA attributes provide 100% control over the DOM, styling tokens, and zero CLS.
* **Alternatives Considered**:
  - *Radix UI*: Robust accessibility, but many primitives have experimental or lagging React 19 support, increasing bundle size and install footprint.
  - *Tailwind UI / shadcn/ui copy-paste*: Typically relies on ad-hoc Tailwind classes and Radix primitives, conflicting with the strictly enforced `theme.ts` token governance in Constitution v2.1.0.

---

### Decision 2: Theme Token & Styling Architecture

* **Decision**: Dual-layer architecture:
  1. Semantic CSS custom properties defined in `apps/web/src/app/globals.css` (e.g., `var(--bg-panel)`, `var(--border-subtle)`, `var(--primary)`, `var(--ring-focus)`).
  2. Typed component presets and tokens in `apps/web/src/lib/theme.ts` (`COMPONENT_STYLES`, `THEME`, `PALETTE`, `STATUS_SIGNALS`).
* **Rationale**:
  - Constitution v2.1.0 Section 8 explicitly ratifies `apps/web/src/lib/theme.ts` as the single centralized authority for all frontend styling.
  - Permanent ban on hardcoded ad-hoc hex colors, arbitrary borders, or capsule pill badges.
  - CSS variables enable instantaneous theme switching (Dark $\leftrightarrow$ Light mode) without re-rendering component trees or causing hydration mismatches.
* **Alternatives Considered**:
  - *Pure CSS-in-JS (styled-components / emotion)*: Incompatible with Next.js 16 Server Components and React 19 streaming.
  - *Raw Utility Classes only*: Prone to style drift and accidental ad-hoc hex injections.

---

### Decision 3: WCAG AAA Contrast & Binance Brand Palette Enforcement

* **Decision**: Pair brand Gold (`#fad734`) with bold Pitch Black (`#000000`) typography for primary interactive elements, achieving a **14.86:1 contrast ratio** (far surpassing WCAG AAA requirement of 7.0:1).
* **Rationale**:
  - `DESIGN.md` mandates Binance Precision: Pure White text on Pitch Black delivers 21.0:1 contrast ratio, while Gold buttons with black text deliver 14.86:1.
  - Secondary elements use 1px hairline borders (`#1f242d` in dark mode, `#eaecef` in light mode).
* **Alternatives Considered**:
  - *White text on Gold button*: Yields a poor ~1.4:1 contrast ratio, which fails basic accessibility. Discarded.

---

### Decision 4: Unboxed Status Signaling vs. Traditional Badges

* **Decision**: Status signaling must strictly use unboxed 6px luminous dots with micro-halos (`operational`, `queued`, `critical`, `idle`) per `STATUS_SIGNALS` in `apps/web/src/lib/theme.ts`. Metadata tags use crisp 4px rectilinear borders.
* **Rationale**:
  - `DESIGN.md` Section 7.3 and Constitution Principle V permanently abolish capsule pill bubbles and rounded badge tags.
* **Alternatives Considered**:
  - *Rounded-full capsule pill badges*: Explicitly prohibited by constitution and design guidelines.

---

### Decision 5: Component Verification & Zero Mock Leakage

* **Decision**: Keep `apps/web` 100% production-pure. Mock data and placeholder components must never contaminate production component libraries.
* **Rationale**:
  - Codebase governance mandates zero mock code contaminating production packages.
  - Test suites provide isolated verification harnesses for viewports, dark/light themes, and edge cases.
