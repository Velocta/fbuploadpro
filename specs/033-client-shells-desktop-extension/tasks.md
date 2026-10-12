# Tasks: Spec 033 — Client Shells Scaffolding (Desktop Tauri v2 & Extension WXT MV3)

**Specification**: [`specs/033-client-shells-desktop-extension/spec.md`](./spec.md)  
**Plan**: [`specs/033-client-shells-desktop-extension/plan.md`](./plan.md)  
**Status**: Completed  

---

## Task List

### Phase 1: Desktop Application Shell (Tauri v2 + Rust)
- [x] **T001**: Scaffold `@fbuploadpro/desktop` manifest & TypeScript configuration (`apps/desktop/package.json`, `apps/desktop/tsconfig.json`, `apps/desktop/README.md`)
- [x] **T002**: Implement desktop shell entrypoint & smoke test assertions (`apps/desktop/src/index.ts`, `apps/desktop/tests/desktop.test.ts`)
- [x] **T003**: Configure native Tauri v2 Rust backend with release symbol stripping (`apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/src/main.rs`)

### Phase 2: Browser Extension Shell (Manifest V3)
- [x] **T004**: Scaffold `@fbuploadpro/extension` manifest, TypeScript config, and Manifest V3 metadata (`apps/extension/package.json`, `apps/extension/tsconfig.json`, `apps/extension/manifest.json`, `apps/extension/README.md`)
- [x] **T005**: Implement extension shell entrypoint & smoke test assertions (`apps/extension/src/index.ts`, `apps/extension/tests/extension.test.ts`)

### Phase 3: Monorepo Wiring & CI Validation
- [x] **T006**: Execute `pnpm install`, verify workspace linking, and validate 100% pass rate across `pnpm turbo run build lint typecheck test` and `cargo check`
