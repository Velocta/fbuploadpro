# Quickstart: Spec 036 — Dedicated Facebook Page Workspace

## Validation & Verification Workflow

### 1. Run Unit & Component Tests
```bash
pnpm --filter @fbuploadpro/web test tests/ui/dedicated-page.test.tsx
```

### 2. Run Full Monorepo Tests & Quality Checks
```bash
pnpm turbo run test typecheck lint build
```

### 3. Interactive Preview
Navigate to:
`http://localhost:3000/tenant/{subdomain}/pages/{pageId}`
- Verify Page Header: Avatar, Name, Account, Status Dot, Live Link.
- Test Tabs: `Dashboard`, `Queue`, `Calendar`, `Insights`, `Settings`.
- Test Queue Actions: "Publish Now", Edit Caption/Comment, and Cancel.
- Test Slot Management: Add recurring slot and delete slot.
- Test Automation Toggle: Pause and Resume automation.
