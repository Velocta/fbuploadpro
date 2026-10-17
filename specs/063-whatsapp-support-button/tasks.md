# Implementation Tasks: Spec 063 - WhatsApp Support Button

## Task List

- [x] **Task 1: WhatsApp URL Builder & Sanitization Utility (`apps/web/src/lib/whatsapp.ts`)**
  - [x] Implement `sanitizePhoneNumber(phone: string): string` to strip non-digit characters.
  - [x] Implement `buildWhatsAppSupportUrl(phone?: string, message?: string): string | null` with sensible defaults.
  - [x] Add unit tests in `apps/web/tests/unit/whatsapp.test.ts` verifying number formatting, pre-filled message encoding, and fallback behavior.

- [x] **Task 2: Build `WhatsAppSupportButton` Component (`apps/web/src/components/support/whatsapp-support-button.tsx`)**
  - [x] Create floating circular action button fixed at bottom-right viewport (`z-index: 50`).
  - [x] Implement responsive coordinates (`24px` desktop, `16px` mobile) and smooth hover/focus transitions conforming to `@web/lib/theme`.
  - [x] Embed high-contrast vector WhatsApp icon, accessible label (`aria-label="Contact WhatsApp Support"`), and hover tooltip.
  - [x] Export from `apps/web/src/components/support/index.ts`.

- [x] **Task 3: Universal Mount in `RootLayout` & Environment Variables**
  - [x] Mount `<WhatsAppSupportButton />` in `apps/web/src/app/layout.tsx`.
  - [x] Document `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` and `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE` in `apps/web/.env.example`.

- [x] **Task 4: Component Tests & Verification**
  - [x] Add UI tests in `apps/web/tests/ui/whatsapp-support-button.test.tsx` verifying DOM rendering, link destination, security attributes (`target="_blank"`, `rel="noopener noreferrer"`), and tooltip behavior.
  - [x] Verify clean linting, type safety, and zero code smells.

- [x] **Task 5: Documentation Synchronization**
  - [x] Update `docs/foundational-knowledge.md` documenting the WhatsApp Support channel integration and configuration.
