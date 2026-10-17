# Requirements Checklist: Spec 063 - WhatsApp Support Button

## UI/UX & Functional Requirements
- [x] Universal rendering: `<WhatsAppSupportButton />` is mounted in `apps/web/src/app/layout.tsx` and visible on all pages when configured.
- [x] Fixed positioning: Stays anchored at `bottom: 24px`, `right: 24px` on desktop, adapting to `bottom: 16px`, `right: 16px` on mobile (<640px).
- [x] Direct WhatsApp Link: Clicking opens `https://wa.me/<sanitized_phone>?text=<encoded_message>` with `target="_blank"` and `rel="noopener noreferrer"`.
- [x] Clean sanitization: Non-digit characters in `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` are stripped (e.g. `+1 (555) 012-3456` -> `15550123456`).
- [x] Default message support: URL-encodes `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE` (or falls back to friendly default message).
- [x] Clean conditional rendering: If no valid phone number is configured, the button does not render (returns null).
- [x] Accessibility: Contains `aria-label="Contact WhatsApp Support"` and a descriptive hover tooltip.

## Theme & Design Standards
- [x] Follows `apps/web/src/lib/theme.ts` for spacing, typography, focus borders, and shadows.
- [x] Uses authentic WhatsApp brand green (`#25D366`) / theme accent with crisp white SVG icon.
- [x] Zero capsule pill badges or ad-hoc custom styles.
- [x] `DESIGN.md` remains strictly untouched.

## Quality & Non-Functional Requirements
- [x] High test coverage with Vitest for URL generation logic and React component rendering.
- [x] Zero SonarQube code smells (clean functions, no nested ternaries).
- [x] Remote CI passes with 100% success.
