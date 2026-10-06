#!/usr/bin/env bash
# Velocta Spec-Driven Development: Autonomous Work Detection & Self-Dispatch Script
# Queries GitHub to find pending tasks for Orchestrator, Worker, and Challenger roles.

set -euo pipefail

ROLE="$(echo "${1:-all}" | tr '[:upper:]' '[:lower:]')"
REPO="${2:-}"

case "$ROLE" in
  all|challenger|orchestrator|worker|human|user|executive) ;;
  *)
    echo "⚠️ Warning: Unknown role '$ROLE'. Valid roles: all, orchestrator, worker, challenger, human." >&2
    ;;
esac

if [ -z "$REPO" ]; then
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
fi

if [ -z "$REPO" ]; then
  REPO=$(git config --get remote.origin.url 2>/dev/null | sed -E 's/.*github\.com[:\/]([^/]+\/[^/]+)(\.git)?\/?$/\1/' | sed 's/\.git$//' || true)
fi

if [ -z "$REPO" ]; then
  REPO="Velocta/my-coding-style"
fi

echo "🔍 Scanning for pending work on $REPO (Role Filter: $ROLE)..."
echo "============================================================"

# Helper function to query issues via gh
query_issues() {
  local label="$1"
  local description="$2"
  echo ""
  echo "📋 $description:"
  gh issue list --repo "$REPO" --label "$label" --state open --json number,title,labels,assignees \
    --template '{{range .}}  #{{.number}} - {{.title}} (Assignees: {{range .assignees}}{{.login}} {{else}}none{{end}})
{{else}}  (No items found)
{{end}}' 2>/dev/null || echo "  (gh issue list unavailable)"
}

# Helper function to query PRs via gh
query_prs() {
  local label="$1"
  local description="$2"
  echo ""
  echo "🔀 $description:"
  gh pr list --repo "$REPO" --label "$label" --state open --json number,title,labels,headRefName \
    --template '{{range .}}  PR #{{.number}} - {{.title}} (Branch: {{.headRefName}})
{{else}}  (No items found)
{{end}}' 2>/dev/null || echo "  (gh pr list unavailable)"
}

# 0. EXECUTIVE / HUMAN DECISION QUEUE
if [ "$ROLE" = "all" ] || [ "$ROLE" = "human" ] || [ "$ROLE" = "user" ] || [ "$ROLE" = "executive" ]; then
  echo ""
  echo "👑 [EXECUTIVE / HUMAN DECISION QUEUE]"
  query_issues "review:human-signoff" "Issues Requiring Executive Tie-Breaker / Human Decision"
  query_prs "review:human-signoff" "PRs Requiring Executive Tie-Breaker / Human Sign-off"
  query_issues "phase:triage" "📥 Human Backlog (Feature Ideas / RFCs Curated by Human)"
fi

# 1. CHALLENGER WORK
if [ "$ROLE" = "all" ] || [ "$ROLE" = "challenger" ]; then
  echo ""
  echo "⚔️ [CHALLENGER QUEUE]"
  query_prs "review:orchestrator-approved" "PRs Ready for Final Challenger Audit & Squash Merge"
  query_issues "spec:in-review" "Draft Specification Issues Needing Adversarial Challenge"
  query_prs "spec:in-review" "Draft Specification PRs Needing Adversarial Challenge"
fi

# 2. ORCHESTRATOR WORK
if [ "$ROLE" = "all" ] || [ "$ROLE" = "orchestrator" ]; then
  echo ""
  echo "📐 [ORCHESTRATOR QUEUE]"
  query_issues "ai:blocked" "Blocked Tasks Needing Scope Extension (SBEP) or Task Split"
  query_prs "phase:review" "Worker PRs Awaiting Orchestrator Anti-Slop Audit"
  query_issues "spec:approved" "Approved Specs Needing Micro-Task Breakdown (<150-200 LoC)"
fi

# 3. WORKER WORK
if [ "$ROLE" = "all" ] || [ "$ROLE" = "worker" ]; then
  echo ""
  echo "⚡ [WORKER QUEUE]"
  query_issues "ai:ready" "Ready Implementation Tasks (Worker Inbox)"
  query_prs "review:orchestrator-changes-requested" "PRs With Changes Requested by Orchestrator"
fi

echo ""
echo "============================================================"
echo "💡 Self-Dispatch Actions:"
echo "  • Human: Resolve tie-breakers on items with 'review:human-signoff'."
echo "  • Challenger: Merge approved PRs or challenge draft specs."
echo "  • Orchestrator: Decompose approved specs or audit open PRs."
echo "  • Worker: Claim the top 'ai:ready' issue, follow TDD, and open PR."
