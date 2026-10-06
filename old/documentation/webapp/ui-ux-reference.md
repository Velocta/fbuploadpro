# Webapp Professional UI/UX Reference (Green Mist Edition)

**Canonical path:** `documentation/webapp/ui-ux-reference.md`

This is the master UI/UX system for `webapp`.
Use this as the source of truth for all future UI work.

**Scope:** These rules apply to **every** webapp surface unless a subsection explicitly narrows the audience: **public marketing** pages, **authentication** flows, **agency** and **super-admin** product UIs, and **shared** primitives (`src/components/ui`). **§8.1** documents a **single worked example** (the public home route): reuse its **patterns** on other **marketing** surfaces where appropriate; it does **not** relax **§1.2** or **§8** constraints on **dashboards**, dense tables, or long forms.

## 1) Scope and Intent

- This is a full replacement design direction.
- It is universal and not tied to any single page.
- It is optimized for:
  - enterprise trust,
  - dashboard readability,
  - conversion clarity,
  - consistent implementation in Next.js + shadcn.

## 1.1) AI implementation contract (mandatory)

When implementing UI from this document, treat **calm enterprise trust** and **modern visual craft** as compatible: polish comes from **disciplined motion, depth, and hierarchy**—not loud gradients, neon accents, or random decoration.

- **Marketing and landing pages (required):** For every new or redesigned section, implement **at least three** of the following. When `prefers-reduced-motion: reduce` is active, substitute with strong static hierarchy and instant or near-instant opacity only (no stagger loops, no ambient pulse on copy).
  - Entrance choreography: stagger, fade, and/or slide-in on headings, supporting media, or cards.
  - Clear **hover** and **visible focus** feedback on primary interactive elements (links, buttons, cards that navigate).
  - Subtle ambient motion on **decorative layers only** (e.g. soft emerald mist blobs, slow pulse)—never on continuous body text.
  - Scroll- or viewport-based reveal for below-the-fold blocks when it improves comprehension without hiding critical content.
- **Dashboard and authenticated app shells (required minimum):** Use restrained, purposeful motion: `animate-in` (or equivalent) on main content regions, skeleton loaders for async lists, dialog/sheet/tab transitions from Radix + shadcn patterns, and micro-feedback on buttons, rows, and tabs. Avoid infinite or high-contrast motion behind dense tables or forms.
- **Reduced motion (required):** Honor `prefers-reduced-motion: reduce` for all decorative animation; keep functional feedback (e.g. short opacity on dialog open) where it aids understanding.
- **Still forbidden:** “AI slop” look—pink/purple synthetic gradients and unrelated visual noise—not **motion or tasteful depth** in the Green Mist system.

## 1.2) Surface motion budgets (marketing vs product)

| Surface | Motion budget | Primary tools |
| --- | --- | --- |
| **Marketing / landing** | Higher: hero ambient layers, section entrance stagger, CTA feedback, optional subtle border or edge shimmer (emerald-tinted, low contrast only) | Tailwind `animate-in` / `tw-animate-css`, `@theme` keyframes in `src/app/globals.css`, **Framer Motion** for staggered children on client-mounted blocks |
| **Dashboard / data-heavy** | Lower: page or region fade-in, dialogs and sheets, row hover, loading spinners and skeletons; no distracting loops in reading areas | `animate-in`, Radix `data-[state=*]` enter/exit classes, **shadow and ring** changes on hover (prefer over `translate-y` on dense cards) |

## 2) Codebase-Informed Product Context

From current `webapp` code:

- Product type: multi-role SaaS (`agency`, `super-admin`, auth, public landing).
- Core surfaces:
  - landing,
  - agency dashboard (Facebook: accounts, auto-download-upload, bulk-delete, direct-post, direct-schedule, inapp-schedule; YouTube/Instagram shells; settings),
  - super-admin dashboard (agencies, pricing/tokens).
- Stack:
  - Next.js App Router,
  - Tailwind CSS v4 + CSS variables,
  - shadcn/ui + Radix,
  - Lucide icons.

## 3) Skill-Driven Direction (`ui-ux-pro-max`)

Workflow applied:

1. Required `--design-system` search.
2. Supporting domain searches (`color`, `style`, `ux`).
3. Stack guidance for `shadcn`.

Synthesis for this project:

