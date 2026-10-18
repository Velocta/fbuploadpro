# UX & Accessibility Quality Checklist: Spec 067 Media Library Redesign

**Purpose**: Validate user experience, interaction quality, and accessibility standards for the redesigned Media Library
**Feature**: [spec.md](../spec.md)

## 1. Visual Hierarchy & "Box-in-Box" Eradication
- [x] No bordered panels placed inside other bordered panels
- [x] Sections separated strictly by spacing and hairline dividers (`var(--border-subtle)`)
- [x] Asset tiles render metadata directly on page canvas background
- [x] Consistent pitch-black canvas background (`var(--bg-canvas)`) with zero ad-hoc styling

## 2. Interaction & Feedback
- [x] Search input operates without outline box, debounced at ~250ms with zero lag on count label
- [x] Filter dropdowns open cleanly on first mouse click
- [x] Rare actions (Rename, Move, Delete) reveal on hover to minimize visual noise
- [x] Subfolder rows act as responsive drag-and-drop targets
- [x] Video hover preview triggers at 300ms with muted auto-looping
- [x] Broken thumbnail images gracefully display fallback type icon

## 3. Upload & Concurrency Experience
- [x] Multi-file import staging displays invalid files with clear plain-language explanations
- [x] Duplicates are clearly highlighted with 1-click skip options
- [x] Concurrency is capped strictly at 3 active uploads to prevent browser stalls
- [x] Leave-page protection alerts users before accidental tab closure or internal navigation
- [x] New items appear at top of library immediately upon upload confirmation

## 4. Accessibility & Microcopy
- [x] All interactive buttons and hover targets have accessible `aria-label`s
- [x] Keyboard navigation (Tab, Enter, Escape) works across all modals and dropdowns
- [x] Plain language throughout: zero developer jargon or internal schema terms
- [x] Character counter clearly displayed on caption textareas
