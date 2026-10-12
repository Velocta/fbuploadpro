# Quickstart: Spec 033 — Client Shells Scaffolding

This guide details how to verify and execute the newly scaffolded client shells for Desktop and Browser Extension.

---

## 1. Workspace Verification

Run pnpm install to ensure all workspace dependencies are resolved:

```bash
pnpm install
```

---

## 2. Typecheck & Lint All Packages

Run the Turborepo verification pipeline:

```bash
pnpm turbo run lint typecheck test
```

To run checks targeting a single client shell:

```bash
# Desktop Shell
pnpm --filter @fbuploadpro/desktop typecheck
pnpm --filter @fbuploadpro/desktop test

# Browser Extension Shell
pnpm --filter @fbuploadpro/extension typecheck
pnpm --filter @fbuploadpro/extension test
```

---

## 3. Rust Native Backend Verification (Desktop)

Verify the Tauri Rust backend compiles without errors:

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```
