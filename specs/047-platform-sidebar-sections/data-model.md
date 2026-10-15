# Data Model: Multi-Platform Navigation & Status Metadata

## Navigation Configuration Data Model

```typescript
export type PlatformKey =
  | 'facebook'
  | 'instagram'
  | 'threads'
  | 'x'
  | 'tiktok'
  | 'youtube';

export type PlatformAvailability = 'active' | 'testing';

export interface PlatformNavItem {
  id: PlatformKey;
  label: string;
  tooltip: string;
  routeSegment: string;
  availability: PlatformAvailability;
  subItems: Array<{
    id: string;
    label: string;
    routeSegment: string;
    placeholderNote?: string;
  }>;
}
```

## Entity Details

### 1. `PlatformKey`
- **Description**: Canonical system identifier for each supported external distribution channel.
- **Values**: `'facebook' | 'instagram' | 'threads' | 'x' | 'tiktok' | 'youtube'`.

### 2. `PlatformAvailability`
- **Description**: Availability tier for the platform.
- **Values**:
  - `'active'`: Full OAuth connection and publishing workflows enabled (Facebook).
  - `'testing'`: In-testing stage; accounts sub-item navigates to placeholder page with "Being tested — not available for public use" note.

### 3. Route Mapping Table
| Platform | Key | Route Base | Sub-Items | Status Notice |
| :--- | :--- | :--- | :--- | :--- |
| **Facebook** | `facebook` | `/tenant/[subdomain]` | Accounts (`/accounts`), Pages (`/pages`) | None (Active) |
| **Instagram** | `instagram` | `/tenant/[subdomain]/instagram` | Accounts (`/instagram/accounts`) | "Being tested — not available for public use" |
| **Threads** | `threads` | `/tenant/[subdomain]/threads` | Accounts (`/threads/accounts`) | "Being tested — not available for public use" |
| **X (Twitter)**| `x` | `/tenant/[subdomain]/x` | Accounts (`/x/accounts`) | "Being tested — not available for public use" |
| **TikTok** | `tiktok` | `/tenant/[subdomain]/tiktok` | Accounts (`/tiktok/accounts`) | "Being tested — not available for public use" |
| **YouTube** | `youtube` | `/tenant/[subdomain]/youtube` | Accounts (`/youtube/accounts`) | "Being tested — not available for public use" |
