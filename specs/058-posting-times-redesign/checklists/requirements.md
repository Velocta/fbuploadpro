# Requirements Checklist: Spec 058 Facebook Page Posting Times Redesign

## 1. Domain Standards & Theme Compliance
- [ ] Strictly references theme tokens from `@/lib/theme` (`THEME`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`, `STATUS_SIGNALS`).
- [ ] Permanently preserves `DESIGN.md` immutability (zero modifications to `DESIGN.md`).
- [ ] Strictly ZERO capsule pill badges anywhere in the component.
- [ ] Strictly ZERO bullet point dots (`•`) in any status, header, or ledger item.
- [ ] Accessible color contrasts in both Pitch Black dark mode and Light mode.

## 2. Information Architecture & UX Writing
- [ ] Tab navigation reads **Posting Times** instead of "Calendar & Slots".
- [ ] Professional, customer-facing copy with zero developer jargon or technical database terms.
- [ ] Contextual time descriptions (e.g. "Morning window", "Afternoon peak", "Prime evening").
- [ ] Informative, calm cadence summary (daily windows and weekly capacity).

## 3. Functionality & Interactivity
- [ ] Daily posting times list renders with tabular numeric alignment and AM/PM indicators.
- [ ] Tactile switch toggles slots between active and paused via `onToggleSlot`.
- [ ] Inline remove button deletes slot via `onDeleteSlot`.
- [ ] Add Posting Time modal allows entering valid 24h / 12h times and selecting timezone.
- [ ] 1-click presets add common peak times immediately.
- [ ] Empty state renders calm guidance and 1-click setup when zero slots exist.

## 4. Test & Code Quality
- [ ] `apps/web/tests/ui/dedicated-page.test.tsx` passes with 100% success.
- [ ] Cognitive complexity of all functions kept strictly $\le 15$ to satisfy SonarQube rules.
- [ ] Clean typecheck: `pnpm --filter web typecheck` passes with 0 errors.