- Keep trust-first enterprise posture.
- Use a Green Mist visual language:
  - calm mist surfaces,
  - slate structural neutrals,
  - emerald actions and status emphasis.
- Remove **flashy** multi-hue gradients and **AI-looking neon** styling; **subtle** emerald mist depth, soft blobs, and token-backed shadows are encouraged where §8 defines them.

## 4) Brand and Visual Principles

1. Professional and calm (not playful or loud).
2. Data-first readability over **random** decoration; **intentional** motion and depth are part of readability and perceived quality, not clutter.
3. One accent family: green.
4. Strict token consistency for color, spacing, radius, motion.
5. Accessibility is non-negotiable.

## 5) Complete Color System (Green Mist)

## 5.1 Core Accent Palette (Emerald)

- Primary 50: `#ECFDF5`
- Primary 100: `#D1FAE5`
- Primary 200: `#A7F3D0`
- Primary 300: `#6EE7B7`
- Primary 400: `#34D399`
- Primary 500: `#10B981`
- Primary 600: `#059669` (main primary)
- Primary 700: `#047857`
- Primary 800: `#065F46`
- Primary 900: `#064E3B`

## 5.2 Mist Surface Palette

- Mist 50: `#F4FBF8`
- Mist 100: `#E8F5EE`
- Mist 200: `#D3EBDD`
- Mist 300: `#BCDCCB`

## 5.3 Structural Slate Palette

- Slate 50: `#F8FAFC`
- Slate 100: `#F1F5F9`
- Slate 200: `#E2E8F0`
- Slate 300: `#CBD5E1`
- Slate 400: `#94A3B8`
- Slate 500: `#64748B`
- Slate 600: `#475569`
- Slate 700: `#334155`
- Slate 800: `#1E293B`
- Slate 900: `#0F172A`

## 5.4 Semantic Colors

- Success: `#16A34A`
- Warning: `#D97706`
- Error: `#DC2626`
- Info: `#0EA5E9`

## 5.5 Light Theme Role Tokens

- `background`: `#F4FBF8`
- `foreground`: `#10221A`
- `card`: `#FFFFFF`
- `card-foreground`: `#10221A`
- `popover`: `#FFFFFF`
- `popover-foreground`: `#10221A`
- `primary`: `#059669`
- `primary-foreground`: `#FFFFFF`
- `secondary`: `#ECFDF5`
- `secondary-foreground`: `#065F46`
- `muted`: `#E8F5EE`
- `muted-foreground`: `#3F5A4E`
- `accent`: `#D1FAE5`
- `accent-foreground`: `#065F46`
- `border`: `#D8E8DF`
- `input`: `#D8E8DF`
- `ring`: `#10B981`
- `destructive`: `#DC2626`
- `destructive-foreground`: `#FFFFFF`

## 5.6 Dark Theme Role Tokens

- `background`: `#020617`
- `foreground`: `#E6F6EE`
- `card`: `#0B1220`
- `card-foreground`: `#E6F6EE`
- `popover`: `#0B1220`
- `popover-foreground`: `#E6F6EE`
- `primary`: `#22C55E`
- `primary-foreground`: `#052E16`
- `secondary`: `#0F172A`
- `secondary-foreground`: `#86EFAC`
- `muted`: `#111827`
- `muted-foreground`: `#9CB7A9`
- `accent`: `#1F2937`
- `accent-foreground`: `#BBF7D0`
- `border`: `#1F2937`
- `input`: `#1F2937`
- `ring`: `#22C55E`
- `destructive`: `#F87171`
- `destructive-foreground`: `#0B1220`

## 5.7 Data Visualization Palette

- Chart 1: `#059669`
- Chart 2: `#10B981`
- Chart 3: `#22C55E`
- Chart 4: `#0EA5E9`
- Chart 5: `#84CC16`
- Chart 6: `#DC2626`

Rules:

- Use max 6 categorical colors per chart.
- Keep semantic consistency (green positive, red negative, amber warning).

## 6) Typography System

## 6.1 Families

- Heading/Display: `Plus Jakarta Sans`
- Body/UI: `Inter`
- Mono/Data: `JetBrains Mono`

Fallbacks:

- Sans: `Inter, Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif`
- Mono: `JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace`

## 6.2 Scale

