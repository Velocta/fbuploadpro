# Spec 073: Agent Scaffolding Clarification

**Feature Branch**: `docs/073-agent-scaffolding-clarification`
**Created**: 2026-10-19
**Status**: Ready for Planning
**Author**: Scout (per Director standing order — conversation-driven `.agents/` updates)

## Problem

The "Zero Tolerated Stubs or Placeholder Code" rule (`.agents/rules/coding-standards.md` §B) can be misread to flag `apps/desktop` (Tauri shell) and `apps/extension` (browser companion) as violations. They are **intentional structural scaffolding** for surfaces planned for future launch — not dead code, not placeholder code in production paths, and not to be removed by cleanup efforts.

An external audit (2026-10-19) flagged both as "stubs/placeholders." The Director confirmed: only the web app is launched; desktop and extension scaffolding is deliberate and must be preserved.

## Goal

Add an explicit carve-out to the coding standards so future agents (and audits) do not mistake intentional scaffolding for stub violations.

## Scope

- `.agents/rules/coding-standards.md` — add a "Structural Scaffolding" subsection under §B clarifying the distinction.
- Docs-only change. No code, no behavior change.

## Out of Scope

- Any changes to `apps/desktop` or `apps/extension` themselves.
- Any changes to the zero-stubs rule's enforcement on production code paths.

## Acceptance Criteria

1. The coding standards explicitly state that `apps/desktop` and `apps/extension` are intentional scaffolding, not stub violations.
2. The distinction is defined: scaffolding = declared future surface with structural presence; stub = incomplete implementation in a live production path.
3. CI passes (docs-only, no build impact expected).
