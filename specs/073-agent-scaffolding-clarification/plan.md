# Plan — Spec 073: Agent Scaffolding Clarification

## Approach

Single-file docs edit. Add a "Structural Scaffolding" subsection to `.agents/rules/coding-standards.md` under §B ("Zero Tolerated Stubs or Placeholder Code").

## Change

Insert after the existing §B bullet list:

```markdown
### Structural Scaffolding (Not Stubs)

`apps/desktop` (Tauri shell) and `apps/extension` (browser companion) are
**intentional structural scaffolding** for surfaces planned for future launch.
They are not stub violations and must not be removed by cleanup efforts.

- **Scaffolding** = a declared future surface with structural presence
  (workspace layout, config, typed contracts). Expected to be incomplete.
- **Stub** = an incomplete implementation inside a live production path
  (`// TODO`, `throw NotImplementedError()`, mock fallbacks). Never allowed.

Only the web app (`apps/web`) is launched. Do not flag scaffolding
directories in audits, and do not propose their removal.
```

## Verification

- Markdown renders correctly (no build step for `.agents/`).
- CI Quality Gates pass (docs-only change).
- PR opened as `docs/073-agent-scaffolding-clarification`, atomic (<20 lines).
