# Feature Specification: Spec 061 - Login Showcase Panel Redesign

## 1. Executive Summary
The login page (`/login`) serves as the premier entry point to FBUploadPro Studio. As the product expands beyond Facebook and Instagram into a unified multi-platform cloud publishing engine (supporting Facebook, Instagram, TikTok, YouTube, Threads, and X), the visual showcase panel on the right side of the split screen layout requires a comprehensive visual and messaging redesign.

This specification prescribes:
1. **Right-Side Showcase Panel Redesign**: Replacing the legacy Meta-centric marketing pillars with an airy, minimal, brand-aligned showcase panel featuring a top-to-bottom visual hierarchy:
   - Brand row (app logo mark + "FBUploadPro" bold + "Content automation for creators" muted tagline)
   - Eyebrow label ("CREATE · SCHEDULE · GROW" in theme accent color, uppercase, wide letter-spacing, unboxed)
   - Three-line headline ("Your pages,\nposting themselves —\n100% on the cloud." with the third line accented)
   - Subtext (~420px max-width, secondary color) highlighting multi-platform 24/7 cloud automation
   - Three-row feature list separated by hairline dividers with accent line icons (Clock, 2x2 Grid, Padlock)
   - Platform line listing supported networks
   - Trust footer row ("Official platform logins · Encrypted end-to-end" with zero external links)
2. **Left Sign-in Card Copy Update**: Modernizing the subtext under "Sign In" from the legacy Facebook/Instagram-only wording to:
   `"Welcome back! Sign in to keep your content flowing across every platform."`
3. **Responsive Stacking**: Stacking the showcase panel directly above the sign-in card on narrow screens (<1024px) with reduced padding and full-width feature rows, eliminating mobile hiding.
4. **Scope Isolation**: Zero modifications to authentication logic, input forms, validation, routing, sessions, cookies, or non-login pages.

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Verbatim Showcase Content & Hierarchy
**As an** existing or prospective user navigating to `/login`,  
**I want** to see a clean, modern, multi-platform showcase of FBUploadPro's cloud automation capabilities,  
**So that** I immediately understand the product's value proposition across all major social networks without encountering obsolete or narrow copy.

- **Acceptance Criteria 1.1**: The Brand Row displays the official `BrandMark` SVG logo mark, "FBUploadPro" in bold text, and the tagline `"Content automation for creators"` underneath in muted text (`var(--text-sub)` / `var(--text-dim)`).
- **Acceptance Criteria 1.2**: The Eyebrow Label displays `"CREATE · SCHEDULE · GROW"` in uppercase, wide letter-spacing (`0.12em`), accent color (`PALETTE.primary`), completely unboxed (no pill, no badge, no background container).
- **Acceptance Criteria 1.3**: The Headline displays verbatim on three lines:
  ```
  Your pages,
  posting themselves —
  100% on the cloud.
  ```
  The third line (`"100% on the cloud."`) is highlighted in `PALETTE.primary`; the preceding lines use primary foreground text (`var(--text-main)` / `#ffffff`).
- **Acceptance Criteria 1.4**: The Subtext displays verbatim in secondary text color (`var(--text-sub)`) with a max-width constrained to approximately 420px:
  `"Schedule reels and posts across Facebook, Instagram, TikTok, YouTube, Threads, and X — they go live while you sleep, even when your laptop is closed."`
- **Acceptance Criteria 1.5**: The Feature List renders three rows separated by theme hairline dividers (`1px solid var(--border-subtle)` / `#1f242d`). Each row contains an inline SVG line icon in accent color (`PALETTE.primary`), a semibold title in primary text, and a description in muted text:
  - Row 1: Clock icon | Title: `"Post from anywhere"` | Desc: `"Schedule from your phone or laptop — your posts publish from the cloud."`
  - Row 2: 2x2 Grid icon | Title: `"Every platform, one dashboard"` | Desc: `"Connect each account once, then run everything from a single place."`
  - Row 3: Padlock icon | Title: `"Your accounts stay yours"` | Desc: `"You sign in through each platform directly — your passwords never leave them."`
- **Acceptance Criteria 1.6**: The Platform Line displays verbatim in muted small typography:
  `"Facebook · Instagram · TikTok · YouTube · Threads · X"`
- **Acceptance Criteria 1.7**: The Footer Row displays left-aligned muted text:
  `"Official platform logins · Encrypted end-to-end"`
  There is strictly no "See how it works" link.
- **Acceptance Criteria 1.8**: Strictly zero emojis anywhere; only inline SVG line icons are used.

---

### User Story 2 (P1): Left Sign-In Card Subtext Alignment
**As a** user logging into the application,  
**I want** the sign-in card description to reflect the unified multi-platform studio,  
**So that** the card messaging is cohesive with the showcase panel.

- **Acceptance Criteria 2.1**: The description text in `apps/web/src/app/login/page.tsx` is updated to verbatim:
  `"Welcome back! Sign in to keep your content flowing across every platform."`
- **Acceptance Criteria 2.2**: Form fields, validation rules, error handling, redirect behavior, and submit actions remain completely untouched.

---

### User Story 3 (P2): Responsive Stacking & Mobile Experience
**As a** mobile or narrow-screen user visiting `/login`,  
**I want** the showcase panel to gracefully stack above the sign-in card rather than disappearing,  
**So that** I still experience the product showcase and brand messaging on any screen size.

- **Acceptance Criteria 3.1**: On viewport widths < 1024px, the showcase panel stacks vertically above the sign-in card (`order: 1` showcase, `order: 2` form card in flex layout).
- **Acceptance Criteria 3.2**: Padding is responsively reduced on small screens to maintain compact spatial rhythm, while feature list rows remain full-width.
- **Acceptance Criteria 3.3**: Redundant duplicate mobile brand headers are avoided when the showcase panel is visible above the sign-in form.

---

## 3. Strict Quality & Anti-Slop Constraints
- **Theme Token Strictness**: All colors, margins, padding, fonts, and radii must reference canonical theme tokens from `@/lib/theme` (`PALETTE`, `SPACING`, `RADII`, `TYPOGRAPHY`) or CSS variables (`var(--...)`). No ad-hoc hex values, arbitrary shadows, or random pixel sizing.
- **Minimalist Aesthetic**: Unboxed design with generous whitespace. No card borders, colored boxes, or badge chips surrounding the eyebrow or feature rows.
- **Verbatim Copy**: All text strings must match the specification character-for-character without editorial rewrites.
