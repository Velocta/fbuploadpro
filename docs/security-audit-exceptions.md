# Dependency audit exceptions

The CI **Dependency Audit** job (`pnpm audit --audit-level=moderate`) is a
required check on `main`. The advisories listed in
`package.json → pnpm.auditConfig.ignoreGhsas` are the **only** accepted
exceptions. Every exception must be recorded here with its rationale and its
removal condition. An exception without a live entry in this file is not
authorised — remove it from `ignoreGhsas` instead.

Note: `ignoreGhsas` is GHSA-scoped, not path-scoped — an entry suppresses that
advisory wherever it appears in the tree, which is why each entry below argues
reachability for the whole tree, not one dependency path.

## GHSA-vfj7-8cjw-p6xm — braces (high)

- **Package:** `braces@3.0.3`, reached only through dev tooling
  (`@next/eslint-plugin-next`); it is not shipped in any production bundle.
- **Status:** no patched `braces` release exists.
- **Removal condition:** delete this entry the day a fixed `braces` release
  ships and the tree resolves to it.

## GHSA-mrhx-c7xc-m3w5 — zod (high) — CVE-2023-54404

- **Package:** `zod@3.25.76` (the final zod 3.x release), used across
  `packages/contracts`, `apps/web`, and `apps/worker`.
- **Advisory:** uncontrolled resource consumption in zod's array validation —
  parsing a very large, mostly-invalid array accumulates one validation issue
  per failing element with no cap, so a sufficiently large payload can exhaust
  memory (OOM) inside the parsing process.
- **No patched 3.x exists.** The vulnerable range is `< 4.6.6`; the first
  patched release is **zod 4.6.6**, on the v4 line only. Our manifests pin
  `zod: ^3.24.2`, which can never resolve to a fix.
- **Exception approved:** Shahzeb, 2026-10-24 ("A plus B" — exception now,
  zod v4 migration as its own spec in the completion sweep).

### Reachability argument

Zod **is** runtime code here — it validates request bodies and
`platform_options` across web routes and the worker — so this exception does
**not** rest on zod being unreachable. It rests on the specific flaw being
impractical to exploit in this codebase:

- The flaw needs an attacker-controlled, very large, mostly-invalid array to
  reach a zod parse.
- Every tenant API route that parses bodies requires an authenticated session
  and sits behind per-IP rate limiting.
- The body-parsing routes that use `readJsonBody` (spec 139, #719) enforce a
  streaming hard cap — **64 KiB by default, 1 MiB for bulk endpoints** —
  *before* JSON parsing or zod ever sees the payload; oversized declared
  lengths are rejected unread.
- Routes that still parse directly are bounded by the hosting platform's
  request-body ceiling (~4.5 MB on Vercel), so the worst case is a transient
  memory spike inside one isolated, memory-capped serverless invocation —
  not a shared-process kill.
- The highest-volume array inputs are additionally schema-capped
  (`.max(150)` for bulk items, `.max(500)` for media/duplicate-check arrays).
- Worker-side parses are fed by our own validated database rows and
  platform-capped queue messages, and by platform server-to-server
  responses — not by attacker-controlled input.

Residual risk: an authenticated tenant deliberately spamming multi-MB
invalid arrays against the rate limits; blast radius is a single invocation.

### Removal condition

**This exception is deleted in the same PR that lands the zod v4 migration
(zod `^4.6.6+`).** It is a bridge to that migration, not a permanent
acceptance of the advisory: if the v4 migration has not landed, this entry
must be re-argued — never silently renewed or left to become permanent.
