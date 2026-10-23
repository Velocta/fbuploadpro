#!/usr/bin/env bash
#
# Fixture tests for Check 10 (Tailwind arbitrary-value ban) — spec 129
# multi-line hardening.
#
# Builds two synthetic repo trees and runs the REAL regression-guardrails
# script in each:
#
#   bad/  — plants arbitrary values on CONTINUATION lines of multi-line
#           className expressions (the old line-based scanner only ever
#           saw the line carrying the word `className`, so every one of
#           these slipped through). The run must exit 1 and report each
#           planted token via Check 10.
#   good/ — legitimate multi-line code (long cn(...) calls with token
#           classes, attribute variants, template literals) plus the four
#           baseline-named arbitrary-allow exceptions from the real tree
#           (sidebar.tsx transition-[...] classes). Must exit 0.
#
# Usage:
#   bash .github/scripts/tests/check-10-multiline.sh
#
# To demonstrate the pre-fix hole, point GUARDRAILS at the old script:
#   git show <pre-fix-commit>:.github/scripts/regression-guardrails.sh > /tmp/old.sh
#   GUARDRAILS=/tmp/old.sh bash .github/scripts/tests/check-10-multiline.sh
# The bad-tree assertions then FAIL (the old scanner passes the bad tree),
# which is exactly the blind spot this hardening closes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
GUARDRAILS="${GUARDRAILS:-$REPO_ROOT/.github/scripts/regression-guardrails.sh}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAILURES=0
note_fail() { printf 'FIXTURE FAIL: %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
note_ok() { printf 'fixture ok: %s\n' "$1"; }

# ---------------------------------------------------------------------------
# Skeleton every fixture tree needs so the OTHER guardrail checks pass:
# check 6 wants the CSP string in next.config.ts; check 8 wants the
# inline-style ratchet (fixtures contain no style={{, so 0); check 9 wants
# the design-system baseline file (fixtures plant no hex/rgb/fontsize/
# zindex/!important literals, so only arbitrary-allow lines are needed);
# check 12 wants the silent-failure baseline file (fixtures plant no
# silent-failure patterns, so a comments-only baseline passes).
# ---------------------------------------------------------------------------
scaffold() {
  local root="$1"
  mkdir -p "$root/apps/web/src"
  printf 'const marker = "Content-Security-Policy";\nexport default marker;\n' > "$root/apps/web/next.config.ts"
  printf '0\n' > "$root/apps/web/inline-style-ratchet.txt"
  cat > "$root/apps/web/design-system-baseline.txt" <<'EOF'
# Fixture baseline: only the arbitrary-allow exception lines, mirroring
# the four named exceptions in the real apps/web/design-system-baseline.txt.
arbitrary-allow apps/web/src/components/shared/ui/sidebar.tsx transition-[width]
arbitrary-allow apps/web/src/components/shared/ui/sidebar.tsx transition-[left,right,width]
arbitrary-allow apps/web/src/components/shared/ui/sidebar.tsx transition-[margin,opacity]
arbitrary-allow apps/web/src/components/shared/ui/sidebar.tsx transition-[width,height,padding]
EOF
  # Check 12 (spec 137) wants the silent-failure baseline file; fixtures
  # plant no silent-failure patterns, so a comments-only baseline passes.
  printf '# Fixture baseline: no silent-failure occurrences in this tree.\n' > "$root/apps/web/silent-failure-baseline.txt"
  # Check 13 (spec 137 PR-A1b) wants the localStorage baseline file; fixtures
  # plant no localStorage usages, so a comments-only baseline passes.
  printf '# Fixture baseline: no localStorage occurrences in this tree.\n' > "$root/apps/web/localstorage-baseline.txt"
  # Checks 14/15 (spec 137 PR-A4) want the any/img baseline files; fixtures
  # plant no type-position any and no raw <img>, so comments-only passes.
  printf '# Fixture baseline: no type-position any occurrences in this tree.\n' > "$root/apps/web/any-baseline.txt"
  printf '# Fixture baseline: no raw img elements in this tree.\n' > "$root/apps/web/img-baseline.txt"
}

run_guardrails() {
  # $1 = tree root; prints combined output; returns the script's exit code.
  (cd "$1" && bash "$GUARDRAILS" 2>&1)
}

# ---------------------------------------------------------------------------
# BAD tree — every violation sits on a continuation line (or, for parity,
# one single-line case the old scanner already caught).
# ---------------------------------------------------------------------------
BAD="$WORK/bad"
scaffold "$BAD"
mkdir -p "$BAD/apps/web/src/fixtures"
cat > "$BAD/apps/web/src/fixtures/bad-multiline.tsx" <<'EOF'
import { cn } from "@/lib/utils";

export function BadMultiline({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center",
        "text-[13px]",
        "transition-[opacity,transform]",
        className
      )}
    >
      <span
        className={`
          block
          w-[37px]
        `}
      />
      <span
        className={cn(
          "data-[state=open]:text-[9px]",
          "[mask-type:luminance]"
        )}
      />
      <span className="bg-brand flex!" />
    </div>
  );
}
EOF
# Notes on the plants:
#  - transition-[opacity,transform] is the same SHAPE as the sidebar's
#    allowlisted classes but in a file with no exception: the allowlist is
#    per file + exact token, so it must still fail.
#  - "bg-brand flex!" is single-line (old scanner caught it — parity case).

