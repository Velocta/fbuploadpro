#!/usr/bin/env bash
# Sets up standardized Spec-Driven Development labels in a GitHub repository using gh CLI.
set -euo pipefail

REPO="${1:-}"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ Error: GitHub CLI (gh) is not installed. Please install it first: https://cli.github.com" >&2
  exit 1
fi

if [ -z "$REPO" ]; then
  # Try to detect from gh repo view or git remote
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
fi

if [ -z "$REPO" ]; then
  # Try to detect from git remote (supports HTTPS/SSH, with/without .git)
  REPO=$(git config --get remote.origin.url 2>/dev/null | sed -E 's/.*github\.com[:\/]([^/]+\/[^/]+)(\.git)?$/\1/' | sed 's/\.git$//' || true)
fi

if [ -z "$REPO" ]; then
  echo "Usage: $0 <owner/repo>"
  echo "Example: $0 Velocta/my-coding-style"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "⚠️ Warning: GitHub CLI is not authenticated. Run 'gh auth login' if label creation fails." >&2
fi

echo "🏷️ Setting up Spec-Driven Development labels for: $REPO"

FAILED_COUNT=0

# Function to safely create or update label
create_label() {
  local name="$1"
  local color="$2"
  local desc="$3"
  echo "  Creating/Updating: $name ($color)..."
  if ! gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" --force >/dev/null 2>&1; then
    echo "    ⚠️ Warning: Failed to create or update label '$name'." >&2
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
}

# Type Labels
create_label "type:spec" "1D76DB" "Architectural or feature specification in specs/"
create_label "type:task" "0E8A16" "Atomic implementation task derived from a spec (<200 LoC)"
create_label "type:defect" "D93F0B" "Bug or deviation from an approved spec contract"
create_label "type:chore" "BFD4F2" "Tooling, build pipeline, or dependency updates"

# Phase Labels
create_label "phase:triage" "FBCA04" "New issue awaiting categorization"
create_label "phase:spec" "C5DEF5" "Specification drafting and active RFC discussion"
create_label "phase:spec-approved" "0052CC" "Specification frozen; ready for task breakdown"
create_label "phase:implementation" "5319E7" "Active coding / implementation phase"
create_label "phase:review" "D4C5F9" "PR open; undergoing automated CI & human review"
create_label "phase:done" "0E8A16" "Accepted, verified, and merged"

# AI Readiness Labels
create_label "ai:ready" "0E8A16" "Fully specified and bounded. AI agents are cleared to execute."
create_label "ai:in-progress" "FBCA04" "AI agent is currently generating branch, tests, and code."
create_label "ai:review-needed" "E99695" "AI agent completed task; awaiting human supervisor review."
create_label "ai:blocked" "D93F0B" "Agent blocked by ambiguity, missing credentials, or dependencies."
create_label "ai:needs-triage" "C2E0C6" "Needs human assessment before AI assignment."

# Spec Status Labels
create_label "spec:draft" "CCCCCC" "Specification currently in draft status"
create_label "spec:in-review" "FBCA04" "Specification under peer / agent review"
create_label "spec:approved" "0E8A16" "Specification approved and locked for implementation"
create_label "spec:stale" "D93F0B" "Task or branch generated from an outdated spec commit"
create_label "spec:deprecated" "666666" "Specification deprecated or superseded"

# Multi-Agent Role & Review Labels
create_label "role:orchestrator" "5319E7" "Assigned to or created by the AI Orchestrator (Tech Lead)"
create_label "role:worker" "1D76DB" "Assigned to or created by the AI Worker (Engineer)"
create_label "role:challenger" "B60205" "Assigned to or created by the AI Challenger (Principal Arbiter)"
create_label "spec:challenged" "D93F0B" "Spec has pending challenges/revisions from Challenger"
create_label "review:orchestrator-approved" "0E8A16" "AI Orchestrator verified spec conformance and passed anti-slop audit"
create_label "review:orchestrator-changes-requested" "D93F0B" "AI Orchestrator requested revisions from Worker"
create_label "review:challenger-approved" "0E8A16" "AI Challenger verified architectural integrity and authorized merge"
create_label "review:human-signoff" "FBCA04" "All automated gates passed; awaiting final User approval & merge"

if [ "$FAILED_COUNT" -eq 0 ]; then
  echo "✅ All labels configured successfully on $REPO!"
else
  echo "⚠️ Finished with $FAILED_COUNT label warning(s). Check repository permissions and gh authentication."
fi
