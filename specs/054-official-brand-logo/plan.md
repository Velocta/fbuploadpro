# Spec 054: Technical Architecture & Implementation Plan — Official Brand Logo

## 1. Architectural Overview
This plan specifies the technical architecture, component breakdown, asset generation, and consumer updates for the official **FBUploadPro** geometric brand logo:

1. **Brand Component Suite (`apps/web/src/components/brand/brand-logo.tsx`)**:
   - `BrandMark`: Pure SVG vector component with `viewBox="0 0 64 64"`. Implements the 4-path visual anatomy:
     - Primary gold upload vector / "F" crown & spine (`#fad734`, `PALETTE.primary`)
     - Pure white specular top edge highlight (`#ffffff` with `fillOpacity={0.35}`)
     - Peru accent middle crossbar (`#b29527`, `PALETTE.accent1`)
     - Bronze accent recurring queue slot anchor (`#766018`, `PALETTE.accent2`)
   - `BrandLogo`: Composite component pairing `BrandMark` with the canonical "FBUploadPro" logotype and optional subtitle (e.g. "Studio").
   - `apps/web/src/components/brand/index.ts`: Public barrel exports.

2. **Web Icon & Favicon Asset (`apps/web/src/app/icon.svg`)**:
   - Serves the standalone 64x64 SVG vector icon directly from the Next.js App Router root, providing high-resolution favicon support across all modern desktop and mobile browsers.

3. **Workspace Sidebar Navigation (`apps/web/src/components/workspace/workspace-sidebar.tsx`)**:
   - Replace the ad-hoc triangle SVG mark in `SidebarHeader` with `<BrandMark size={20} />`.
   - Maintain the existing 32x32 rounded dark container (`#12141a`, border `#1f242d`).

4. **Authentication Split Layout (`apps/web/src/components/auth/auth-split-layout.tsx`)**:
   - Replace the legacy local `BrandLogo` placeholder with `<BrandMark size={28} />` inside the branding header.

5. **Desktop Client Chrome (`apps/web/src/components/desktop/desktop-titlebar.tsx` & `apps/desktop/public/index.html`)**:
   - Replace the `"FB"` text block in `desktop-titlebar.tsx` with `<BrandMark size={16} />`.
   - In `apps/desktop/public/index.html`, replace the `.titlebar-monogram` div with the inline SVG vector.

---

## 2. Component Design & Contracts

### A. `BrandMark` (`apps/web/src/components/brand/brand-logo.tsx`)
```typescript
import React from 'react';
import { PALETTE } from '@/lib/theme';

export interface BrandMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 32,
  className,
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="FBUploadPro"
      className={className}
      style={{ flexShrink: 0, ...style }}
      {...props}
    >
      {/* PRIMARY GOLD: Unified Ascending Upload Arrow + "F" Crown & Spine */}
      <path
        d="M24 11L12 23L17 28L20 25V51L28 45V23H45L53 15H28L24 11Z"
        fill={PALETTE.primary}
      />
      {/* PURE WHITE SPECULAR EDGE (0.35 opacity per DESIGN.md Section 7.1) */}
      <path
        d="M24 11L12 23L13.2 24.2L24 13.4L28 17.4H50.6L53 15H28L24 11Z"
        fill={PALETTE.text}
        fillOpacity={0.35}
      />
      {/* PERU ACCENT 1: Middle "F" Crossbar & Active Stream Wing */}
      <path
        d="M32 30H48L40 38H32V30Z"
        fill={PALETTE.accent1}
      />
      {/* BRONZE ACCENT 2: Recurring Queue Slot Anchor */}
      <path
        d="M32 43H41L35 49H32V43Z"
        fill={PALETTE.accent2}
      />
    </svg>
  );
};
```

### B. `BrandLogo` (`apps/web/src/components/brand/brand-logo.tsx`)
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

## 3. Test Alignment & Verification Plan

1. **`apps/web/tests/ui/brand-logo.test.tsx`**:
   - Verify `<BrandMark />` renders with proper `viewBox`, `role="img"`, and `aria-label`.
   - Verify all 4 SVG paths render with accurate fills (`PALETTE.primary`, `PALETTE.accent1`, `PALETTE.accent2`, and `fillOpacity={0.35}`).
   - Verify custom `size` props scale the SVG width and height accurately.
   - Verify `<BrandLogo />` renders logotype and optional subtitle.
2. **`apps/web/tests/ui/workspace-sidebar.test.tsx`**:
   - Verify `SidebarHeader` renders the official brand mark inside `data-testid="sidebar-branding-link"`.
3. **`apps/web/tests/auth/auth-components.test.tsx`**:
   - Verify auth layout renders the brand mark and "FBUploadPro" logotype.
4. **`apps/web/tests/ui/desktop-titlebar.test.tsx`**:
   - Verify desktop titlebar renders the brand mark.
