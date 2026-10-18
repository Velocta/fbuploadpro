# Spec 074: Empty Catch Blocks + ESLint `no-empty`

**Feature Branch**: `fix/074-empty-catch-blocks`
**Created**: 2026-10-19
**Status**: Ready for Planning

## Problem

The repo's own coding standard (`.agents/rules/coding-standards.md` §D) forbids empty catch blocks, but `eslint.config.mjs` explicitly exempts them via `"no-empty": ["error", { "allowEmptyCatch": true }]`. Seven truly-bare `catch {}` blocks exist in `media-library-explorer.tsx` — silent failure points where errors vanish without a trace.

## Scope

- `eslint.config.mjs` — flip `allowEmptyCatch` to `false`
- `apps/web/src/components/media/media-library-explorer.tsx` — annotate the 7 bare catches (lines ~1743, 1748, 1954, 2616, 2621, 2692, 2697). Most are best-effort UI refreshes; each gets either a `console.debug` log or an explicit `// intentional: <reason>` comment per repo convention.

Out of scope: `downloader-engine.ts` catches (all carry `// ignore` comments or return fallbacks — documented intentional); `media-preview-modal.tsx:78` (returns a fallback, not empty).

## Acceptance Criteria

1. `allowEmptyCatch: false` in eslint config; `pnpm lint` passes.
2. Zero bare `catch {}` blocks in the file — every site either logs or documents intent.
3. No behavior change (best-effort paths stay best-effort).
4. CI green.
