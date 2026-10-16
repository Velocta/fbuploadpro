# Feature Specification: 048 Remove General Settings Section

**Feature Directory**: `specs/048-remove-general-settings`  
**Feature Branch**: `feat/048-remove-general-settings`  
**Status**: In Implementation  
**Created**: 2026-10-15  
**Source**: User Request ("remove the general section entirely for now")  
**Constitution Authority**: Principle 24 (Tenant Data Isolation) & Rule on Elimination of Decorative Status Indicators

---

## 1. Executive Summary & Problem Statement

The "General Settings" tab (`GeneralSettingsView` in `apps/web/src/components/settings/general-settings-view.tsx`) currently renders a static dummy card with uneditable placeholder text (`"Default Workspace"`, `"Recently"`), hardcodes `.fbuploadpro.com` rather than the active root domain, and includes a decorative green status dot ("Active") that violates project UX writing and interface guidelines.

In addition, `WorkspaceSettingsPage` (`apps/web/src/app/tenant/[subdomain]/settings/page.tsx`) defaults to this non-functional General view whenever an operator visits `/settings`, forcing an extra click to access the actionable Facebook BYOC settings tab.

Per user directive, the General section is removed entirely for now. The workspace settings page will directly present the Facebook BYOC configuration panel as its primary view.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1 (P1): Direct Access to Facebook BYOC Settings
**As a** workspace operator navigating to Workspace Settings (`/settings`),  
**I want** to immediately see the functional Facebook BYOC credentials view without encountering non-functional placeholder tabs,  
**So that** I can configure and verify my Meta Developer credentials without extraneous clicks or confusion.

**Acceptance Criteria**:
1. Navigating to `/tenant/[subdomain]/settings` directly presents `BYOCSettingsView`.
2. The legacy `GeneralSettingsView` component and its uneditable placeholder elements are removed from the settings page.
3. Existing deep links to `/tenant/[subdomain]/settings?tab=byoc` continue to function seamlessly.
4. The decorative static "Active" indicator and hardcoded `.fbuploadpro.com` string are eliminated.

---

## 3. Requirements

- **FR-001**: `apps/web/src/app/tenant/[subdomain]/settings/page.tsx` MUST remove the `general` tab, default directly to `byoc`, and render `BYOCSettingsView`.
- **FR-002**: Remove `apps/web/src/components/settings/general-settings-view.tsx`.
- **FR-003**: Update unit tests in `apps/web/tests/ui/byoc-settings.test.tsx` to remove legacy `GeneralSettingsView` assertions while retaining 100% test coverage for `BYOCSettingsView`, `saveAndTestBYOC`, and `ByocTestFailedModal`.
