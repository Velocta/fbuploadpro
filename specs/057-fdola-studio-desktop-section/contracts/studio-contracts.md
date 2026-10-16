# Contracts & Interfaces: Fdola Studio

**Feature**: `specs/057-fdola-studio-desktop-section`  
**Date**: 2026-10-16  

## UI Component Contracts

### 1. `FdolaStudioView`
The top-level container component rendered at `/tenant/[subdomain]/fdola-studio`.

```typescript
export interface FdolaStudioViewProps {
  /** Workspace subdomain */
  subdomain: string;
  /** Testing override to simulate desktop shell environment */
  forceDesktop?: boolean;
}
```

### 2. `FdolaStudioGate`
The web browser gate card rendered when `isDesktopApp() === false`.

```typescript
export interface FdolaStudioGateProps {
  subdomain?: string;
}
```

### 3. `FdolaStudioWorkspace`
The empty desktop workspace placeholder rendered when `isDesktopApp() === true`.

```typescript
export interface FdolaStudioWorkspaceProps {
  subdomain?: string;
}
```

### 4. DOM Test IDs

| Element | `data-testid` | Description |
| :--- | :--- | :--- |
| Sidebar Menu Item | `sidebar-menu-button-fdola-studio` | Primary navigation button in `WorkspaceSidebar` |
| Breadcrumb Container | `workspace-breadcrumb` | Topbar navigation breadcrumb container |
| Studio Root View | `fdola-studio-view` | Outer view container |
| Desktop Gate Card | `fdola-studio-gate` | Web browser gate card container |
| Gate Message Text | `fdola-gate-message` | "This feature is only available on desktop. Please download the desktop app." |
| Native Desktop Shell | `fdola-studio-workspace` | Native desktop empty workspace placeholder |
| Desktop Empty State | `fdola-desktop-workspace-empty` | Empty state text container |
