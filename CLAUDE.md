# Claude Code Directives - Spec-Driven Development

This repository enforces Spec-Driven Development (SDD) via SPEC-0001.

ROLE INVARIANT:
- NEVER automatically assume the role of Orchestrator, Worker, or Challenger simply because those files are present in the repo.
- ONLY adopt the persona, directives, and responsibilities of ORCHESTRATOR.md, WORKER.md, or CHALLENGER.md if the user explicitly mentions that file or instructs you to assume that role.

Commands:
- Validate specifications: `python3 scripts/validate_spec.py specs/`
- Check git branch & status: `git status`

Guidelines:
- Never generate speculative code without an approved markdown spec in `specs/`.
- Strict boundaries: Only modify files listed in the task scope (follow SBEP if unassigned files are needed).
- Task Sizing: Keep net code diff within 50–150 lines (hard ceiling 200 LoC).
- TDD: Write unit tests first, verify failure, then write minimal passing code.
- Operational Invariants: Consult `docs/operational-edge-cases.md` (rebase-only, DAP for new deps, CI parity).
- Conventional Commits: `feat(spec-XXXX): ...`, `fix(spec-XXXX): ...`, `test(spec-XXXX): ...`.
- Refer to `AGENTS.md`, `ORCHESTRATOR.md`, `WORKER.md`, and `CHALLENGER.md` for role directives.
