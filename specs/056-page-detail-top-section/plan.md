# Implementation Plan: Facebook Page Detail Top Section & Action Buttons Redesign

**Branch**: `feat/056-page-detail-top-section` | **Spec**: [specs/056-page-detail-top-section/spec.md](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/pull_latest_main/specs/056-page-detail-top-section/spec.md)

---

## 1. Summary

Redesign the Page Detail top section (`apps/web/src/components/pages/dedicated/page-header.tsx`) and tab navigation (`apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx`) following Option A (The Mirror Studio Header). This aligns the header visual hierarchy, buttons, and tab bar with the main `/pages` directory standard: 44x44px avatar with status-colored ring border, uniform 34px action button heights, flat typographic underline tabs with 2px brand yellow indicator, and zero bullet point dots (`•`) in subtitle metadata.

---

## 2. Technical Context

- **Framework**: Next.js 16 (App Router) + React 19 (`apps/web`).
- **Styling Authority**: `apps/web/src/lib/theme.ts` & CSS variables (`globals.css`).
- **Surface Palette**: Pitch Black (`#000000` canvas, `#0c0d10` panel, `#121419` subtle, `#1f242d` hairline borders, `#fad734` brand yellow).
- **Status Signals**: Unboxed 6px luminous dot with micro-halo (`STATUS_SIGNALS.operational`, `STATUS_SIGNALS.queued`, `STATUS_SIGNALS.critical`).
- **Metadata Separators**: 12px vertical hairline dividers (`<span aria-hidden="true" style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-subtle)', flexShrink: 0 }} />`). Zero bullet point dots (`•`).

---

## 3. Constitution & Theme Check

- **Theme Compliance**: All colors, paddings, and borders reference `@/lib/theme` or semantic CSS variables (`var(--bg-canvas)`, `var(--bg-panel)`, `var(--border-subtle)`).
- **Capsule Pills**: Zero capsule pill badges; only unboxed luminous dots and flat typographic tabs.
- **Copy Standards**: Zero plumbing leaks or internal backend jargon. Clean, customer-centric microcopy.
- **`DESIGN.md` Immutability**: No changes to `DESIGN.md`.

---

## 4. Component Layout & State Architecture

### 4.1 Header Architecture (`DedicatedPageHeader`)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Facebook Pages]                                                                    │
│                                                                                        │
│ [44x44 Avatar]  Creator Central Studio [↗]             [⏸ Pause Automation] [+ Queue] [···]│
│ (1.5px ring)    ● Active | Connected via Alex Rivers | 14,200 followers                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Back Link**: Quiet, understated link `← Facebook Pages` routing to `/tenant/${subdomain}/pages`.
2. **Page Avatar**: 44x44px rounded square (`RADII.md`) with 1.5px status ring:
   - Operational/Active: `#10b981`
   - Paused: `#fad734`
   - Checkpoint/Critical: `#ef4444`
3. **Identity Title**: 1.5rem (`24px`), font-weight 700, letter-spacing -0.02em, with external link to `facebook.com/${page.fbPageId}`.
4. **Subtitle Row**:
   - 6px luminous dot + status text ("Active" / "Paused" / "Needs Attention").
   - 12px vertical hairline divider.
   - "Connected via [DisplayName]" (if present).
   - 12px vertical hairline divider.
   - Follower count formatted (e.g. "14,200 followers").
   - **Zero bullet dots (`•`)**.
5. **Action Buttons**:
   - `Pause / Resume Automation`: Height 34px, subtle secondary style (`#121419` background, `#1f242d` border), pause icon `⏸` when active, play icon `▶` when paused.
   - `+ Queue Post`: Height 34px, signature yellow `#fad734`, dark text `#000000`, font-semibold, plus icon.
   - `···` More Options: 34x34px icon button with dropdown containing:
     - Sync Page Data
     - Copy Facebook ID
     - Open on Facebook
     - Hairline divider
     - Disconnect Page (rose/destructive)

### 4.2 Tab Navigation Architecture (`TenantDedicatedPageView`)

Flat typographic tab bar:
- Border bottom: `1px solid var(--border-subtle)`
- Active tab: `border-bottom: 2px solid #fad734`, color `var(--text-main)`, font-semibold.
- Inactive tab: `border-bottom: 2px solid transparent`, color `var(--text-sub)`, font-medium.
- Count chip: Minimalist chip for Queue (e.g. `4`), background `var(--bg-subtle)`, hairline border, color `var(--text-sub)`.
