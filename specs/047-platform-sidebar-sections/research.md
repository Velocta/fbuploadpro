# Research: Multi-Platform Sidebar Sections & Placeholder Routes

## Decisions & Technical Choices

### 1. Platform Hierarchy in Sidebar
- **Decision**: Render Instagram, Threads, X (Twitter), TikTok, and YouTube under the "Platform" `<SidebarGroup>` directly below Facebook, each using the shadcn collapsible menu pattern (`Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, `SidebarMenuSub`, `SidebarMenuSubButton`).
- **Rationale**: Preserves consistent UX across all social media platforms while maintaining unified component primitives (`@/components/ui/sidebar`).
- **Alternatives Considered**: 
  - Dedicated separate group for "Upcoming Platforms": Rejected because all 6 are social distribution platforms; keeping them under "Platform" matches creator mental models and allows smooth transition out of testing when ready.

### 2. Collapsible Default State
- **Decision**: Facebook defaults to expanded (`defaultOpen={true}`), while Instagram, Threads, X (Twitter), TikTok, and YouTube default to collapsed (`defaultOpen={false}`).
- **Rationale**: Keeps the sidebar concise and avoids overwhelming the vertical space with 12+ sub-items by default, while allowing users to inspect any platform at will.
- **Alternatives Considered**: Expanding all platforms by default was evaluated and rejected during Pre-Flight Clarification with the user.

### 3. In-Sidebar Placeholder Text Styling
- **Decision**: Render a muted micro-text element (`fontSize: '0.6875rem'`) inside `<SidebarMenuSub>` below the "Accounts" sub-button using `var(--text-dim, ${THEME.default.text.muted})`.
- **Rationale**: Satisfies the explicit requirement ("add space holder text saying being tested not available for public use in the sidebar") without violating the strict ban on capsule pills or decorative status badges.
- **Alternatives Considered**: Capsule pill badge (Strictly prohibited by design system and `theme-standards.md`).

### 4. Placeholder Account Routes & Empty State View
- **Decision**: Implement explicit Next.js routes at `/tenant/[subdomain]/[platform]/accounts` backed by a shared `PlatformPlaceholderAccounts` view component.
- **Rationale**: Avoids 404 errors, provides bookmarkable URLs, cleanly displays the testing notice, and includes a clear primary call-to-action to return to the workspace home.
- **Alternatives Considered**: Disabling the button without navigation was rejected during Pre-Flight Clarification with the user.
