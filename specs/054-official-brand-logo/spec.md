# Spec 054: Official FBUploadPro Brand Logo Component & Asset Implementation

## 1. Executive Summary
This specification defines the implementation of the official **FBUploadPro** geometric brand logo across the web application, desktop app shell, browser favicons, and authentication screens.
The official logo combines an ascending upload vector, the stylized "F" monogram crown and spine, the specular edge highlight defined in `DESIGN.md` Section 7.1, the Peru accent middle crossbar, and the Bronze accent recurring queue slot anchor into a unified 64x64 SVG vector mark.

The specification introduces a canonical, reusable `<BrandMark />` and `<BrandLogo />` component suite under `apps/web/src/components/brand/`, replaces all temporary placeholders (e.g. geometric triangle icons, plain text "FB" badges) across navigation headers and auth layouts, and installs the SVG as the native browser web icon (`apps/web/src/app/icon.svg`).

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Canonical Reusable Brand Components (P1)
**As a** frontend developer and user of FBUploadPro,  
**I want** a centralized, typed `<BrandMark />` and `<BrandLogo />` component in `@/components/brand`,  
**So that** the official logo renders with pixel-perfect consistency, scalable geometry, and theme token alignment across the entire platform.

- **Acceptance Criteria**:
  - `BrandMark` component renders the official 4-path SVG geometry with `viewBox="0 0 64 64"`:
    - Path 1 (Crown & Spine / Upload Arrow): `fill="#fad734"` (`PALETTE.primary`).
    - Path 2 (Specular Edge Highlight): `fill="#ffffff"` with `fillOpacity={0.35}`.
    - Path 3 (Middle Crossbar & Active Stream Wing): `fill="#b29527"` (`PALETTE.accent1`).
    - Path 4 (Recurring Queue Slot Anchor): `fill="#766018"` (`PALETTE.accent2`).
  - `BrandMark` supports customizable dimensions via `size?: number` (defaulting to 32px) and optional `container?: boolean` (rendering within a subtle dark rounded container).
  - `BrandLogo` component pairs `BrandMark` with the canonical "FBUploadPro" logotype and optional subtitle (e.g., "Studio").
  - Components include appropriate accessibility attributes (`role="img"`, `aria-label="FBUploadPro"`).

### User Story 2: Workspace Sidebar & Navigation Integration (P1)
**As an** authenticated workspace user,  
**I want** the official FBUploadPro brand mark displayed in the sidebar header,  
**So that** workspace navigation reflects the polished product identity.

- **Acceptance Criteria**:
  - `WorkspaceSidebar` (`apps/web/src/components/workspace/workspace-sidebar.tsx`) header replaces the legacy triangle SVG placeholder with `<BrandMark size={20} />`.
  - The brand mark renders cleanly both in expanded sidebar mode and collapsed icon-rail mode (`collapsible="icon"`).
  - Maintains `data-slot="sidebar-header-branding"` and `data-testid="sidebar-branding-link"`.

### User Story 3: Authentication Layout & Splash Branding (P1)
**As an** onboarding or logging-in user,  
**I want** to see the official FBUploadPro brand logo on the sign-in and registration pages,  
**So that** the application entry point looks authoritative, trustworthy, and premium.

- **Acceptance Criteria**:
  - `AuthSplitLayout` (`apps/web/src/components/auth/auth-split-layout.tsx`) replaces the ad-hoc placeholder icon with `<BrandMark size={28} />`.
  - Accessible link to `/login` with logotype "FBUploadPro" remains fully functional.

### User Story 4: Desktop Shell & Window Chrome Alignment (P1)
**As a** desktop app user,  
**I want** the window titlebar and native chrome to feature the official brand mark instead of a generic "FB" text box,  
**So that** the desktop client looks native, sleek, and integrated with the SaaS brand identity.

- **Acceptance Criteria**:
  - `DesktopTitlebar` (`apps/web/src/components/desktop/desktop-titlebar.tsx`) replaces the 16x16 `"FB"` monogram box with `<BrandMark size={16} />`.
  - Desktop shell HTML (`apps/desktop/public/index.html`) titlebar replaces the `.titlebar-monogram` text with the official inline SVG logo mark.

### User Story 5: Browser Tab Favicon & App Icon (P1)
**As a** web browser user,  
**I want** the browser tab to display the official FBUploadPro gold icon,  
**So that** I can easily identify the open FBUploadPro tab among other browser tabs.

- **Acceptance Criteria**:
  - `apps/web/src/app/icon.svg` is created with the exact 64x64 SVG vector mark.
  - Next.js App Router automatically serves `icon.svg` as the favicon and web app icon with proper mime-type (`image/svg+xml`).

---

## 3. Success Criteria

1. **Geometry Fidelity**: 100% vector accuracy against the provided SVG specifications: 4 path definitions, `0 0 64 64` viewBox, precise hex colors (`#fad734`, `#ffffff` @ 0.35, `#b29527`, `#766018`).
2. **Unified Consistency**: Zero remaining placeholder marks (triangle SVGs or raw "FB" text containers) in sidebar, auth layouts, or desktop titlebars.
3. **Responsive Scaling**: Logo renders sharply without artifacting across all standard display sizes: 16px (desktop titlebar), 20px (sidebar header), 28px (auth header), 32px (default component), 64px (browser icon), and 512px (high-res export).
4. **Test Verification**: Unit tests verify brand component rendering, size props, accessibility roles, and existing component test suites pass with 100% success.

---

## 4. Key Entities & Component Contracts

- **`BrandMarkProps`**:
  ```typescript
  export interface BrandMarkProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    className?: string;
  }
  ```
- **`BrandLogoProps`**:
  ```typescript
  export interface BrandLogoProps {
    markSize?: number;
    showWordmark?: boolean;
    subtitle?: string;
    href?: string;
    className?: string;
  }
  ```

---

## 5. Assumptions & Dependencies

- The SVG paths provided are already calibrated to the official theme palette tokens (`PALETTE.primary`, `PALETTE.accent1`, `PALETTE.accent2`, and `PALETTE.text` with specular opacity).
- No external image assets or heavy bitmap graphics are needed; pure vector SVG implementation guarantees zero network overhead and instant rendering.
- `DESIGN.md` remains strictly immutable per project governance.

---

## 6. Edge Cases

- **Collapsed Sidebar**: When the sidebar collapses into the 48px icon rail, `BrandMark` must remain perfectly centered without clipping or distorting.
- **High-DPI Displays**: SVG vectors automatically scale cleanly on Retina / 4K monitors without pixellation.
- **Light / Dark Themes**: The gold palette (`#fad734`, `#b29527`, `#766018`) maintains high contrast on dark canvases (`#000000`, `#0a0c10`, `#12151c`) as defined in `DESIGN.md`.
