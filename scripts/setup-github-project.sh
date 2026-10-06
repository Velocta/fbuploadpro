#!/usr/bin/env bash
# Sets up a standardized Spec-Driven Development GitHub Project (v2) Kanban board using gh CLI.
set -euo pipefail

REPO="${1:-}"
TITLE="${2:-AI Mission Control}"
OWNER="${3:-}"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ Error: GitHub CLI (gh) is not installed. Please install it first: https://cli.github.com" >&2
  exit 1
fi

if [ -z "$REPO" ]; then
  # Try to detect from gh repo view or git remote
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
fi

if [ -z "$REPO" ]; then
  REPO=$(git config --get remote.origin.url 2>/dev/null | sed -E 's/.*github\.com[:\/]([^/]+\/[^/]+)(\.git)?$/\1/' | sed 's/\.git$//' || true)
fi

if [ -z "$REPO" ]; then
  echo "Usage: $0 [owner/repo] [project_title] [owner_login]"
  echo "Example: $0 Velocta/my-coding-style \"AI Mission Control\" Velocta"
  exit 1
fi

if [ -z "$OWNER" ]; then
  # Default owner to repo organization or repo owner
  OWNER=$(echo "$REPO" | cut -d'/' -f1)
fi

echo "📋 Setting up GitHub Project (v2) '$TITLE' for owner: $OWNER (Repo: $REPO)..."

# Preflight check for project scope
if ! gh auth status 2>&1 | grep -q "project"; then
  echo "⚠️ Notice: GitHub CLI requires the 'project' scope to manage GitHub Projects (v2)."
  echo "👉 If this script fails with a permissions error, run: gh auth refresh -s project"
  echo ""
fi

# 1. Create the GitHub Project
echo "1️⃣ Creating Project (v2)..."
CREATE_OUTPUT=$(gh project create --owner "$OWNER" --title "$TITLE" --format json 2>&1) || {
  echo "❌ Failed to create project for owner '$OWNER'." >&2
  echo "Details: $CREATE_OUTPUT" >&2
  echo "Tip: Run 'gh auth refresh -s project' to grant project permissions." >&2
  exit 1
}

PROJECT_NUM=$(echo "$CREATE_OUTPUT" | gh --version >/dev/null 2>&1 && echo "$CREATE_OUTPUT" | grep -o '"number":[0-9]*' | head -1 | cut -d':' -f2)
PROJECT_URL=$(echo "$CREATE_OUTPUT" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PROJECT_NUM" ]; then
  echo "❌ Could not parse project number from output: $CREATE_OUTPUT" >&2
  exit 1
fi

echo "  ✅ Created Project #$PROJECT_NUM: $PROJECT_URL"

# 2. Link Project to the Repository
echo "2️⃣ Linking Project #$PROJECT_NUM to repository $REPO..."
if gh project link "$PROJECT_NUM" --owner "$OWNER" --repo "$REPO" >/dev/null 2>&1; then
  echo "  ✅ Linked successfully."
else
  echo "  ⚠️ Warning: Could not automatically link project to repo (may require repo admin permissions)."
fi

# 3. Create Custom Fields
echo "3️⃣ Configuring Custom Metadata Fields..."

create_field() {
  local name="$1"
  local type="$2"
  local options="${3:-}"
  echo "  Adding field: '$name' ($type)..."
  if [ -n "$options" ]; then
    gh project field-create "$PROJECT_NUM" --owner "$OWNER" --name "$name" --data-type "$type" --single-select-options "$options" >/dev/null 2>&1 || true
  else
    gh project field-create "$PROJECT_NUM" --owner "$OWNER" --name "$name" --data-type "$type" >/dev/null 2>&1 || true
  fi
}

create_field "Phase" "SINGLE_SELECT" "0. Idea,1. Spec RFC,2. Spec Review,3. Spec Approved,4. Task Breakdown,5. Implementation,6. Review & QA,7. Done"
create_field "AI Readiness" "SINGLE_SELECT" "Drafting,Spec Needed,AI-Ready,AI Executing,Human Review,Blocked"
create_field "Agent Assigned" "SINGLE_SELECT" "Unassigned,Antigravity,Claude Code,Copilot,Human Engineer"
create_field "Spec ID" "TEXT"
create_field "Complexity" "SINGLE_SELECT" "XS (<50 LoC),S (50-150 LoC),M (150-200 LoC),L (>200 LoC - Split Required)"

# 4. Upgrade Status Field to 8 SDD Stages
echo "4️⃣ Upgrading Status field options to 8 SDD stages..."
STATUS_FIELD_ID=$(gh project field-list "$PROJECT_NUM" --owner "$OWNER" --format json -q '.fields[] | select(.name=="Status") | .id' 2>/dev/null || true)

if [ -n "$STATUS_FIELD_ID" ]; then
  gh api graphql -f query='
  mutation($fieldId: ID!) {
    updateProjectV2Field(input: {
      fieldId: $fieldId
      name: "Status"
      singleSelectOptions: [
        { name: "📥 Backlog", color: GRAY, description: "Unrefined feature requests and ideas" },
        { name: "📐 Spec Drafting", color: BLUE, description: "Orchestrator drafting technical spec" },
        { name: "⚔️ Challenger Review", color: ORANGE, description: "Adversarial spec review" },
        { name: "🟢 Ready for Worker", color: GREEN, description: "Tasks ready for AI worker" },
        { name: "⚡ Worker Active", color: YELLOW, description: "Worker implementing via TDD" },
        { name: "🔍 Orchestrator Review", color: PURPLE, description: "PR undergoing 5-point review" },
        { name: "👑 Challenger Merge Gate", color: RED, description: "Final pre-merge audit" },
        { name: "✅ Done", color: GREEN, description: "Completed and merged" }
      ]
    }) {
      projectV2Field {
        ... on ProjectV2SingleSelectField {
          name
        }
      }
    }
  }' -F fieldId="$STATUS_FIELD_ID" >/dev/null 2>&1 || echo "  ⚠️ Notice: Status options could not be updated via GraphQL."
  echo "  ✅ Status field upgraded to 8 SDD stages."
fi

echo ""
echo "============================================================"
echo "🎉 GitHub Project #$PROJECT_NUM Setup Complete!"
echo "🔗 URL: $PROJECT_URL"
echo ""
echo "Next Steps in the GitHub Web UI:"
echo "  1. Open $PROJECT_URL"
echo "  2. Switch the default view layout to 'Board' (Kanban)."
echo "  3. In Project Settings -> Workflows, enable 'Auto-add items from $REPO'."
echo "============================================================"
