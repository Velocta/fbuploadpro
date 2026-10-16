# Requirements & Quality Checklist: Facebook Page Detail Top Section Redesign

## Scope: Spec 056 — Page Detail Top Section & Action Buttons

- [ ] **CH-001**: Subtitle metadata row uses subtle 12px vertical hairline dividers and strictly ZERO bullet point dots (`•`).
- [ ] **CH-002**: Page avatar has 44x44px dimensions with a 1.5px status ring border reflecting current state (`#10b981` active, `#fad734` paused, `#ef4444` checkpoint/error).
- [ ] **CH-003**: Back link `← Facebook Pages` is styled quietly above the title and routes cleanly to `/tenant/[subdomain]/pages`.
- [ ] **CH-004**: Action buttons (`Pause / Resume Automation` and `+ Queue Post`) both strictly adhere to the uniform 34px height standard.
- [ ] **CH-005**: Primary CTA `+ Queue Post` uses brand yellow (`#fad734`), dark text, and subtle hover elevation.
- [ ] **CH-006**: Overflow menu `···` (34x34px) opens cleanly, closes on outside click or Escape, and contains: Sync Page Data, Copy Page ID, Open on Facebook, and Disconnect Page.
- [ ] **CH-007**: Tab bar uses flat typographic tabs with a 2px solid `#fad734` bottom underline for the active tab and subtle numeric count chip for Queued items without pill bloat.
- [ ] **CH-008**: Pitch black dark mode tokens (`#000000`, `#0c0d10`, `#121419`, `#1f242d`) are used throughout; zero hardcoded ad-hoc styles.
- [ ] **CH-009**: All existing automated test assertions pass without regression.
