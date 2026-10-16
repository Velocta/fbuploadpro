# Implementation Tasks: Minimalist Standout Facebook Page Cards (Spec 049)

**Feature Directory**: `specs/049-minimalist-page-cards`  
**Status**: Implemented & Converged  

---

## Task Breakdown

- [x] **T001 [P1]**: Refactor `PageCard` in `apps/web/src/components/pages/page-card.tsx` to Direction 2 (The Precision Editorial):
  - Compute `statusRingBorder` for avatar based on status (`#2EBD85` for active, `#F0B90B` for paused, `#F6465D` for attention-needed, `var(--border-subtle)` for disconnected).
  - Apply `statusRingBorder` to both image avatar and fallback monogram initials avatar.
  - Remove bullet dot (`COMPONENT_STYLES.statusDot` / `●`).
  - Render pure typographic status in `data-testid="page-status"` styled in `statusColor`.
  - Remove the inner nested gray container box (`var(--bg-subtle)`).
  - Render followers count (`page-current-followers`) and gain (`page-followers-gained`) in an open, balanced typographic lockup.
  - Add top-right affordance glyph (`↗`) and smooth hover lift physics.
- [x] **T002 [P1]**: Verify and update unit tests in `apps/web/tests/ui/pages.test.tsx` to ensure all existing testids, status colors, and interactions pass cleanly.
- [x] **T003 [P1]**: Synchronize `docs/foundational-knowledge.md` to document the Precision Editorial Page Card architecture and status ring convention.
