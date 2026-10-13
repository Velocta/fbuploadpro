# Quickstart: Spec 035 — Desktop Shell Embedded View & Frameless Parity Architecture

## 1. Prerequisites
- Node.js >= 20.x, pnpm >= 9.x
- Rust >= 1.80 (with Cargo)

---

## 2. Validation Commands

### Typecheck & Linting
```bash
# Typecheck contracts and desktop shell
pnpm --filter @fbuploadpro/contracts typecheck
pnpm --filter @fbuploadpro/desktop typecheck

# Full monorepo lint
pnpm turbo run lint
```

### Automated Tests
```bash
# Test contracts (including desktop contracts and isDesktopApp())
pnpm --filter @fbuploadpro/contracts test

# Test desktop shell
pnpm --filter @fbuploadpro/desktop test
```

### Native Cargo Static Verification
```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

---

## 3. Running Desktop Shell in Development
```bash
# Start local web development server (Terminal 1)
pnpm --filter @fbuploadpro/web dev

# Launch Tauri desktop window pointing to local dev server (Terminal 2)
pnpm --filter @fbuploadpro/desktop tauri dev
```
