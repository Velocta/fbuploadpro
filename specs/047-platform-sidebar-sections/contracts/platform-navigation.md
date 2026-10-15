# Contract: Platform Navigation & Placeholder Interface

## Component Interface Contracts

### 1. `PlatformPlaceholderAccountsProps`
```typescript
export interface PlatformPlaceholderAccountsProps {
  platformName: string;
  subdomain: string;
  icon?: React.ReactNode;
}
```

### 2. URL Route Signatures
- `/tenant/[subdomain]/instagram/accounts`
- `/tenant/[subdomain]/threads/accounts`
- `/tenant/[subdomain]/x/accounts`
- `/tenant/[subdomain]/tiktok/accounts`
- `/tenant/[subdomain]/youtube/accounts`

### 3. Visual & Text Tokens
- **Notice String**: `"Being tested — not available for public use"`
- **Heading**: `"{platformName} Accounts"`
- **Action Label**: `"Back to Workspace"` or `"Return to Overview"`
- **Token Compliance**: Zero hardcoded hex colors, strict reliance on `THEME.default.surfaces.*`, `THEME.default.text.*`, and `COMPONENT_STYLES.card()`.
