# Documentation Index

Shared documentation for the FBUploadPro monorepo.

## Sections

| Directory | Contents |
|-----------|----------|
| `architecture/` | System boundaries and data flow |
| `database/` | Migration workflow and RLS overview |
| `adr/` | Architectural decision records |
| `runbooks/` | Deploy, env, posting operations, InApp schedule |
| `webapp/` | Webapp architecture, API reference, performance, UI/UX |

## For AI agents

Start with **[`for_agent.md`](for_agent.md)** — consolidated product, architecture, boundaries, and conventions for working in this repo.

## Reading order for new contributors

1. [`for_agent.md`](for_agent.md) or [`architecture/system-overview.md`](architecture/system-overview.md)
2. [`database/migration-workflow.md`](database/migration-workflow.md)
3. [`database/rls-overview.md`](database/rls-overview.md)
4. [`../backend_v3/README.md`](../backend_v3/README.md)
5. [`runbooks/environment.md`](runbooks/environment.md)
6. [`runbooks/deployment.md`](runbooks/deployment.md)
7. [`runbooks/posting-deploy.md`](runbooks/posting-deploy.md)
8. [`runbooks/posting-observability.md`](runbooks/posting-observability.md)
9. [`webapp/architecture.md`](webapp/architecture.md)
10. [`webapp/ui-ux-reference.md`](webapp/ui-ux-reference.md)
11. [`webapp/api-reference.md`](webapp/api-reference.md)
12. Relevant ADRs in `adr/`

## Posting operations (ADU)

- [`runbooks/posting-deploy.md`](runbooks/posting-deploy.md)
- [`runbooks/posting-test-injection.md`](runbooks/posting-test-injection.md)
- [`runbooks/posting-rollback.md`](runbooks/posting-rollback.md)
- [`runbooks/posting-replay-repair.md`](runbooks/posting-replay-repair.md)
- [`runbooks/posting-observability.md`](runbooks/posting-observability.md)
