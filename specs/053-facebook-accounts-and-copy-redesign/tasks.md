# Spec 053 Tasks: Facebook Accounts Section Redesign, Open Connection Dialog & Professional SaaS Copy

## Tasks List

- [x] **Task 1: Professionalize `CreateWorkspaceModal` Copy (P1)**
  - File: `apps/web/src/components/workspace/create-workspace-modal.tsx`
  - Remove all mentions of "subdomain" and replace technical plumbing jargon with professional, business-focused copy.
  - Update unit test assertion in `apps/web/tests/ui/workspace-switcher.test.tsx`.

- [x] **Task 2: Redesign `AccountCard` for Sleek, Uncluttered Experience (P1)**
  - File: `apps/web/src/components/accounts/account-card.tsx`
  - Remove "Token valid for X days" countdown text and raw gender string.
  - Add 42px avatar with 1.5px subtle status ring (`#2ebd85` active, `#fad734` expiring soon, `#f6465d` expired).
  - Implement blended `[ X pages linked ↗ ]` button that deep-links to `/tenant/[subdomain]/pages?account=${account.displayName}`.
  - Style disconnect button as a refined, blended ghost button.

- [x] **Task 3: Redesign Facebook Accounts Top Section & Scale Toolbar (P1)**
  - File: `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx`
  - Implement `computeAccountsSubtitle` with cognitive complexity $\le 15$.
  - Implement canonical scale toolbar with ghost search input (inset icon, clear button) and pure typographic flat tabs with 2px gold bottom border.
  - Align header layout and primary `+ Connect Account` action with Facebook Pages.

- [x] **Task 4: Redesign `ConnectAccountModal` to Eliminate Box-in-a-Box (P1)**
  - File: `apps/web/src/components/accounts/connect-account-modal.tsx`
  - Replace nested boxed buttons with open, breathable options on the midnight slate surface.
  - Provide plain-English copy for "This Browser" vs "Different Browser or Phone".
  - Refine `MagicLinkView` copy and layout to assure users the window will automatically update upon approval.

- [x] **Task 5: Update Unit Tests & Documentation (P1)**
  - Files: `apps/web/tests/ui/accounts.test.tsx`, `docs/foundational-knowledge.md`
  - Update tests to reflect refined copy, avatar status ring, and removal of token days/gender.
  - Document Spec 053 architectural advancements in `docs/foundational-knowledge.md`.

- [ ] **Task 6: Remote CI Validation & PR Review Gate (P1)**
  - Commit all changes atomically (code + specs + docs).
  - Push branch `feat/053-facebook-accounts-and-copy-redesign` and open Pull Request.
  - Monitor `gh pr checks <PR_NUM> --watch` to ensure 100% CI and SonarQube pass.
  - Present PR and live review summary to the user.
