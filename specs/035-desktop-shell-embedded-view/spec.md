# Spec 035: Desktop Shell Embedded View & Frameless Parity Architecture

## 1. Executive Summary & Vision
This specification establishes 1:1 functional and visual parity between the Desktop App (`apps/desktop`) and the Web App (`apps/web`) by implementing **Approach 1: Embedded Thin Client with Native IPC Bridge**. The Tauri v2 desktop shell loads the full web platform within a custom, frameless OS webview, styled according to the Binance Precision dark palette (`DESIGN.md`). The desktop native Rust backend exposes typed IPC window controls, injects a custom desktop User-Agent, provides offline connection fallbacks, intercepts external link navigation, and provides the foundation for future local Chrome automation features while strictly preserving Thin Client / Fat Server IP Isolation (Constitution Principle 26).

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Frameless Embedded Webview with Dev/Prod Gateway
As a desktop operator,  
I want the desktop application to launch in a sleek, frameless window and display the complete FBUploadPro workspace interface,  
So that I experience the exact same functionality, navigation, and theme as the web application.

- **Scenario 1.1: Default Window Geometry & Constraints (Option 2)**
  - **Given** the desktop application is launched,
  - **When** the window initializes,
  - **Then** the window dimensions must default to `1240x740` with minimum constraints of `960x580`, resizable enabled, centered on screen, and OS window decorations disabled (`decorations: false`).

- **Scenario 1.2: Development vs. Production Gateway Navigation**
  - **Given** the application is compiled in development mode (`tauri dev`),
  - **When** the webview opens,
  - **Then** it must connect to the local Next.js dev server (`http://localhost:3000`).
  - **Given** the application is compiled in release mode,
  - **When** the webview opens,
  - **Then** it must navigate to the production gateway (`https://app.fbuploadpro.com` with fallback to `https://app.vinsmokemedia.online`).

- **Scenario 1.3: Custom User-Agent Identification**
  - **Given** the desktop webview sends network requests or executes client scripts,
  - **When** inspecting the request headers or `navigator.userAgent`,
  - **Then** it must include the custom identifier `FBUploadProDesktop/0.1.0`.

---

### User Story 2 (P2): Custom Binance Precision Dark Title Bar & Window Controls
As a desktop operator,  
I want an integrated, dark-themed title bar with window dragging and window controls (minimize, maximize/restore, close),  
So that I can smoothly manipulate the frameless window without relying on native OS title bars.

- **Scenario 2.1: Visual Aesthetics & Drag Region**
  - **Given** the desktop app is open,
  - **When** viewing the top region of the window,
  - **Then** a compact 36px title bar must render with the Binance Precision pitch black/slate background (`#000000` / `#1f242d`), subtle 1px hairline border, and a draggable region (`data-tauri-drag-region`).

- **Scenario 2.2: Window Minimization**
  - **Given** the desktop window is open,
  - **When** the user clicks the minimize control button,
  - **Then** the native Tauri IPC handler `handle_window_action('minimize')` must minimize the application to the OS taskbar/dock.

- **Scenario 2.3: Window Maximization & Restore Toggle**
  - **Given** the desktop window is at standard bounds,
  - **When** the user clicks the maximize control button or double-clicks the title bar drag region,
  - **Then** the native Tauri IPC handler `handle_window_action('toggle_maximize')` must toggle between maximized and restored window states.

- **Scenario 2.4: Window Close**
  - **Given** the desktop window is open,
  - **When** the user clicks the close control button,
  - **Then** the native Tauri IPC handler `handle_window_action('close')` must gracefully close the application window.

- **Scenario 2.5: Platform-Adaptive Controls (macOS vs Windows/Linux)**
  - **Given** the desktop client runs on macOS,
  - **When** rendering the title bar,
  - **Then** window control dots (close, minimize, maximize) must render on the top-left in traffic light styling.
  - **Given** the desktop client runs on Windows or Linux,
  - **When** rendering the title bar,
  - **Then** the brand monogram renders on the left and window control buttons render on the top-right with accent hover styling.

- **Scenario 2.6: Layout Clearance (`--desktop-titlebar-height`)**
  - **Given** the web app renders inside the desktop shell,
  - **When** the desktop environment is detected,
  - **Then** `--desktop-titlebar-height: 36px` must be set dynamically on the root document so that fixed navigation sidebars and body content offset cleanly without clipping or occlusion.
  - **Given** the web app renders in a standard browser,
  - **Then** `--desktop-titlebar-height: 0px` is maintained with zero layout shifts or visual changes.

---

### User Story 3 (P3): Real-World Resilience & Navigation Safety
As an enterprise operator,  
I want offline fallbacks and safe external link handling in the desktop application,  
So that network drops do not show raw browser error screens and clicking external links never breaks app navigation.

- **Scenario 3.1: Offline & Dev Server Fallback Card**
  - **Given** the desktop application starts while offline or before the dev server is ready,
  - **When** the webview fails to connect,
  - **Then** `apps/desktop/dist/index.html` displays an on-brand Binance Precision connection retry card with a functional title bar and "Retry Connection" button.

- **Scenario 3.2: External Link Navigation Interception**
  - **Given** the user clicks an external link (e.g. `target="_blank"` link to Meta or documentation),
  - **When** clicked within the desktop shell,
  - **Then** the link is intercepted and opened in the OS default browser via `openExternalUrl()`, preventing webview hijacking.

- **Scenario 3.3: Scheme Injection Protection**
  - **Given** an external URL request,
  - **When** validating the target URL,
  - **Then** only `http://` and `https://` schemes are permitted; arbitrary schemes (`file://`, `javascript:`) are rejected.

---

## 4. Boundary & Non-Functional Requirements
- **Thin Client / Fat Server IP Isolation (Principle 26)**: No private publishing algorithms, raw OAuth tokens, or database credentials may be stored or executed within the desktop shell.
- **Cargo Release Hardening**: Native binary builds must enforce `strip = true`, `opt-level = 3`, `lto = true`, and `panic = "abort"`.
- **Zero Heavy Native Dependencies**: Keep the Rust dependencies lean (`tauri = "2"`, `serde`, `serde_json`) to ensure sub-second compilation checks.
