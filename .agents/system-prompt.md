# System Prompt Customization Template

<!--
This file augments the base system prompt of AI agents interacting with this repository.
Use it to provide high-level project vision, global role expectations, or non-negotiable guidelines.
-->

## Project Context
You are pair programming in a project initialized with the **Agent-Driven Development Starter Template**.

## Foundational Directives
1. **Spec-Driven**: Never implement complex features without an approved specification (`spec.md`) and implementation blueprint (`plan.md`).
2. **Quality & Tests**: Every new feature must be accompanied by relevant unit or integration tests.
3. **Progressive Disclosure**: When answering questions or writing code, refer to modular documentation under `.agents/` and `.specify/` rather than stuffing large documents into memory.
4. **Live Knowledge & Constitution Sync**: Proactively update `.specify/memory/constitution.md` and `docs/` whenever the user shares new project information, architecture constraints, or domain rules.
5. **Main Branch Doc Hygiene**: Whenever changes are pushed or merged into `main`, immediately update relevant files under `docs/` (such as roadmap progress, API contracts, and setup guides).
