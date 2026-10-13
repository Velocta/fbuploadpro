# Tasks: Spec 035 — Desktop Shell Embedded View & Frameless Parity Architecture

**Specification**: [`specs/035-desktop-shell-embedded-view/spec.md`](./spec.md)  
**Plan**: [`specs/035-desktop-shell-embedded-view/plan.md`](./plan.md)  
**Status**: Implementation Ready for Verification  

---

## Task List

### Phase 1: Shared Desktop Contracts & Detection
- [x] **T001**: Implement desktop domain contracts, Zod schemas, `openExternalUrl()`, and `isDesktopApp()` runtime detection helper (`packages/contracts/src/domain/desktop.ts`, `packages/contracts/src/index.ts`)
- [x] **T002**: Author comprehensive unit tests for desktop domain contracts, window actions, and runtime detection edge cases (`packages/contracts/tests/desktop.test.ts`)

### Phase 2: Native Rust Window Controls & Configuration
- [x] **T003**: Configure frameless window geometry (`1240x740`, `decorations: false`, min `960x580`, `center: true`), custom user agent (`FBUploadProDesktop/0.1.0`), and dev/prod navigation targets in `apps/desktop/src-tauri/tauri.conf.json`
- [x] **T004**: Implement native Tauri IPC command handlers for window controls (`minimize`, `maximize`, `unmaximize`, `toggle_maximize`, `close`) and URL validation in `apps/desktop/src-tauri/src/main.rs`
- [x] **T005**: Create Binance Precision offline and connection fallback card with integrated draggable titlebar in `apps/desktop/dist/index.html`

### Phase 3: Web Client Desktop Titlebar & Edge Case Handling
- [x] **T006**: Implement platform-adaptive frameless `DesktopTitleBar` component in `apps/web/src/components/desktop/desktop-titlebar.tsx` with external link interception and `--desktop-titlebar-height` token injection
- [x] **T007**: Integrate `DesktopTitleBar` into `apps/web/src/app/layout.tsx` and adjust layout clearance in `apps/web/src/app/globals.css` and `apps/web/src/components/ui/sidebar.tsx`
- [x] **T008**: Update desktop shell configuration exports and smoke tests in `apps/desktop/src/index.ts` and `apps/desktop/tests/desktop.test.ts`
- [x] **T009**: Author unit test suite for `DesktopTitleBar` component in `apps/web/tests/ui/desktop-titlebar.test.tsx`
- [x] **T010**: Execute dual verification (`cargo check` and `pnpm turbo run build lint typecheck test`) upon user confirmation to prepare commit
