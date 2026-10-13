# Requirements Checklist: Spec 033 — Client Shells Scaffolding

- [ ] **Desktop Shell Scaffolding**
  - [ ] `apps/desktop/package.json` created with `@fbuploadpro/desktop`
  - [ ] `apps/desktop/tsconfig.json` extending base config
  - [ ] `apps/desktop/src/index.ts` exporting `DesktopShellConfig` and importing contracts
  - [ ] `apps/desktop/src-tauri/Cargo.toml` configured with release profile `strip = true`
  - [ ] `apps/desktop/src-tauri/tauri.conf.json` configured
  - [ ] `apps/desktop/src-tauri/src/main.rs` created
  - [ ] `apps/desktop/tests/desktop.test.ts` smoke tests passing
- [ ] **Browser Extension Shell Scaffolding**
  - [ ] `apps/extension/package.json` created with `@fbuploadpro/extension`
  - [ ] `apps/extension/tsconfig.json` extending base config
  - [ ] `apps/extension/src/index.ts` exporting `ExtensionShellConfig` and importing contracts
  - [ ] `apps/extension/manifest.json` configured for Manifest V3
  - [ ] `apps/extension/tests/extension.test.ts` smoke tests passing
- [ ] **Monorepo & CI Integration**
  - [ ] `pnpm install` succeeds and workspace links both new apps
  - [ ] `pnpm turbo run build lint typecheck test` runs across all packages with 0 errors
  - [ ] `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` succeeds
