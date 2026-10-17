# Implementation Plan: WhatsApp Support Button

**Branch**: `feat/063-whatsapp-support-button` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/063-whatsapp-support-button/spec.md`

## Summary

Add a universal floating WhatsApp support action button to the bottom-right corner of all web pages across FBUploadPro. The button directly links to WhatsApp (`wa.me`) in a new browser tab with a pre-configured phone number and pre-filled greeting message. The phone number is configured via `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` and message via `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE`.

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19 / Next.js 16  
**Primary Dependencies**: Next.js App Router, React 19, `@fbuploadpro/web/src/lib/theme.ts`  
**Storage**: None (frontend client state / configuration)  
**Testing**: Vitest (`apps/web/tests/unit/whatsapp.test.ts`, `apps/web/tests/ui/whatsapp-support-button.test.tsx`)  
**Target Platform**: Modern desktop and mobile web browsers  
**Project Type**: Next.js Web Application component  
**Performance Goals**: Zero impact on First Contentful Paint (FCP), zero layout shift (CLS), < 2KB bundle footprint  
**Constraints**: Zero ad-hoc style violations, strict accessibility (`aria-label`, focus rings), no disruption to modals or sidebars  

## Constitution Check

- [x] **Principle I (SDD)**: Specification defined under `specs/063-whatsapp-support-button/`.
- [x] **Principle II (Modular Architecture)**: Component strictly placed within `apps/web`.
- [x] **Principle IV (Zero-Trust Validation)**: Input phone number sanitized via robust regex parser before constructing target URL.
- [x] **Principle VIII (Theme Token Governance)**: Consumes radii, shadows, and focus styles from `apps/web/src/lib/theme.ts`.
- [x] **Principle IX (UX Writing & Professional Copy)**: Clean, professional labels without internal developer jargon.

## Project Structure

### Documentation (this feature)

```text
specs/063-whatsapp-support-button/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md
```

### Source Code

```text
apps/web/
├── .env.example                                        # Add NEXT_PUBLIC_WHATSAPP_* docs
├── src/
│   ├── app/
│   │   ├── layout.tsx                                 # Mount <WhatsAppSupportButton />
│   ├── components/
│   │   └── support/
│   │       ├── index.ts                               # Export support components
│   │       └── whatsapp-support-button.tsx            # Floating FAB component
│   └── lib/
│       └── whatsapp.ts                                # URL builder & phone sanitization
└── tests/
    ├── unit/
    │   └── whatsapp.test.ts                           # URL generator unit tests
    └── ui/
        └── whatsapp-support-button.test.tsx           # React component render tests
```

## Phase 0: Research & Alignment (Complete)
- Clarified click behavior: Direct link opening WhatsApp in a new tab.
- Clarified configuration: Driven by `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER`.

## Phase 1: Design & Architecture
- Utility module `buildWhatsAppSupportUrl`:
  - Takes raw phone and message strings.
  - Returns `https://wa.me/<digits>?text=<encoded_text>`.
- Client component `WhatsAppSupportButton`:
  - Position: `fixed`, `bottom: 24px`, `right: 24px`, `z-index: 50`.
  - Responsive adjustment for `<640px` screens.
  - High-contrast WhatsApp icon + hover tooltip.
- Mount directly into `RootLayout` in `apps/web/src/app/layout.tsx`.
