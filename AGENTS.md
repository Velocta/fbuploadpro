# AI Agents Guide

This repository enforces **Spec-Driven Development (SDD)** and structured project tracking for all AI agents, assistants, and sub-agents.

---

## 🚨 Mandatory Engineering Workflow

Every AI agent working in this repository MUST follow this lifecycle:

1. **GitHub Discussions (Ideation & RFCs):**
   - High-level ideas, RFCs, and major milestone announcements must originate or be discussed in **GitHub Discussions** (`Announcements` or `Ideas & Features`) before creating actionable tasks.

2. **Spec Kit (Spec-Driven Development):**
   - **Never write application code without a spec.**
   - Always follow the Spec Kit cycle using available skills in [`.agents/skills/`](.agents/skills/):
     - `/speckit-specify` — Define functional requirements and acceptance criteria.
     - `/speckit-plan` — Define technical architecture, contracts, and data models.
     - `/speckit-tasks` — Decompose the plan into small, atomic tasks (<150–200 LoC).
     - `/speckit-implement` — Implement code driven by unit/integration tests.
     - `/speckit-converge` — Verify that implementation matches the spec before finishing.

3. **GitHub Projects & Issues:**
   - Every implementation task must be tracked as a **GitHub Issue** linked to the project board.
   - Tasks must move through project board stages:
     `Backlog` ➔ `To Do` ➔ `In Progress` ➔ `Awaiting PR` ➔ `Done`
   - Use `/speckit-taskstoissues` to convert spec task breakdowns directly into GitHub Issues.

4. **Pull Requests (PRs):**
   - **Never push code directly to `main`.**
   - All code must be delivered via a dedicated feature branch and **Pull Request**.
   - PRs must explicitly reference and close their associated issue (e.g., `Closes #12`).
   - PRs must include test verification evidence and maintain diff sizes under 200 lines of code.

---

## Agent Configuration Directories

All repository-specific rules, skills, and sub-agent definitions are located in the [`.agents/`](.agents/) directory:

- **Rules (`.agents/rules/`):** Contains repository coding standards, architectural constraints, security guidelines, and behavioral rules that agents must adhere to.
- **Skills (`.agents/skills/`):** Contains domain-specific skills, workflows, automation scripts, and task playbooks (including Spec Kit skills).
- **Sub-Agents (`.agents/agents/`):** Contains role profiles, specialized instructions, and capabilities for discrete sub-agents.

## Instructions for AI Agents

1. **Check Rules:** Before beginning any implementation, inspect [`.agents/rules/`](.agents/rules/) for active standards and constraints.
2. **Consult Skills:** Reference [`.agents/skills/`](.agents/skills/) for predefined playbooks or tool configurations when executing complex tasks.
3. **Sub-Agent Delegation:** Refer to [`.agents/agents/`](.agents/agents/) when delegating work to specialized sub-agents.