bad_out="$(run_guardrails "$BAD")"
bad_rc=$?
if [ "$bad_rc" -ne 1 ]; then
  note_fail "bad tree: expected guardrails exit 1, got $bad_rc"
else
  note_ok "bad tree: guardrails exit 1"
fi
for token in 'text-[13px]' 'w-[37px]' 'text-[9px]' '[mask-type:luminance]' 'transition-[opacity,transform]' 'flex!'; do
  if printf '%s' "$bad_out" | grep -qF "$token"; then
    note_ok "bad tree: violation reported for $token"
  else
    note_fail "bad tree: no violation reported for planted token $token"
  fi
done
if printf '%s' "$bad_out" | grep -qF 'Tailwind arbitrary value / important modifier banned'; then
  note_ok "bad tree: violations carry the Check 10 message"
else
  note_fail "bad tree: Check 10 violation message missing"
fi

# ---------------------------------------------------------------------------
# GOOD tree — legitimate multi-line code + the named baseline exceptions.
# ---------------------------------------------------------------------------
GOOD="$WORK/good"
scaffold "$GOOD"
mkdir -p "$GOOD/apps/web/src/components/shared/ui" "$GOOD/apps/web/src/fixtures"
cat > "$GOOD/apps/web/src/components/shared/ui/sidebar.tsx" <<'EOF'
import { cn } from "@/lib/utils";

export function SidebarBits({ className }: { className?: string }) {
  return (
    <div>
      <div
        className={cn(
          "relative w-64 bg-transparent transition-[width] duration-base ease-standard",
          "group-data-[collapsible=icon]:w-16",
          className
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 z-sticky hidden h-svh w-64 transition-[left,right,width] duration-base ease-standard md:flex",
          "transition-[margin,opacity]",
          "transition-[width,height,padding]"
        )}
      />
    </div>
  );
}
EOF
cat > "$GOOD/apps/web/src/fixtures/good-multiline.tsx" <<'EOF'
import { cn } from "@/lib/utils";

/* className="text-[13px]" in a comment is prose, not a class attribute. */
export function GoodMultiline({ className }: { className?: string }) {
  return (
    <section>
      <p>Don&apos;t have an account yet?</p>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2",
          "data-[state=open]:bg-hover data-[inset]:pl-8",
          "group-data-[collapsible=icon]:w-16 [&_svg]:size-4",
          className
        )}
      />
      <div
        className={`
          grid gap-4
          ${className ? "opacity-100" : "opacity-75"}
        `}
      />
      <div
        className={
          "w-full max-w-lg text-body text-ink"
        }
      />
      <span className={className} />
    </section>
  );
}
EOF

good_out="$(run_guardrails "$GOOD")"
good_rc=$?
if [ "$good_rc" -ne 0 ]; then
  note_fail "good tree: expected guardrails exit 0, got $good_rc"
  printf '%s\n' "$good_out"
else
  note_ok "good tree: guardrails exit 0 (multi-line legit code + named exceptions pass)"
fi

# ---------------------------------------------------------------------------
if [ "$FAILURES" -gt 0 ]; then
  printf '\nCHECK 10 FIXTURES: %s assertion(s) failed.\n' "$FAILURES"
  exit 1
fi
printf '\nCHECK 10 FIXTURES: all assertions passed.\n'
exit 0
