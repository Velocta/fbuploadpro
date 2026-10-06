# GitHub Labels Taxonomy for Spec-Driven Development

A clear, color-coded label system is vital for filtering GitHub Issues, Pull Requests, and driving GitHub Projects (v2) automation boards.

---

## 1. Type Labels (`type:*`)
Identifies what kind of work item this is.

| Label | Color | Hex | Description |
| :--- | :--- | :--- | :--- |
| `type:spec` | Blue | `#1D76DB` | Architectural or feature specification in `specs/` |
| `type:task` | Green | `#0E8A16` | Atomic implementation task derived from a spec (<200 LoC) |
| `type:defect` | Red | `#D93F0B` | Bug or deviation from an approved spec contract |
| `type:chore` | Light Gray | `#BFD4F2` | Tooling, build pipeline, or dependency updates |

---

## 2. Phase Labels (`phase:*`)
Tracks the item's progression through the SDD lifecycle.

| Label | Color | Hex | Description |
| :--- | :--- | :--- | :--- |
| `phase:triage` | Yellow | `#FBCA04` | New issue awaiting categorization |
| `phase:spec` | Sky Blue | `#C5DEF5` | Specification drafting and active RFC discussion |
| `phase:spec-approved` | Dark Blue | `#0052CC` | Specification frozen; ready for task breakdown |
| `phase:implementation` | Purple | `#5319E7` | Active coding / implementation phase |
| `phase:review` | Lavender | `#D4C5F9` | PR open; undergoing automated CI & human review |
| `phase:done` | Dark Green | `#0E8A16` | Accepted, verified, and merged |

---

## 3. AI Readiness & State Labels (`ai:*`)
Governs AI agent permissions and execution state.

| Label | Color | Hex | Description |
| :--- | :--- | :--- | :--- |
| `ai:ready` | Green | `#0E8A16` | Fully specified and bounded. AI agents are cleared to execute. |
| `ai:in-progress` | Yellow | `#FBCA04` | AI agent is currently generating branch, tests, and code. |
| `ai:review-needed` | Pink | `#E99695` | AI agent completed task; awaiting human supervisor review. |
| `ai:blocked` | Red | `#D93F0B` | Agent blocked by ambiguity, SBEP request, or task sizing ceiling. |
| `ai:needs-triage` | Pale Green | `#C2E0C6` | Needs human assessment before AI assignment. |

---

## 4. Spec Lifecycle & Review Labels (`spec:*` & `review:*`)

| Label | Color | Hex | Description |
| :--- | :--- | :--- | :--- |
| `spec:draft` | Gray | `#CCCCCC` | Specification currently in draft status |
| `spec:in-review` | Yellow | `#FBCA04` | Specification under peer / agent review |
| `spec:approved` | Green | `#0E8A16` | Specification approved and locked for implementation |
| `spec:stale` | Red | `#D93F0B` | Task or branch generated from an outdated spec commit |
| `spec:challenged` | Red | `#D93F0B` | Spec has pending challenges from Challenger |
| `spec:deprecated` | Dark Gray | `#666666` | Specification deprecated or superseded |
| `review:orchestrator-approved` | Green | `#0E8A16` | Orchestrator 5-point audit passed |
| `review:orchestrator-changes-requested` | Red | `#D93F0B` | Orchestrator requested revisions from Worker |
| `review:challenger-approved` | Green | `#0E8A16` | Challenger authorized final squash merge |
| `review:human-signoff` | Yellow | `#FBCA04` | Awaiting final Human User signoff / tie-breaker |

---

## 5. Multi-Agent Role Labels (`role:*`)
Identifies which tier in the 4-tier model created, owns, or is acting on the item.

| Label | Color | Hex | Description |
| :--- | :--- | :--- | :--- |
| `role:orchestrator` | Purple | `#5319E7` | Assigned to or created by the AI Orchestrator (Tech Lead) |
| `role:worker` | Blue | `#1D76DB` | Assigned to or created by the AI Worker (Engineer) |
| `role:challenger` | Dark Red | `#B60205` | Assigned to or created by the AI Challenger (Principal Arbiter) |

---

## 6. Automated Label Setup
You can provision all of these labels instantly into any GitHub repository using `scripts/setup-github-labels.sh`:

```bash
./scripts/setup-github-labels.sh Velocta/my-coding-style
```
