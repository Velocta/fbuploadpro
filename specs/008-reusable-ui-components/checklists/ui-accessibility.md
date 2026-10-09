# UI Design System & Accessibility Checklist: Essential Reusable UI Components

**Purpose**: Reviewer-owned requirements-quality checklist validating completeness, visual hierarchy, theme token compliance, and accessibility coverage for the essential reusable UI component suite  
**Created**: 2026-10-08  
**Feature**: [spec.md](../spec.md)  

**Review Ownership**: This checklist is a reviewer-owned requirements-quality review artifact. Mark an item `[x]` only when the reviewer determines the requirements-quality criterion is satisfied.  
**Marker Semantics**: `[x]` means the criterion has been reviewed and satisfied for requirements quality. It does not mean implementation work is complete.  

---

## Visual Hierarchy & Contrast Quality

- [ ] CHK001 Is the primary action contrast ratio ($\ge 14:1$ WCAG AAA) explicitly specified with numerical thresholds for both Dark and Light themes? [Clarity, Spec §FR-002]
- [ ] CHK002 Are structural perimeter hairlines (1px sub-pixel definition) consistently defined across all surface containers? [Consistency, Spec §FR-007]
- [ ] CHK003 Are status indicators strictly specified as unboxed 6px luminous dots with micro-halos rather than capsule pill bubbles? [Completeness, Spec §FR-011]
- [ ] CHK004 Does the specification explicitly prohibit arbitrary or ad-hoc color declarations outside the centralized theme token configuration? [Governance, Spec §FR-016]

---

## Interactive & Form Control Completeness

- [ ] CHK005 Are all interaction states (default, hover, active, focus, disabled, loading) comprehensively specified for every button variant? [Completeness, Spec §FR-001]
- [ ] CHK006 Is the 3px golden ambient focus halo (`rgba(250, 215, 52, 0.35)`) specified for all keyboard-focused form controls? [Consistency, Spec §FR-003]
- [ ] CHK007 Are validation error feedback behaviors (error text, aria-invalid, red highlight) defined for Input and Textarea fields? [Completeness, Spec §FR-003, §FR-004]
- [ ] CHK008 Are binary toggles (Checkbox and Switch) specified with keyboard navigation handling (`Space`/`Enter`) and screen reader attributes? [Coverage, Spec §FR-005]

---

## Accessibility & Modal Focus Containment

- [ ] CHK009 Are focus trapping, background scroll locking, and Escape-key dismissal explicitly required for modal dialogs? [Completeness, Spec §FR-008]
- [ ] CHK010 Are WAI-ARIA tab pattern requirements (`role="tablist"`, `role="tab"`, `role="tabpanel"`, arrow-key switching) documented for Tabs? [Coverage, Spec §FR-009]
- [ ] CHK011 Are screen-reader announcement requirements (`aria-busy`, `role="alert"`, `role="status"`) specified for loading and alert components? [Coverage, Spec §FR-001, §FR-014]
- [ ] CHK012 Does the specification define reduced-motion behavior (`prefers-reduced-motion`) for skeleton shimmers and dialog animations? [Edge Cases, Spec §Edge-Cases]

---

## Layout & Feedback Coverage

- [ ] CHK013 Is Cumulative Layout Shift (CLS) quantified as 0.00 for Skeleton placeholders replacing dynamic content? [Measurability, Spec §SC-004]
- [ ] CHK014 Are tabular data numeric displays specified to use monospace tabular numbers (`tabular-nums`) to prevent jitter? [Clarity, Spec §FR-010]
- [ ] CHK015 Are component visual verification harnesses isolated with zero mock code leakage into application production code? [Boundary, Spec §FR-017]

---

## Notes

- Mark items `[x]` only after review confirms the requirement-quality criterion is satisfied
- Leave items unchecked when they still require clarification, correction, or reviewer evaluation
- `/speckit-implement` reads checklist checkbox state as a gate and must not modify markers
- `checklists/requirements.md` has a separate built-in lifecycle maintained by `/speckit-specify` and `/speckit-clarify`
