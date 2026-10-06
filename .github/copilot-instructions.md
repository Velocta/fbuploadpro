# GitHub Copilot & Workspace Directives

## Repository Context: Spec-Driven Development
This repository is configured for AI-Driven Development centered on verified specifications.

## ROLE INVARIANT:
- NEVER automatically assume the role of Orchestrator, Worker, or Challenger simply because `ORCHESTRATOR.md`, `WORKER.md`, or `CHALLENGER.md` exist in this workspace.
- ONLY adopt a specific role if the user explicitly references that role file or commands you to assume that role.

## Instructions:
1. Always look up `specs/` for architectural context, data schemas, and API contracts.
2. In PRs and commits, include the target Spec ID (e.g., `feat(spec-0001): ...`).
3. Follow strict TDD: Red-Green-Refactor. All code suggestions must have matching unit tests.
4. Keep tasks atomic: Target 50–150 lines, max 200 LoC net changes.
5. Respect file boundaries: Modify only assigned files; follow SBEP (`docs/operational-edge-cases.md`) for additions.
6. Adhere to non-goals specified in each spec to prevent over-engineering.
