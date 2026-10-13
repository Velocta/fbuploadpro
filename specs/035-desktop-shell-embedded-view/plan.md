# Plan: Spec 035 — Desktop Shell Embedded View & Frameless Parity Architecture

## 1. Technical Context & Blueprint

### A. Architectural Pattern
This feature implements **Approach 1: Embedded Thin Client with Native IPC Bridge** using **Tauri v2** + **Rust** + **Shared Web Frontend**:
- **Frameless Webview Shell**: `apps/desktop/src-tauri/tauri.conf.json` configures a borderless window (`decorations: false`, `width: 1240`, `height: 740`, `minWidth: 960`, `minHeight: 580`, `center: true`) with custom user-agent `FBUploadProDesktop/0.1.0`.
- **Rust Native Window Management**: `apps/desktop/src-tauri/src/main.rs` defines window action handlers (`minimize`, `maximize`, `unmaximize`, `toggle_maximize`, `close`) and URL scheme validation for external link opening (`open_external_url`).
- **Domain Contracts Integration**: `@fbuploadpro/contracts` provides `isDesktopApp()`, `isMacDesktop()`, `sendDesktopWindowAction()`, `openExternalUrl()`, and Zod schemas.
- **Client Title Bar Component**: `apps/web/src/components/desktop/desktop-titlebar.tsx` renders platform-adaptive controls (macOS traffic lights on left vs Windows/Linux controls on right), manages `--desktop-titlebar-height: 36px` clearance, and intercepts external links.
- **Offline Resilience**: `apps/desktop/dist/index.html` provides a self-contained, on-brand Binance Precision fallback card with retry capabilities and integrated window controls.
- **Principle 26 Enforcement**: Desktop shell contains zero secrets, zero local token storage, and zero raw publishing algorithms.

---

## 2. File & Module Structure

| Path | Purpose | Layer |
| :--- | :--- | :--- |
| `apps/desktop/src-tauri/tauri.conf.json` | Window geometry (1240x740), frameless, user-agent | Desktop Config |
| `apps/desktop/src-tauri/src/main.rs` | Window controls and external URL validation | Native Rust Backend |
| `apps/desktop/dist/index.html` | Offline and connection fallback page with window controls | Desktop Dist Fallback |
| `packages/contracts/src/domain/desktop.ts` | `isDesktopApp()`, `isMacDesktop()`, `sendDesktopWindowAction()`, `openExternalUrl()` | Shared Contracts |
| `packages/contracts/src/index.ts` | Re-export desktop contracts | Shared Contracts |
| `apps/desktop/src/index.ts` | Desktop shell configuration & metadata exports | Desktop Shell TS |
| `packages/contracts/tests/desktop.test.ts` | Unit tests for desktop contracts & runtime detection | Contracts Test |
| `apps/desktop/tests/desktop.test.ts` | Unit smoke tests for desktop shell configuration | Desktop Test |
| `apps/web/src/components/desktop/desktop-titlebar.tsx` | Platform-adaptive frameless title bar with drag region | Web Client Component |
| `apps/web/src/components/desktop/index.ts` | Export `DesktopTitleBar` | Web UI Module |
| `apps/web/src/app/layout.tsx` | Root layout integration of `DesktopTitleBar` | Web Shell |
| `apps/web/src/app/globals.css` | `--desktop-titlebar-height` token and layout clearance | Web Styles |
| `apps/web/src/components/ui/sidebar.tsx` | Offset sidebar container by `--desktop-titlebar-height` | Web UI |
| `apps/web/tests/ui/desktop-titlebar.test.tsx` | Unit tests for DesktopTitleBar rendering & modes | Web Tests |

---

## 3. Data Models & Interface Contracts

### `@fbuploadpro/contracts/src/domain/desktop.ts`
```typescript
import { z } from 'zod';

export const DesktopWindowActionEnum = z.enum([
  'minimize',
  'maximize',
  'unmaximize',
  'toggle_maximize',
  'close',
]);
export type DesktopWindowAction = z.infer<typeof DesktopWindowActionEnum>;

export const DesktopShellConfigSchema = z.object({
  appName: z.string(),
  version: z.string(),
  userAgent: z.string(),
  frameless: z.boolean(),
  defaultWidth: z.number().int().positive(),
  defaultHeight: z.number().int().positive(),
  minWidth: z.number().int().positive(),
  minHeight: z.number().int().positive(),
});
export type DesktopShellConfig = z.infer<typeof DesktopShellConfigSchema>;
```

---

## 4. Security & IP Protection Evaluation
- **Release Profile**: Cargo release maintains `strip = true`, `opt-level = 3`, `lto = true`, and `panic = "abort"`.
- **Scheme Validation**: External URLs are strictly limited to `http://` and `https://` protocols, guarding against command injection or local file leaks.
- **No Local Secrets**: The desktop app binary does not embed API master keys, database passwords, or unencrypted OAuth tokens.
