# Data Model & Types: Fdola Studio Desktop-Only Section

**Feature**: `specs/057-fdola-studio-desktop-section`  
**Date**: 2026-10-16  

## Client-Side Types & Domain Models

### 1. Studio Runtime Context
Represents the detected environment capabilities within `apps/web`:

```typescript
export interface StudioRuntimeContext {
  /** Whether running inside native Tauri desktop shell */
  isDesktop: boolean;
  /** Whether the runtime is macOS */
  isMac: boolean;
  /** Whether the client has finished hydration */
  isHydrated: boolean;
}
```

### 2. Studio Tool Module
Represents a desktop-exclusive workflow module card in the workspace:

```typescript
export type StudioToolStatus = 'active' | 'scaffolded' | 'ready';

export interface StudioToolModule {
  id: string;
  title: string;
  description: string;
  iconName: 'folder-sync' | 'video-processor' | 'media-workstation';
  status: StudioToolStatus;
  statusLabel: string;
  badgeSignal: 'green' | 'blue' | 'amber';
  actionLabel: string;
  primaryActionTestId: string;
}
```

### 3. Route & Navigation Contracts

| Property | Value |
| :--- | :--- |
| **Sidebar Title** | `Fdola Studio` |
| **Route Path** | `/tenant/[subdomain]/fdola-studio` |
| **Sidebar Position** | Index 3 (Home = 0, Media = 1, Downloader = 2, Fdola Studio = 3) |
| **Breadcrumb Sequence** | `Home > Fdola Studio` |
| **Protocol Scheme** | `fbuploadpro://tenant/${subdomain}/fdola-studio` |