- `display-xl`: 56/64, 700
- `display-lg`: 48/56, 700
- `display-md`: 40/48, 700
- `h1`: 36/44, 700
- `h2`: 30/38, 700
- `h3`: 24/32, 600
- `h4`: 20/28, 600
- `h5`: 18/26, 600
- `h6`: 16/24, 600
- `body-lg`: 18/28, 400
- `body-md`: 16/24, 400
- `body-sm`: 14/22, 400
- `caption`: 12/18, 500
- `label`: 13/18, 600

## 7) Layout, Grid, and Spacing

- 8px-based spacing scale: `4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96`
- Marketing container max width: `1280px`
- Dashboard container max width: `1440px`
- Gutters:
  - mobile: 16px
  - tablet: 24px
  - desktop: 32px
- Use 12-column mental grid for major layouts.

## 8) Radius, Borders, Shadow, Motion

Radius:

- `xs`: 6px
- `sm`: 8px
- `md`: 10px
- `lg`: 12px
- `xl`: 16px
- `pill`: 9999px

Borders:

- Standard: `1px solid var(--border)`

Shadow:

- `shadow-sm`: micro elevation
- `shadow-md`: cards/dialogs
- `shadow-lg`: modal-level emphasis only

Motion:

- fast: 150ms
- standard: 200ms
- emphasis: 300ms
- easing: `cubic-bezier(0.2, 0, 0, 1)`
- stagger (landing lists, feature grids, hero children): **40–80ms** delay between siblings; cap total stagger so the page does not feel sluggish (roughly **≤600ms** to settle for above-the-fold content).

### Safe hover and layout (required interpretation)

- **Do not** use hover effects that **change box size**, **reflow text**, or **shift layout** of surrounding content (no padding jumps, no font-weight changes that reflow, no appearing/disappearing chrome on hover-only unless focus-visible too).
- **Preferred (dashboard):** elevation via **shadow** and/or **ring** (`ring-primary/20`), border tint, or background token shift—no vertical translation on tightly stacked cards.
- **Allowed (marketing cards):** small **`translate-y`** (e.g. **-2px to -4px**) only if the card lives in a **loose vertical rhythm** with enough **margin** that neighbors do not collide, or use `transform` with a **fixed min-height** wrapper so the grid does not jump; otherwise use shadow-only lift.
- **Icons:** micro scale or translate on hover/focus, **≤1.02** scale, prefer `transform-gpu` and transition durations from the motion tokens above.
- **Respect** `prefers-reduced-motion: reduce` for all non-essential animation (see §1.1).

### Modern depth and motion (required)

**Definition:** *Stunning* in this system means **layered depth, crisp motion, and confident hierarchy** within Green Mist tokens—not rainbow gradients or novelty shapes.

**Implementation stack (this repo):**

- Prefer Tailwind **`animate-in`** / **`tw-animate-css`** (imported from `src/app/globals.css`) for enter/exit and simple reveals.
- Use **Framer Motion** for staggered children, layout-friendly list animations, or gesture-adjacent blocks where a client component already justifies it (e.g. interactive dashboards).
- Register **shared** custom keyframes in `src/app/globals.css` under `@theme inline` (or equivalent) when the same animation is reused in more than one place—avoid one-off magic numbers in JSX. **Marketing-atmosphere** keyframes used on the public home (e.g. `landing-sheen-sweep`, `landing-conic-rotate`; CSS class prefix `landing-*` is historical) live in **`@layer utilities`** next to existing mist/float keyframes; see **§8.1** for the class list and hero stack order when reusing or extending that pattern on **other marketing routes**.

**Depth (token-safe):**

- Layered backgrounds: **low-opacity** emerald mist blobs, soft radial highlights, or grid/noise **at ≤5–10% opacity**—**marketing heroes and section headers only**; keep dashboard tables and dense forms visually quiet behind solid or near-solid surfaces.
- **Very subtle** mesh or grain **only** on marketing heroes; never behind small text in data tables.

**What to ship by default:**

- **Marketing** routes (public home, future campaign or content pages, etc.): ambient decorative motion on **non-reading** layers + section entrance + interactive feedback on CTAs and primary cards (see §1.1).
- **Product** routes (agency dashboard, super-admin, authenticated workflows): route or tab content fade/slide, dialog and sheet transitions, skeletons, button loading and pressed states; **lower** ambient motion budget (§1.2).

### 8.1) Marketing surface patterns (worked example: public home)

