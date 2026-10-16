# Technical Plan: 048 Remove General Settings Section

**Feature Directory**: `specs/048-remove-general-settings`  
**Status**: In Implementation  
**Created**: 2026-10-15  

---

## 1. Scope of Changes

1. **Delete `apps/web/src/components/settings/general-settings-view.tsx`**:
   - Safely remove the unused and non-functional component.

2. **Update `apps/web/src/app/tenant/[subdomain]/settings/page.tsx`**:
   - Remove `import { GeneralSettingsView }`.
   - Update `tabs` definition to only include `{ id: 'byoc', label: 'Facebook BYOC' }` (or render tab header cleanly).
   - Default active tab state to `'byoc'`.
   - Render `BYOCSettingsView` directly.

3. **Update `apps/web/tests/ui/byoc-settings.test.tsx`**:
   - Remove the `GeneralSettingsView` import and its unit test suite.
   - Retain all other tests for BYOC functionality.

4. **Update `docs/foundational-knowledge.md`**:
   - Synchronize documentation regarding workspace settings tabs.
