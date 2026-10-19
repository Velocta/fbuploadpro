#!/usr/bin/env bash
#
# Regression guardrails — fails the PR if any previously-fixed bug pattern regresses.
# Each check prints file:line of violations with a remediation hint.
# Exit 0 = clean, exit 1 = violations found.
#
# Run from the repository root:  bash .github/scripts/regression-guardrails.sh

set -uo pipefail

VIOLATIONS_FILE="$(mktemp)"
trap 'rm -f "$VIOLATIONS_FILE"' EXIT

violation() {
  printf 'VIOLATION: %s\n' "$1" >> "$VIOLATIONS_FILE"
}

# ---------------------------------------------------------------------------
# Check 1: `as any` in API routes (removed 77 in PR #614 — use Record<string, unknown>)
# ---------------------------------------------------------------------------
while IFS= read -r line; do
  violation "as any in API route: ${line} -- use Record<string, unknown> with targeted casts instead"
done < <(grep -rn "as any" apps/web/src/app/api/ --include="*.ts" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Check 2: `throw new Error` in worker (spec 090 — use DomainError from contracts)
# ---------------------------------------------------------------------------
while IFS= read -r line; do
  violation "throw new Error in worker: ${line} -- use DomainError (UnauthorizedError/ValidationError/InternalError) from @fbuploadpro/contracts"
done < <(grep -rn "throw new Error" apps/worker/src/ --include="*.ts" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Check 3: unguarded String(x.id) — the M33 truthy-string bug (spec 092).
# String(undefined) === "undefined" (truthy), so a missing id silently passes
# guards. Only flag when there is NO falsy-guard on x.id in the preceding
# 15 lines (the correct pattern is: if (!x.id) throw ... before String(x.id)).
# ---------------------------------------------------------------------------
while IFS= read -r match; do
  file="${match%%:*}"
  rest="${match#*:}"
  lineno="${rest%%:*}"
  var="$(printf '%s' "$match" | grep -o -E 'String\([a-zA-Z_][a-zA-Z0-9_]*\.id\)' | head -1 | sed -E 's/String\(([a-zA-Z_][a-zA-Z0-9_]*)\.id\)/\1/')"
  [ -z "$var" ] && continue
  start=$(( lineno > 15 ? lineno - 15 : 1 ))
  context="$(sed -n "${start},$((lineno - 1))p" "$file" 2>/dev/null)"
  if ! printf '%s' "$context" | grep -q -E "if \([[:space:]]*![[:space:]]*${var}\\.id|${var}\\.id[[:space:]]*(==|===)[[:space:]]*null|${var}\\.id[[:space:]]*\\?\\?"; then
    violation "unguarded String(${var}.id): ${match} -- add a falsy guard (if (!${var}.id) throw ...) before stringifying"
  fi
done < <(grep -rn -E 'String\([a-zA-Z_][a-zA-Z0-9_]*\.id\)' apps/worker/src/ --include="*.ts" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Check 4: window.confirm / window.alert (audit M26 — use the app modal system)
# ---------------------------------------------------------------------------
while IFS= read -r line; do
  violation "blocking dialog: ${line} -- use the app's modal/dialog components instead of window.confirm/alert"
done < <(grep -rn -E 'window\.(confirm|alert)[[:space:]]*\(' apps/web/src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Check 5: test-only markers in production code without a production guard.
# Files that gate test doubles behind isTestDoubleAllowed()/NODE_ENV checks
# (e.g. apps/web/src/lib/supabase-auth.ts) are the approved pattern and pass.
# ---------------------------------------------------------------------------
GUARD_RE='isTestDoubleAllowed|NODE_ENV !== .production.|assertTestDoubleAllowed'
while IFS= read -r file; do
  if ! grep -q -E "$GUARD_RE" "$file" 2>/dev/null; then
    while IFS= read -r line; do
      violation "test-only marker without production guard: ${line} -- gate test doubles behind isTestDoubleAllowed() (see supabase-auth.ts) or move to tests/helpers/"
    done < <(grep -n -E '__TEST__|__MOCK__|ForTesting' "$file" 2>/dev/null || true)
  fi
done < <(grep -rln -E '__TEST__|__MOCK__|ForTesting' apps/web/src apps/worker/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v '/tests/' | grep -v '\.test\.' || true)

# ---------------------------------------------------------------------------
# Check 6: CSP header present in next.config.ts (spec 087)
# ---------------------------------------------------------------------------
if ! grep -q 'Content-Security-Policy' apps/web/next.config.ts 2>/dev/null; then
  violation "CSP header missing from apps/web/next.config.ts -- the Content-Security-Policy(-Report-Only) header must not be removed"
fi

# ---------------------------------------------------------------------------
# Check 7: console.log in production source (audit M10 — warn/error are fine)
# ---------------------------------------------------------------------------
while IFS= read -r line; do
  violation "console.log in production source: ${line} -- remove it or use the PostHog/error logger"
done < <(grep -rn -E 'console\.log[[:space:]]*\(' apps/web/src apps/worker/src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v '/tests/' | grep -v '\.test\.' || true)

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
count="$(wc -l < "$VIOLATIONS_FILE" | tr -d ' ')"
if [ "$count" -gt 0 ]; then
  cat "$VIOLATIONS_FILE"
  printf '\nFAILED: %s regression-guardrail violation(s). Fix them before merging.\n' "$count"
  exit 1
fi
printf 'PASSED: all regression guardrails clean.\n'
exit 0
