# Implementation Tasks: 048 Remove General Settings Section

**Feature Directory**: `specs/048-remove-general-settings`  
**Status**: Implemented & Converged  

---

## Task Breakdown

- [x] **T001 [P1]**: Delete `apps/web/src/components/settings/general-settings-view.tsx`.
- [x] **T002 [P1]**: Refactor `apps/web/src/app/tenant/[subdomain]/settings/page.tsx` to remove `GeneralSettingsView`, default to `'byoc'`, and render `BYOCSettingsView`.
- [x] **T003 [P1]**: Update `apps/web/tests/ui/byoc-settings.test.tsx` to remove `GeneralSettingsView` import and tests.
- [x] **T004 [P1]**: Synchronize `docs/foundational-knowledge.md` to reflect that Settings currently focuses on Facebook BYOC configuration.