This subsection documents **one concrete route** (`/`, assembled from `src/app/page.tsx` and `src/components/landing/*`) so future **marketing** pages can copy **structure and tokens** without re-deriving stacks from scratch. **It is not the only place depth and motion apply**—dashboards still follow §1.2 and the “quiet surface behind data” rules in **Depth (token-safe)** above.

**Source of truth for the CSS in this example:** `src/app/globals.css` (`@layer components` for atmosphere + card helpers, `@layer utilities` for shared `@keyframes`). **Product UI** should continue to rely primarily on role tokens, `Card` / `Table` / form primitives, and localized motion—not the full hero atmosphere stack.

#### Section surfaces (“paper” steps)

Use **token-backed** backgrounds so the page reads as layered, not one flat field. Current defaults:

| Region | Background tokens (Tailwind) | File |
| --- | --- | --- |
| Hero | `bg-background` | `src/components/landing/hero-section.tsx` |
| How it works | `bg-muted/40` · `dark:bg-muted/20` + `border-y border-border` | `src/components/landing/how-it-works.tsx` |
| Pricing | `bg-secondary/35` · `dark:bg-secondary/25` + `border-t border-border` | `src/components/landing/pricing-section.tsx` |
| Footer | `bg-muted/30` · `dark:bg-muted/15` | `src/components/landing/footer-section.tsx` |

**Page-level mist (no grid):** `src/app/page.tsx` renders `landing-page-mist` + `landing-page-mist-blob-a|b|c` as the **first child** of `<main className="relative flex-1">`. Keeps a soft mist visible through translucent section tints; do not duplicate a full-page grid here (per §8 depth guidance: avoid stacking busy grids page-wide and per-section at full strength).

#### Shared atmosphere CSS classes (do not paste one-off gradients in JSX)

| Class | Purpose |
| --- | --- |
| `landing-atmosphere-radials-hero` | Hero base radial + mist stack; includes slow **`landing-radials-hero-drift`** animation |
| `landing-atmosphere-radials-how` | How-it-works radial stack |
| `landing-atmosphere-radials-pricing` | Pricing radial stack |
| `landing-atmosphere-grid-hero` | Masked slate grid on hero (opacity in the **~5–10%** decorative band after mask) |
| `landing-atmosphere-grid-section` | Same grid pattern for non-hero marketing sections |
| `landing-hero-veil-a` · `landing-hero-veil-b` | Dual emerald “breathing” veils (hero only); `landing-veil-a` / `landing-veil-b` keyframes |
| `landing-hero-sheen` | Slow diagonal sheen; `landing-sheen-sweep` |
| `landing-hero-grain` | Hero-only SVG film grain (static texture; opacity tuned in reduced-motion media query) |
| `landing-hero-panel-edge-shimmer` | Optional edge light on the **automation snapshot** panel (`hero-section-motion.tsx` inserts a child `span` with this class) |
| `marketing-card-conic-glow` | Slow rotating **monochrome** conic accent for marketing cards; see **Conic ring wrapper** below |

**Keyframes** for the above live in `src/app/globals.css` `@layer utilities` (`landing-radials-hero-drift`, `landing-veil-a`, `landing-veil-b`, `landing-sheen-sweep`, `landing-conic-rotate`, `landing-edge-shimmer-move`). When adding new infinite decorative animations, register them here and add matching **`@media (prefers-reduced-motion: reduce)`** rules in the **same** globals block used for `animate-mist-drift` / `animate-pulse-slow` / automation snapshot layers.

#### Hero decor stack order (bottom → top)

Typical stacking inside the hero `<section>` (all decorative layers `pointer-events-none` except pointer logic is also non-interactive):

1. `landing-atmosphere-radials-hero`
2. `landing-hero-veil-a` · `landing-hero-veil-b`
3. Large blurred emerald blobs (`animate-pulse-slow` / `animate-mist-drift` + `motion-reduce:animate-none` in markup)
4. `landing-atmosphere-grid-hero`
5. `landing-hero-sheen`
6. `landing-hero-grain`
7. **`HeroPointerAmbient`** (`src/components/landing/hero-pointer-ambient.tsx`) at `z-index: -8`
8. Foreground column (`relative` + content)

The hero root must expose **`data-hero-ambient-root`** for pointer spotlight hit-testing.

#### Pointer-follow spotlight (`HeroPointerAmbient`)

