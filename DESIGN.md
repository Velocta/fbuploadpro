# Design System Specification: Binance Precision (Dual Theme)

**Design Identity**: High-Precision Computational Finance, Cryptographic Density & High-Contrast Velocity  
**Core Foundation**: Official Binance Brand Palette anchored by Gold (`#fad734`) paired with Peru (`#b29527`), Pitch Slate (`#1f242d`), Pitch Black (`#000000`), and Pure White (`#ffffff`).

---

## 1. Design System Philosophy & Principles

1. **Precision Hierarchy Anchored by Gold (`#fad734`), Pitch Black (`#000000`) & Pitch Slate (`#1f242d`)**:
   * **Gold (`#fad734`)** is the dominant brand keystone—reserved for primary interactive buttons, brand anchors, and focal moments.
   * **Peru (`#b29527`)** serves as the authoritative secondary highlight for links, interactive highlights, callouts, and secondary focal states.
   * **Pitch Black (`#000000`)** provides the pure architectural base surface upon which all information rests in Dark Mode.
   * **Pure White (`#ffffff`)** provides the absolute maximum-contrast, crystal-clear readable foreground typography in Dark Mode (**21.0:1 contrast ratio**), and the base canvas in Light Mode.
   * **Pitch Slate (`#1f242d`)** provides structural boundary definition through stealthy 1px hairline borders, dividers, subtle wells, and muted UI surfaces, preserving the high-tech Binance blue-slate DNA while receding quietly into pure black.
2. **Dual-Theme Inversion Architecture**:
   * **Dark Mode**: Surface canvas `#000000`, panel surfaces `#0c0d10` / `#121419`, borders `#1f242d`, display and body text `#ffffff`.
   * **Light Mode**: Surface canvas `#ffffff`, panel surfaces `#ffffff`, borders `#eaecef` / `#e2e8f0`, display and body text `#000000`.
3. **Flawless Contrast Ergonomics (WCAG AAA)**:
   * Primary action buttons pair solid Gold (`#fad734`) with bold Pitch Black (`#000000`) text, yielding a **14.86:1 contrast ratio** that significantly surpasses WCAG AAA requirements in both themes.
   * Pure White (`#ffffff`) text on Pitch Black (`#000000`) delivers the theoretical maximum **21.0:1 contrast ratio**.
4. **Sub-Pixel Hairline Definition**:
   * Boundaries are defined through explicit 1px structural hairlines (`#1f242d` in dark mode, `#eaecef` in light mode). Never rely on blurry, muddy drop shadows without border containment.
5. **Abolition of Visual Slop**:
   * Traditional capsule pill bubbles, colored badge tags, multi-stop decorative gradients, and floating unbordered cards are permanently prohibited.

---

## 2. Color Foundation & Specification

### 2.1 The 8 Official Brand Colors

