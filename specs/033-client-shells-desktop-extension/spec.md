# Feature Specification: Spec 033 — Client Shells Scaffolding (Desktop Tauri v2 & Browser Extension WXT MV3)

**Feature Branch**: `docs/multi-client-architecture-blueprint`  
**Created**: 2026-10-12  
**Status**: Ready for Implementation  
**Constitution Reference**: FBUploadPro Constitution v2.24.0 (Principle 26)  
**Input**: User pre-flight interview alignment:
1. Scaffold client shells only: `apps/desktop` (Tauri v2) and `apps/extension` (WXT MV3) without web UI changes.
2. Include native build scripts (`cargo check`/`cargo build` for desktop and `wxt build`/`tsc` for extension) alongside TypeScript typechecking.
3. Link `@fbuploadpro/contracts` workspace dependency to both client packages.
4. Integrate both shells into Turborepo (`turbo.json`) and ensure `pnpm turbo run build lint typecheck test` passes with zero errors.

---

## 1. Executive Summary

This feature establishes the official monorepo client shells for **Desktop** (`apps/desktop`) and **Browser Extensions** (`apps/extension`) without writing application business features. 

The **Desktop Shell** provides a native Tauri v2 application foundation with a compiled Rust backend (`src-tauri/`) and React client window, guaranteeing source code IP protection by compiling to stripped native machine code. 
The **Browser Extension Shell** provides a WXT Manifest V3 foundation that compiles to both the Chrome Web Store and Firefox Add-ons from a single codebase. Both shells link directly to `@fbuploadpro/contracts` and seamlessly execute within the Turborepo CI/CD quality gate pipeline.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Desktop App Shell Scaffolding (Tauri v2 + Rust) (Priority: P1) 🎯 MVP

As an engineer or contributor,  
I want a valid Tauri v2 desktop application shell scaffolded in `apps/desktop` with a compiled Rust backend and TypeScript configuration,  
So that native desktop development can proceed on a robust, IP-protected foundation without blocking monorepo CI.

**Why this priority**:
Provides the native machine code client foundation, ensuring future desktop folder watchers and system tray uploaders build on a verified Tauri v2 substrate.

**Independent Test**:
Run `pnpm --filter @fbuploadpro/desktop typecheck` and `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` to verify zero compiler errors.

**Acceptance Scenarios**:
1. **Given** the monorepo workspace,  
   **When** `apps/desktop` is inspected,  
   **Then** it contains a valid `package.json` (`@fbuploadpro/desktop`), `tsconfig.json`, `src/index.ts`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `src-tauri/src/main.rs`.
2. **Given** `@fbuploadpro/contracts`,  
   **When** imported in `apps/desktop/src/index.ts`,  
   **Then** shared types and contracts resolve cleanly without TypeScript errors.
3. **Given** the Rust native configuration,  
   **When** cargo parses `Cargo.toml`,  
   **Then** the project compiles cleanly under the Rust 2021 edition with release symbol stripping configured.

---

### User Story 2 - Browser Extension Shell Scaffolding (WXT Manifest V3) (Priority: P1) 🎯 MVP

As an engineer or contributor,  
I want a cross-browser Manifest V3 extension shell scaffolded in `apps/extension` using WXT,  
So that cross-browser extensions for Chrome and Firefox share contracts with the web control plane.

**Why this priority**:
Establishes the Manifest V3 client shell for social media clipping and queue monitoring with zero code divergence between Chrome and Firefox.

**Independent Test**:
Run `pnpm --filter @fbuploadpro/extension typecheck` and verify clean TypeScript compilation and Manifest V3 contract linkage.

**Acceptance Scenarios**:
1. **Given** the monorepo workspace,  
   **When** `apps/extension` is inspected,  
   **Then** it contains a valid `package.json` (`@fbuploadpro/extension`), `tsconfig.json`, `src/index.ts`, `manifest.json`, and README documentation.
2. **Given** `@fbuploadpro/contracts`,  
   **When** imported in `apps/extension/src/index.ts`,  
   **Then** shared types resolve cleanly without compiler errors.
3. **Given** the extension scripts,  
   **When** lint, typecheck, and test scripts are invoked,  
   **Then** they execute cleanly with zero unmatched pattern errors.

---

### User Story 3 - Turborepo Pipeline & Quality Gates Integration (Priority: P1)

As a DevOps engineer or automated CI runner,  
I want both new workspace packages automatically detected and verified by Turborepo,  
So that `pnpm turbo run build lint typecheck test` runs across all packages (`web`, `worker`, `desktop`, `extension`, `contracts`, `database`) with 100% success.

**Why this priority**:
Guarantees that new client shells do not degrade or fail repository quality gates on GitHub Actions or local workstations.

**Independent Test**:
Execute `pnpm turbo run build lint typecheck test` from the root of the monorepo and verify that all 6 workspace packages build and pass with zero failures.

**Acceptance Scenarios**:
1. **Given** the root workspace `pnpm-workspace.yaml`,  
   **When** `pnpm install` is executed,  
   **Then** `@fbuploadpro/desktop` and `@fbuploadpro/extension` are linked seamlessly into `node_modules`.
2. **Given** `turbo.json`,  
   **When** `turbo run build lint typecheck test` runs,  
   **Then** all tasks for `@fbuploadpro/desktop` and `@fbuploadpro/extension` succeed with 0 errors.

---

## 3. Requirements & Boundary Constraints

1. **Zero Premature Business Features**: No proprietary publishing logic, Facebook Graph API secrets, or active background scrapers are included in these shells.
2. **IP Protection Governance (Principle 26)**: The desktop shell configuration in `src-tauri/Cargo.toml` must enforce `strip = true` and `opt-level = 3` in release profile.
3. **Package Isolation**: Neither client package may import from `@fbuploadpro/database` or `@fbuploadpro/database/edge`; only `@fbuploadpro/contracts` may be consumed.
4. **CI Speed**: Scaffolding must not add heavy un-cached native binaries to normal GitHub Actions Node.js runners.