- **Client-only**; uses `useReducedMotion()` from Framer Motion — if reduced motion, **render nothing**.
- Subscribes to **`window`** `mousemove` (passive) only when **`(pointer: coarse)` is false**; coarse pointers keep a **static** default gradient (no listener).
- Updates spotlight position via **`requestAnimationFrame`** batching (avoid main-thread churn).
- **Do not** call synchronous `setState` in an effect purely to “enable” the layer (ESLint `react-hooks/set-state-in-effect`); the canonical pattern is: render the layer when motion is allowed, attach listeners in `useEffect`, update spot from events only.

#### Marketing card — conic ring wrapper (required for visibility)

A rotating `conic-gradient` **under a solid `bg-card` fill is invisible**. To show a thin emerald rim without loud fill:

1. Outer wrapper: `relative overflow-hidden rounded-xl`
2. Sibling: `span.marketing-card-conic-glow.motion-reduce:animate-none` (absolutely positioned; large negative `inset` so rotation reads at edges — defined in globals)
3. Inner **Card** or **article**: `relative z-10 m-px rounded-[calc(0.75rem-1px)]` + usual border/background

**Reference usages:** `src/components/landing/pricing-section-motion.tsx`, `src/components/landing/monthly-price-calculator-section.tsx`, `src/components/landing/how-it-works-motion.tsx` (step cards).

#### Framer Motion — modules used by this marketing example

Shared easing for this route’s choreography: **`[0.2, 0, 0, 1]`** (matches §8 easing intent). Stagger children roughly **0.07–0.08s**; cap total settle time for above-the-fold blocks per §8. **Other marketing pages** may mirror the same easing and reduced-motion handling; **dashboard** features should prefer §1.2 tooling (`animate-in`, Radix transitions, row hover) unless a specific client affordance warrants Framer.

| Module | Responsibility |
| --- | --- |
| `hero-section-motion.tsx` | Hero stagger; automation snapshot panel; CTA / icon micro-motion |
| `how-it-works-motion.tsx` | `whileInView` header + step list stagger; step card conic wrapper; icon **hover + `focus-within`** scale **≤1.02** |
| `pricing-section-motion.tsx` | Pricing header + two-column `whileInView` stagger; token card + conic wrapper |
| `navbar.tsx` | `motion.nav` enter (opacity + small `y`); respects reduced motion |
| `footer-section.tsx` | Client component; footer columns + bottom bar `whileInView` stagger |

**Server-presentational sections** in this example (`hero-section.tsx`, `how-it-works.tsx`, `pricing-section.tsx`) keep **static** atmosphere markup + import client motion subcomponents where needed—the same **split** (server shell + client motion) is a good default for **other** marketing routes; it is **not required** for every dashboard view.

## 9) Component Standards (shadcn-first)

## 9.1 Buttons

- Primary: solid green (`primary`).
- Secondary: mist tint (`secondary`).
- Ghost: low-emphasis action.
- Destructive: red semantic only.
- Minimum height: 40px.
- **Motion:** apply `transition-[property]` using §8 durations (e.g. `duration-200`, `ease-out` matching the standard token); primary buttons use a clear **pressed** state (e.g. slight opacity or scale **≤0.98** for **fast** duration) and **hover** lift via shadow or background—not layout shift.

## 9.2 Forms

- Labels required for all fields.
- Placeholder is helper text, not label replacement.
- Inline validation + submit-level summary when needed.
- Use appropriate input types (`email`, `url`, `number`, etc.).

## 9.3 Cards

- Clean card surfaces with subtle border and low shadow.
- **Glass / blur:** avoid **blur-heavy** glass on **data-dense dashboard** cards and tables. **Controlled** `backdrop-blur` on **marketing** surfaces, modals, and sheets is allowed when aligned with shadcn/Radix patterns (e.g. `src/components/ui/sheet.tsx`).
- **Motion:** marketing cards use hover feedback per §8 (shadow, ring, and/or safe `translate-y`); dashboard cards default to **shadow/ring** only.
- **Marketing conic rim (optional):** for a **slow, low-contrast** emerald accent on **high-visibility marketing** cards (see **§8.1** worked example—not for dashboard data tables or dense admin lists), use the **`marketing-card-conic-glow` + `m-px` inner surface** pattern. Keep rotation **very slow** (on the order of **60–90s** per full rotation via `landing-conic-rotate`); disable animation under `prefers-reduced-motion` (globals + `motion-reduce:animate-none` on the glow span). Do not use multi-hue conic meshes (§14).
- Internal hierarchy: `header -> content -> actions`.

