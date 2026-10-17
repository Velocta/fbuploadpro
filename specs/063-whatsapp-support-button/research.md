# Research & Architectural Decisions: WhatsApp Support Button

**Feature**: `063-whatsapp-support-button`  
**Date**: 2026-10-17  

---

## 1. Global Viewport Placement in Next.js 16 App Router

### Context
The button must be visible on every page across the entire platform. In `apps/web/src/app/layout.tsx` (`RootLayout`), all child routes (including public gateway routes `/login`, `/signup`, `/forgot-password`, `/reset-password` and authenticated tenant routes `/tenant/[subdomain]/...`) are rendered within `<main>{children}</main>`.

### Decision
Place a dedicated client component `<WhatsAppSupportButton />` right inside `RootLayout` in `apps/web/src/app/layout.tsx`.
```tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <DesktopTitleBar />
        <main>{children}</main>
        <WhatsAppSupportButton />
      </body>
    </html>
  );
}
```
This guarantees:
- Universal presence across all current and future routes.
- Persistent mounting without unnecessary unmount/remount churn on route navigation.
- Independence from tenant layout hierarchies.

---

## 2. URL Format and Sanitization Strategy

### Context
WhatsApp accepts links formatted as `https://wa.me/<phone_number>?text=<urlencoded_text>`.
- The phone number MUST NOT contain plus signs (`+`), spaces, hyphens, brackets, or leading zeros before country codes.
- Example: `+1 (555) 123-4567` must be formatted as `15551234567`.
- The message parameter must be safely encoded via `encodeURIComponent`.

### Decision
Create a pure utility helper `buildWhatsAppSupportUrl(phone?: string, message?: string): string | null` in `apps/web/src/lib/whatsapp.ts`.
- Sanitizes input: strips all non-digit characters (`phone.replace(/\D/g, '')`).
- If no phone number is provided or digits length is < 5, returns `null` (or a fallback support link if desired, or component hides cleanly).
- Default message: `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE` or fallback `"Hello! I need help with FBUploadPro."`.

---

## 3. Visual Design & Theme System Compliance

### Context
FBUploadPro enforces strict theme token standards (`apps/web/src/lib/theme.ts`) and immutability of `DESIGN.md`.
- No ad-hoc hex codes where tokens exist.
- WhatsApp iconic branding uses `#25D366` or theme token emerald (`PALETTE.accent4`).
- Position: `position: fixed`, `bottom: 24px`, `right: 24px`, `z-index: 50`.
- Circular FAB: `width: 52px`, `height: 52px`, `borderRadius: RADII.full`.
- Responsive: on small mobile screens (`@media (max-width: 640px)`), adjust to `bottom: 16px`, `right: 16px`, `width: 48px`, `height: 48px`.
- Crisp SVG icon of the official WhatsApp glyph in high contrast white.
- Optical hover effect: scale transition (`transform: scale(1.05)`), subtle elevation shadow.
- Accessibility: `aria-label="Contact WhatsApp Support"`, keyboard focus ring conforming to `THEME.default.borders.focus`.
