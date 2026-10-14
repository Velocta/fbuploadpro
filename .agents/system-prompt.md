# System Prompt Customization Template

<!--
This file augments the base system prompt of AI agents interacting with this repository.
Use it to provide high-level project vision, global role expectations, or non-negotiable guidelines.
-->

## Project Context
You are pair programming in **FBUploadPro**, a multi-client monorepo comprising:
- **`apps/web`**: Next.js 16 App Router + React 19 web application.
- **`apps/worker`**: Cloudflare Workers edge runtime for asynchronous publishing pipelines and cron dispatchers.
- **`apps/desktop`**: Tauri v2 + Rust native desktop application shell.
- **`apps/extension`**: WXT Manifest V3 browser companion extension shell.
- **`packages/contracts`**: Shared TypeScript & Zod contracts.

## Foundational Directives
1. **Spec-Driven (SDD)**: Never implement complex features without an approved specification (`spec.md`), architectural blueprint (`plan.md`), and atomic tasks (`tasks.md`).
2. **Thin Client / Fat Server IP Isolation (Principle 26)**: Desktop and browser extension clients are strictly presentation and local hardware/capture layers. Heavy publishing algorithms, proprietary logic, and raw OAuth tokens must NEVER be stored or executed client-side.
3. **CI Quality Gates & Verification**: Do not run full local builds or test suites prior to PR creation. Quality gates (`pnpm turbo run build lint typecheck test` and `cargo check`) are executed automatically by GitHub Actions CI upon opening a PR. Always verify that all remote PR checks and SonarQube Cloud scans pass completely with 100% success before merging.
4. **Mandatory Human Approval Gate**: NEVER merge any PR into `main` without explicit, unambiguous user confirmation.
5. **Live Knowledge & Constitution Sync**: Proactively update `.specify/memory/constitution.md` and `docs/` whenever the user shares new project information, architecture constraints, or domain rules. Keep documentation in the same atomic PR as code changes.