## 9.4 Tables

- Use semantic table structures.
- Wrap with horizontal scroll on mobile.
- Keep row actions explicit and keyboard reachable.

## 9.5 Dialogs

- Confirm destructive actions.
- One primary and one secondary action maximum by default.

## 9.6 Tabs

- Task-oriented labels only.
- Active state must be clearly visible in light and dark themes.

## 9.7 Alerts and Toasts

- Success: short, confirmatory.
- Error: include clear next action.
- Avoid vague text like "Something went wrong."

## 10) Navigation and Information Architecture

- Every screen should expose:
  - clear title,
  - context/purpose,
  - primary action.
- Navigation labels must use business language.
- Empty states must include a clear next action.

## 11) Copy and Microcopy

Tone:

- clear, concise, professional, action-focused.

Rules:

- Prefer explicit outcomes: "Page added successfully."
- Mention what users can do next on failure.
- Avoid over-marketing and filler phrases.

## 12) Accessibility Baseline

- WCAG AA minimum contrast.
- Keyboard-operable core paths.
- Visible focus on interactive controls.
- Proper form labeling and semantic headings.
- Color must not be the only state indicator.
- Honor **`prefers-reduced-motion`** for decorative animation; keep essential state changes perceivable (see §1.1 and §8).

## 13) Implementation Mapping in This Repo

Apply tokens via `src/app/globals.css` CSS variables:

- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--border`, `--input`, `--ring`
- `--destructive`, `--destructive-foreground`
- `--chart-1..6`

In `src/app/layout.tsx`:

- `--font-display`: Plus Jakarta Sans
- `--font-sans`: Inter
- Mono token for dense numeric/log contexts.

Motion and depth implementation also map here: shared **`@theme inline`** animation tokens and keyframes in `src/app/globals.css`; use **`animate-in`** / Radix state classes from shadcn components; add **Framer Motion** only in client components where stagger or physics-like motion is worth the bundle cost (see §8). **Marketing home** depth, lighting, class names, and file ownership for the **worked example** are in **§8.1** and the file map **§13.1**. **Product and auth** shells are summarized in **§13.2**; deeper routing and service boundaries live in `documentation/webapp/architecture.md`.

### 13.1) Worked example — public home route (`/`)

**Audience:** marketing-only slice of the codebase. Use when extending or refactoring the **public home page** or when copying patterns to **another marketing route**.

| Concern | Primary files |
| --- | --- |
| Route shell | `src/app/page.tsx` (page-level mist), `src/app/layout.tsx` (fonts, theme) |
| Hero structure + static decor | `src/components/landing/hero-section.tsx` |
| Hero motion + snapshot panel | `src/components/landing/hero-section-motion.tsx` |
| Hero pointer spotlight | `src/components/landing/hero-pointer-ambient.tsx` |
| How it works | `src/components/landing/how-it-works.tsx` (section shell) + `how-it-works-motion.tsx` (Framer) |
| Pricing | `src/components/landing/pricing-section.tsx` + `pricing-section-motion.tsx` |
| Calculator | `src/components/landing/monthly-price-calculator-section.tsx` |
| Navbar | `src/components/landing/navbar.tsx` |
| Footer | `src/components/landing/footer-section.tsx` |
| Shared atmosphere, grain, lighting keyframes, reduced-motion overrides | `src/app/globals.css` (`@layer components` + `@layer utilities`) |

When adding a **new** marketing section (on this route or elsewhere): prefer **new named classes** in `globals.css` over long arbitrary `bg-[...]` strings in JSX; mirror **`prefers-reduced-motion`** handling in the same file.

### 13.2) Product and auth surfaces (rest of the webapp)

These areas follow the **same** Green Mist tokens, typography (§6), spacing (§7), components (§9), accessibility (§12), and motion **budget** rules in **§1.2** (quieter than marketing). Do **not** assume every page needs the hero atmosphere stack from §8.1.

| Area | Typical entry / layout | Notes |
| --- | --- | --- |
| Agency + super-admin app | `src/app/(dashboard)/layout.tsx` and route segments under `src/app/(dashboard)/` | Feature UI under `src/features/*`; prefer server components, tables, forms per §9; motion per §1.2. |
| Authentication | `src/app/(auth)/layout.tsx` and routes under `src/app/(auth)/` | Keep motion restrained; focus on clarity and error recovery (§11). |
| Shared primitives | `src/components/ui/*`, `src/lib/utils.ts` | shadcn-first; changes here affect **all** surfaces. |
| Domain orchestration | `src/server/services`, `src/server/repositories` | Not visual, but shapes data shown in UI—keep payloads explicit per project performance rules. |

For **routing, layouts, and API boundaries**, use `documentation/webapp/architecture.md` and `documentation/webapp/performance.md` alongside this file.

#### Auto Download/Upload — Multi-Account bulk add (paste sources)

In **Add Page → Multi-Account + CSV**, step 2 offers CSV import (page-name matched) and **Paste sources** (random assign):

- Paste format: one line per source — `platform|username` (also `,` or `:`). Example: `instagram|ronaldo`, `facebook|messi`. Plain username lines use the default platform control.
- Paste assigns sources **randomly** to selected Facebook pages (agencies that do not care which source maps to which page).
- Paste only fills **empty** page slots — pages that already have a source are left unchanged.
- Pasted lines that match a source already on a selected page are **skipped** (warning shown).
- If pasted sources **exceed** empty page slot count, block apply and tell the user how many lines to remove.
- If pasted sources are **fewer** than empty slots, assign randomly to empty pages only; remaining empty pages stay blank until the user pastes more or fills manually. **Next** still requires every selected page to have a source before schedule step.
- CSV and paste can be used independently.

Implementation: `src/lib/adu-bulk-source-paste.ts`, `src/features/auto-download-upload/bulk-source-paste-dialog.tsx`, wired in `add-page-dialog.tsx`.

## 14) Do Not Reintroduce

- Pink/purple **synthetic / “AI”** gradients and rainbow mesh unrelated to the brand.
- **Heavy** visual effects (full-screen particles, strobing, parallax that harms readability) as the **default** pattern on product screens.
- Random one-off radius, spacing, and typography values outside the token system.
- Emoji UI icons.
- **Note:** subtle emerald depth, motion, and **light** blur on **marketing** or **overlay** UI are **not** banned—see §1.1, §8, and §9.3.

## 15) Delivery Checklist

Before shipping UI changes:

- [ ] Follows this Green Mist token system.
- [ ] Follows `ui-ux-pro-max` workflow first.
- [ ] No one-off visual values added.
- [ ] **Motion:** marketing sections touched meet §1.1 minimums; **dashboard / product** changes include appropriate enter/exit or loading feedback per §1.2 (do not apply marketing-only hero ambience to dense tables).
- [ ] **Marketing depth/lighting (§8.1 pattern):** if touching the **public home** hero, its marketing cards, or **adding/reusing** the same marketing atmosphere pattern elsewhere, follow **§8.1** (class names, hero stack order, conic wrapper, `HeroPointerAmbient` rules) and extend **`globals.css`** reduced-motion rules for any **new** keyframed decor.
- [ ] **`prefers-reduced-motion`** verified for touched views (decorative motion off or minimized).
- [ ] **No infinite** or high-contrast motion on **primary reading** areas (body copy, dense tables, long forms).
- [ ] **Focus rings** remain visible during and after transitions (no `outline-none` without a replacement focus style).
- [ ] Accessibility checks completed in touched views.
- [ ] Responsive checks at 375 / 768 / 1024 / 1440.
- [ ] Local checks pass (`lint`, `typecheck`, `build` when relevant).
- [ ] Preview verification completed.

## 16) Decision Priority

1. Accessibility and clarity
2. Information hierarchy and usability
3. Token/system consistency
4. Purposeful motion and depth (token-backed; `prefers-reduced-motion` safe; §1.1 / §1.2 minimums)
5. Static visual polish (typography, spacing, color balance, alignment)
6. Purely decorative extras (only after 1–5 are satisfied)

---

Use this file as the permanent Green Mist reference for **all** `webapp` UI/UX implementation—marketing, auth, and product. **Stunning** means disciplined **motion + depth + hierarchy** within these rules—not louder colors. Treat **§8.1** as a **marketing worked example**, not a requirement to paste hero lighting into every screen.