| Swatch | Token Name | Role & UI Application | Hex | RGB | HSL | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ![#fad734](https://via.placeholder.com/14/fad734/000000?text=+) | `--color-primary` | **Gold · Primary**: Dominant brand color. Primary buttons, logos, active focus rings. | `#fad734` | `rgb(250, 215, 52)` | `hsl(49, 95%, 59%)` | **14.86:1** on `#000000` (AAA) |
| ![#b29527](https://via.placeholder.com/14/b29527/000000?text=+) | `--color-accent-1` | **Peru · Accent 1**: Secondary highlight for links, callouts, active underline tabs. | `#b29527` | `rgb(178, 149, 39)` | `hsl(47, 64%, 43%)` | **5.89:1** on `#000000` (AA) |
| ![#766018](https://via.placeholder.com/14/766018/ffffff?text=+) | `--color-accent-2` | **Bronze · Accent 2**: Deep highlight, active tab borders, pressed states, tertiary accents. | `#766018` | `rgb(118, 96, 24)` | `hsl(46, 66%, 28%)` | **2.68:1** on `#000000` |
| ![#f6465d](https://via.placeholder.com/14/f6465d/ffffff?text=+) | `--color-accent-3` | **Rose · Accent 3**: Negative status, error states, sell indicator, critical alerts. | `#f6465d` | `rgb(246, 70, 93)` | `hsl(352, 91%, 62%)` | **5.35:1** on `#000000` (AA) |
| ![#2ebd85](https://via.placeholder.com/14/2ebd85/000000?text=+) | `--color-accent-4` | **Emerald · Accent 4**: Positive status, success states, buy indicator, operational signals. | `#2ebd85` | `rgb(46, 189, 133)` | `hsl(157, 61%, 46%)` | **8.12:1** on `#000000` (AAA) |
| ![#000000](https://via.placeholder.com/14/000000/ffffff?text=+) | `--color-background` | **Pitch Black · Background**: Base surface canvas the rest of the palette sits on in dark mode. | `#000000` | `rgb(0, 0, 0)` | `hsl(0, 0%, 0%)` | Canvas Baseline |
| ![#ffffff](https://via.placeholder.com/14/ffffff/000000?text=+) | `--color-text` | **Pure White · Text**: Primary readable foreground typography and metrics. | `#ffffff` | `rgb(255, 255, 255)` | `hsl(0, 0%, 100%)` | **21.0:1** on `#000000` (AAA) |
| ![#1f242d](https://via.placeholder.com/14/1f242d/ffffff?text=+) | `--color-neutral` | **Pitch Slate · Neutral**: Supporting tone for 1px borders, dividers, subtle recessed UI surfaces. | `#1f242d` | `rgb(31, 36, 45)` | `hsl(219, 18%, 15%)` | Perimeter Baseline |

---

### 2.2 Semantic Token Mapping: Dark Mode vs. Light Mode

| Token Role | Semantic Token | Dark Mode Value | Light Mode Value | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Canvas** | `surface-canvas` | `#000000` (`--color-background`) | `#ffffff` | Viewport base background |
| **Primary Panel** | `surface-panel` | `#0c0d10` | `#ffffff` | Cards, tables, sheets, dialogs |
| **Subtle Well** | `surface-subtle` | `#121419` | `#f8f9fa` | Recessed areas, table header cells |
| **Hover Fill** | `surface-hover` | `#1f242d` (`--color-neutral`) | `#f1f3f5` | Interactive hover fill |
| **Active Fill** | `surface-active` | `#262c37` | `#e9ecef` | Pressed / selected state |
| **Primary Ink** | `text-primary` | `#ffffff` (`--color-text`) | `#000000` (`--color-background`) | Headlines, primary labels, values |
| **Secondary Ink**| `text-secondary`| `#9ca3af` | `#474d57` | Body descriptions, cell text |
| **Muted Ink** | `text-muted` | `#6b7280` | `#848e9c` | Timestamps, placeholders |
| **Brand Accent** | `brand-primary` | `#fad734` (`--color-primary`) | `#fad734` (`--color-primary`) | Primary action button, brand focal |
| **Interactive** | `brand-accent-1` | `#b29527` (`--color-accent-1`)| `#b29527` (`--color-accent-1`)| Links, callouts, active indicators |
| **Button Text** | `text-on-primary`| `#000000` (Bold Pitch Black) | `#000000` (Bold Pitch Black) | 14.86:1 AAA text on Gold |
| **Border Hairline**| `border-hairline`| `#1f242d` (`--color-neutral`) | `#eaecef` | Internal dividers, row splitters |
| **Border Strong** | `border-strong` | `#2b323c` | `#cbd5e1` | Input resting borders |
| **Focus Ring** | `ring-focus` | `rgba(250, 215, 52, 0.35)` | `rgba(250, 215, 52, 0.35)` | 3px golden ambient halo |

---

## 3. One-Click Copy-Ready Export Formats

### 3.1 CSS Variables (`@theme` Specification)

```css
@theme {
  --color-primary: #fad734;
  --color-accent-1: #b29527;
  --color-accent-2: #766018;
  --color-accent-3: #f6465d;
  --color-accent-4: #2ebd85;
  --color-background: #000000;
  --color-text: #ffffff;
  --color-neutral: #1f242d;
}
```

### 3.2 Dual-Theme CSS Custom Properties

```css
:root {
  /* Core Primitives */
  --primary: #fad734;
  --accent-1: #b29527;
  --accent-2: #766018;
  --accent-3: #f6465d;
  --accent-4: #2ebd85;
  
  /* Light Mode Semantic Mapping */
  --bg-canvas: #ffffff;
  --bg-panel: #ffffff;
  --bg-subtle: #f8f9fa;
  --bg-hover: #f1f3f5;
  --text-main: #000000;
  --text-sub: #474d57;
  --text-dim: #848e9c;
  --border-subtle: #eaecef;
  --border-strong: #cbd5e1;
  --ring-focus: rgba(250, 215, 52, 0.35);
}

[data-theme="dark"],
.dark {
  /* Dark Mode Semantic Mapping */
  --bg-canvas: #000000;
  --bg-panel: #0c0d10;
  --bg-subtle: #121419;
  --bg-hover: #1f242d;
  --text-main: #ffffff;
  --text-sub: #9ca3af;
  --text-dim: #6b7280;
  --border-subtle: #1f242d;
  --border-strong: #2b323c;
  --ring-focus: rgba(250, 215, 52, 0.35);
}
```

### 3.3 Tailwind CSS Configuration (`tailwind.config.ts`)

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: "#fad734",
        "accent-1": "#b29527",
        "accent-2": "#766018",
        "accent-3": "#f6465d",
        "accent-4": "#2ebd85",
        background: "#000000",
        text: "#ffffff",
        neutral: "#1f242d",
      },
    },
  },
};

export default config;
```

### 3.4 Design Tokens (W3C DTCG Standard JSON)

```json
{
  "color": {
    "primary": {
      "$value": "#fad734",
      "$type": "color",
      "$description": "Dominant brand color for primary actions and key anchors"
    },
    "accent-1": {
      "$value": "#b29527",
      "$type": "color",
      "$description": "Secondary highlight for links, callouts, and interactive states"
    },
    "accent-2": {
      "$value": "#766018",
      "$type": "color",
      "$description": "Tertiary highlight, active tab borders, and deep accents"
    },
    "accent-3": {
      "$value": "#f6465d",
      "$type": "color",
      "$description": "Negative status, sell signal, and critical error alerts"
    },
    "accent-4": {
      "$value": "#2ebd85",
      "$type": "color",
      "$description": "Positive status, buy signal, and operational success states"
    },
    "background": {
      "$value": "#000000",
      "$type": "color",
      "$description": "Base dark surface canvas"
    },
    "text": {
      "$value": "#ffffff",
      "$type": "color",
      "$description": "Primary readable foreground text"
    },
    "neutral": {
      "$value": "#1f242d",
      "$type": "color",
      "$description": "Supporting tone for borders, dividers, and subtle surfaces"
    }
  }
}
```

---

## 4. Typography & Optical Metrics

* **Typeface**: Inter / Geist Sans / System Sans (`system-ui, -apple-system, sans-serif`)
* **Disambiguated Letterforms**: `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'`.
* **Mandatory Tabular Numeric Figures**: All metric values, tickers, counters, timestamps, latency gauges, and financial figures MUST enforce:
  * `font-variant-numeric: tabular-nums;`
* **Optical Tracking & Hierarchy**:
  * Display (32px / 38px): `-0.025em` tracking, Bold (700).
  * H1 (24px / 30px): `-0.020em` tracking, SemiBold (600).
  * H2 (20px / 26px): `-0.015em` tracking, SemiBold (600).
  * H3 (16px / 22px): `-0.010em` tracking, Medium (500).
  * Body (14px / 20px): `0.000em` tracking, Regular (400) / Medium (500).
  * Micro / Column Headers (12px / 16px): `+0.040em` uppercase tracking, SemiBold (600).

---

## 5. Spacing, Geometry & Corner Radii

* **8pt Spatial Grid Progression**:
  * `space-1` (4px): Micro gaps, inline icon margins
  * `space-2` (8px): Compact element spacing, input internal padding Y
  * `space-3` (12px): Standard control padding X
  * `space-4` (16px): Standard container padding, card inner margins
  * `space-6` (24px): Card sectional gap, grid gutters
  * `space-8` (32px): Page section rhythm
  * `space-12` (48px): Major boundary margins
* **Corner Radii Hierarchy**:
  * `radius-xs` (4px): Checkboxes, micro switches, segmented toggles
  * `radius-sm` (6px): Primary/Secondary buttons, form text inputs, select triggers
  * `radius-md` (8px): Cards, data tables, sheet containers, dialog modals
  * `radius-full` (9999px): Reserved strictly for circular avatars and 6px status micro-dots. **Never for capsule pill badges.**

---

## 6. Elevation & Atmospheric Depth

Boundaries are structured with **1px hairline borders + subtle ambient contact shadows**:

### Dark Mode Elevation
* **Level 0 (Canvas)**: `#000000`. Border: none. Shadow: none.
* **Level 1 (Card / Resting Surface)**:
  * Surface: `#0c0d10`
  * Perimeter: 1px border `#1f242d`
  * Shadow: `0 2px 8px rgba(0, 0, 0, 0.60)`
* **Level 2 (Floating Popover / Dropdown)**:
  * Surface: `#121419`
  * Perimeter: 1px border `#2b323c`
  * Shadow: `0 12px 24px -4px rgba(0, 0, 0, 0.85)`
* **Level 3 (Modal Dialog / Command Overlay)**:
  * Surface: `#0c0d10`
  * Perimeter: 1px border `#2b323c`
  * Shadow: `0 24px 48px -8px rgba(0, 0, 0, 0.95)`

### Light Mode Elevation
* **Level 0 (Canvas)**: `#ffffff`. Border: none. Shadow: none.
* **Level 1 (Card / Resting Surface)**:
  * Surface: `#ffffff`
  * Perimeter: 1px border `#eaecef`
  * Shadow: `0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.02)`
* **Level 2 (Floating Popover / Dropdown)**:
  * Surface: `#ffffff`
  * Perimeter: 1px border `#e2e8f0`
  * Shadow: `0 4px 12px -2px rgba(0, 0, 0, 0.08)`
* **Level 3 (Modal Dialog / Command Overlay)**:
  * Surface: `#ffffff`
  * Perimeter: 1px border `#cbd5e1`
  * Shadow: `0 20px 32px -4px rgba(0, 0, 0, 0.12)`

---

## 7. Component Visual Specifications

### 7.1 Buttons & Interactive Actions

#### Primary Action Button
* Fill: Solid Gold (`--color-primary`: `#fad734`)
* Typography: 14px SemiBold / Bold, Pitch Black (`--color-background`: `#000000`)
* Inset Highlight: `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35)`
* Hover State: Fill `#fde174`, transition 120ms ease-out
* Active State: Fill `--color-accent-1` (`#b29527`), `transform: scale(0.98)`
* Focus-Visible: 3px halo `rgba(250, 215, 52, 0.35)`
* *Discipline Rule*: Exactly ONE Primary Button per visible viewport or major task surface.

#### Accent 1 Interactive Trigger (Links & Callouts)
* Color: `--color-accent-1` (`#b29527`)
* Hover: `--color-primary` (`#fad734`), underline on hover
* Active: `--color-accent-2` (`#766018`)

#### Secondary Button (Outline)
* Dark Mode: Surface `transparent`, 1px border `#1f242d`, Text `#ffffff`, Hover Surface `#121419`
* Light Mode: Surface `#ffffff`, 1px border `#eaecef`, Text `#000000`, Hover Surface `#f8f9fa`

#### Ghost Button
* Surface: Transparent, no border
* Dark Mode: Text `#9ca3af`, Hover Surface `#121419`, Hover Text `#ffffff`
* Light Mode: Text `#474d57`, Hover Surface `#f1f3f5`, Hover Text `#000000`

---

### 7.2 Form Inputs & Controls

* Height: 38px
* Dark Mode: Surface `#000000`, 1px border `#1f242d`, Text `#ffffff`, Placeholder `#6b7280`
* Light Mode: Surface `#ffffff`, 1px border `#cbd5e1`, Text `#000000`, Placeholder `#848e9c`
* Focus State: Border color `#fad734`, outer halo `0 0 0 3px rgba(250, 215, 52, 0.30)`

---

### 7.3 Semantic State Signaling (Unboxed — Zero Badges / Zero Capsule Pills)

**Strict Architecture Rule**: Traditional rounded capsule badges, colored pill bubbles, and tinted background ovals are permanently banned across the entire design system.
* Status is signaled exclusively through unboxed 6px solid circular dots emitting soft ambient halos (`box-shadow: 0 0 8px [color]`) paired directly with medium foreground typography. Zero background bubbles, zero border pills.

* **Operational / Success (Emerald)**:
  * 6px Dot: `--color-accent-4` (`#2ebd85`)
  * Micro-Halo: `box-shadow: 0 0 8px rgba(46, 189, 133, 0.50)`
  * Text Label: High-contrast primary foreground
* **Queued / Active (Gold)**:
  * 6px Dot: `--color-primary` (`#fad734`)
  * Micro-Halo: `box-shadow: 0 0 8px rgba(250, 215, 52, 0.50)`
  * Text Label: High-contrast primary foreground
* **Critical / Error (Rose)**:
  * 6px Dot: `--color-accent-3` (`#f6465d`)
  * Micro-Halo: `box-shadow: 0 0 8px rgba(246, 70, 93, 0.50)`
  * Text Label: High-contrast primary foreground
* **Neutral / Idle (Pitch Slate)**:
  * 6px Dot: `--color-neutral` (`#1f242d` with subtle ambient boost `#474d57` in dark, `#848e9c` in light)
  * Micro-Halo: `box-shadow: 0 0 4px rgba(47, 54, 66, 0.40)`
  * Text Label: Secondary foreground

---

### 7.4 Data Tables & High-Density Records

* **Table Header**: Recessed well (`#121419` in dark, `#f8f9fa` in light), uppercase micro-captions (`+0.04em` tracking), 1px hairline bottom border (`#1f242d` in dark, `#eaecef` in light).
* **Table Rows**: 48px row height, hover fill (`#1f242d` in dark, `#f1f3f5` in light), 1px horizontal splitters.
* **Numeric Values**: Strict `font-variant-numeric: tabular-nums;` right-aligned with monospace columnar stability.

---

### 7.5 Overlays & Modal Dialogs

* **Backdrop**: `rgba(0, 0, 0, 0.85)` with `backdrop-filter: blur(4px)`.
* **Dialog Container**: Centered Level 3 surface (`#0c0d10` dark, `#ffffff` light), 1px border (`#2b323c` dark, `#cbd5e1` light), 8px corner radius (`radius-md`).
* **Header / Footer**: Explicit 1px hairline dividers separating the body from action triggers.

---

## 8. Anti-Patterns & Visual Bans

1. **NO Capsule / Pill Badges**: Never wrap status, tags, or counts in rounded pill bubbles (`rounded-full bg-* border`). Use unboxed 6px luminous dots.
2. **NO Decorative Multi-Color Gradients**: Color is functional and semantic. Multi-stop or rainbow gradients are prohibited.
3. **NO Unbordered Floating Containers**: Every card, panel, and modal must feature an explicit 1px boundary.
4. **NO Low-Contrast Text**: Text must strictly meet WCAG AA/AAA. Muted copy must not fall below readable thresholds.
5. **NO Eyebrow / Kicker Tags Above Headings**: Headings carry their own optical weight without extraneous tags.
6. **PURE DESIGN SPECIFICATION**: This document contains strictly visual design tokens, mathematical geometry, and component states. It contains zero application wireframes, zero product roadmaps, and zero backend references.
