# Requirements Quality Checklist: Facebook Settings Tab Rebuild (UX & Design)

**Purpose**: Validate specification completeness, clarity, and design token compliance for the Facebook tab rebuild.
**Created**: 2026-10-16
**Feature**: [spec.md](../spec.md)

## State 1 (Not Connected) Requirements Quality
- [x] Is the "Connect Facebook" card visual hierarchy clearly distinguished from secondary cards?
- [x] Are Step 1 and Step 2 numbered markers defined with semantic accessibility roles?
- [x] Is the link to `https://developers.facebook.com` explicitly specified with appropriate security attributes (`rel="noopener noreferrer"`)?
- [x] Are App ID numeric length bounds (10–20 digits) clearly specified for validation?
- [x] Are inline error display mechanisms and copy defined for both App ID and App Secret?
- [x] Is the monospace formatting and accent color for the callback URL explicitly constrained to theme tokens?

## State 2 (Connected) Requirements Quality
- [x] Is the status indicator explicitly constrained to an unboxed 6px luminous dot (green `#2ebd85`)?
- [x] Is the secret masking pattern (`••••••••••••••••••••••••`) explicitly defined?
- [x] Is the secret toggling behavior defined without exposing raw cleartext from the server?
- [x] Is the timestamp formatting defined with realistic fallbacks?
- [x] Is the hidden state of the "One more step" card in State 2 explicitly specified?
- [x] Is the pre-fill behavior when clicking "Edit details" completely documented?

## Disconnect Workflow Requirements Quality
- [x] Is the exact confirmation dialog title and copy documented verbatim?
- [x] Are the two dialog buttons ("Keep connected" and "Disconnect") specified with exact roles and visual variants?
- [x] Is the scope of deletion strictly bounded to `workspace_byoc_credentials` without affecting accounts, pages, or publishing queue?
- [x] Is the post-disconnect toast notification and return to State 1 unambiguously documented?

## Design Token & Architectural Compliance
- [x] Are all colors, spaces, and radii mapped directly to `apps/web/src/lib/theme.ts`?
- [x] Are capsule/pill badges strictly forbidden?
- [x] Is `DESIGN.md` preserved without any modifications?
- [x] Are General tab, auth logic, and external routing protected from changes?
