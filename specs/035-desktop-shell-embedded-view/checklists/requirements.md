# Requirements Checklist: Spec 035 — Desktop Shell Embedded View & Frameless Parity Architecture

## 1. Window & UI Constraints
- [x] Window dimensions set to 1280x800 default, with minWidth 960 and minHeight 600
- [x] OS window decorations disabled (`decorations: false`) for custom title bar styling
- [x] Window resizable enabled (`resizable: true`)
- [x] Custom User-Agent string configured (`FBUploadProDesktop/0.1.0`)

## 2. Native Rust IPC Controls
- [x] `minimize_window` command mapped to native window minimization
- [x] `toggle_maximize` command toggling maximized/restored states
- [x] `close_window` command closing window gracefully
- [x] `get_desktop_version` returning package version

## 3. Contracts & Environment Detection
- [x] `@fbuploadpro/contracts` exports `isDesktopApp()`
- [x] `isDesktopApp()` accurately checks `window.__TAURI_INTERNALS__` and `navigator.userAgent`
- [x] Zod schemas for `DesktopWindowActionEnum` and `DesktopShellConfigSchema`
- [x] Unit tests cover all desktop contract exports and edge cases

## 4. Constitution & Security Compliance
- [x] Principle 26: Thin Client / Fat Server IP Isolation maintained (zero client secrets, zero local token storage)
- [x] Cargo release profile specifies `strip = true`, `opt-level = 3`, `lto = true`, `panic = "abort"`
- [x] Dual validation passes (`pnpm turbo run build lint typecheck test` and `cargo check`)
