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
# Check 8: inline-style ratchet (spec 129 §5.4 / T15).
# The count of `style={{` occurrences across apps/web/src may only go DOWN.
# A drop must update apps/web/inline-style-ratchet.txt in the same PR, so the
# recorded number can never silently loosen.
# ---------------------------------------------------------------------------
RATCHET_FILE="apps/web/inline-style-ratchet.txt"
if [ -f "$RATCHET_FILE" ]; then
  ratchet="$(grep -vE '^[[:space:]]*(#|$)' "$RATCHET_FILE" | tr -d '[:space:]')"
  style_count="$(grep -ro 'style={{' --include='*.ts' --include='*.tsx' apps/web/src 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$style_count" -gt "$ratchet" ]; then
    violation "inline-style ratchet INCREASED: ${style_count} style={{ occurrences (ratchet is ${ratchet}) -- convert the surface to tokens/primitives instead of adding inline styles (spec 129)"
  elif [ "$style_count" -lt "$ratchet" ]; then
    violation "inline-style ratchet STALE: count dropped to ${style_count} -- update apps/web/inline-style-ratchet.txt to ${style_count} in this PR (spec 129 T15)"
  fi
else
  violation "inline-style ratchet file missing: apps/web/inline-style-ratchet.txt (spec 129 T15)"
fi

# ---------------------------------------------------------------------------
# Check 9: design-system literal baseline freeze (spec 129 §5.4 / T14).
# Hex / rgb() / hsl() literals, raw px font-sizes, ad-hoc numeric z-index and
# !important are banned in apps/web/src. Pre-existing legacy occurrences are
# frozen per file+category in apps/web/design-system-baseline.txt: any
# increase, any new file, and any unrecorded decrease fails. Exempt: the
# generated files (lib/theme.ts, styles/tokens.generated.css — guarded by
# tokens:check) and globals.css (check 11 covers it — it must stay at zero).
# ---------------------------------------------------------------------------
DS_BASELINE="apps/web/design-system-baseline.txt"
HEX_PAT='#[0-9a-fA-F]{3,8}\b'
RGB_PAT='\b(rgba?|hsla?)[[:space:]]*\('
FONTSIZE_PAT="(fontSize:[[:space:]]*[\"'][0-9]+(\.[0-9]+)?px|font-size:[[:space:]]*[0-9]+(\.[0-9]+)?px)"
ZINDEX_PAT='(zIndex:[[:space:]]*-?[0-9]+|z-index:[[:space:]]*-?[0-9]+)'
IMPORTANT_PAT='!important'
if [ -f "$DS_BASELINE" ]; then
  DS_CURRENT="$(mktemp)"
  for spec in "hex|$HEX_PAT" "rgb|$RGB_PAT" "fontsize|$FONTSIZE_PAT" "zindex|$ZINDEX_PAT" "important|$IMPORTANT_PAT"; do
    cat_name="${spec%%|*}"
    cat_pat="${spec#*|}"
    grep -roE "$cat_pat" --include='*.ts' --include='*.tsx' apps/web/src 2>/dev/null \
      | grep -v 'src/lib/theme.ts' \
      | cut -d: -f1 | sort | uniq -c \
      | awk -v c="$cat_name" '{print c, $2, $1}' >> "$DS_CURRENT"
  done
  sort -o "$DS_CURRENT" "$DS_CURRENT"
  DS_BASE_SORTED="$(mktemp)"
  grep -E '^(hex|rgb|fontsize|zindex|important)[[:space:]]' "$DS_BASELINE" | sort > "$DS_BASE_SORTED"
  while IFS= read -r change; do
    [ -z "$change" ] && continue
    kind="$(printf '%s' "$change" | awk '{print $1}')"
    cat_name="$(printf '%s' "$change" | awk '{print $2}')"
    fname="$(printf '%s' "$change" | awk '{print $3}')"
    old_n="$(printf '%s' "$change" | awk '{print $4}')"
    new_n="$(printf '%s' "$change" | awk '{print $5}')"
    if [ "$kind" = "INCREASE" ]; then
      violation "design-system literal ban (${cat_name}): ${fname} has ${new_n} occurrence(s), baseline is ${old_n} -- use design tokens / token-backed utilities (spec 129 §5.4); do not raise the baseline"
    else
      violation "design-system baseline STALE (${cat_name}): ${fname} dropped from ${old_n} to ${new_n} -- update apps/web/design-system-baseline.txt in this PR (spec 129 T14)"
    fi
  done < <(awk '
    NR==FNR { base[$1" "$2]=$3; seen[$1" "$2]=1; next }
    { cur[$1" "$2]=$3; seen[$1" "$2]=1 }
    END { for (k in seen) { b=base[k]+0; c=cur[k]+0;
      if (c>b) print "INCREASE", k, b, c; else if (c<b) print "DECREASE", k, b, c } }
  ' "$DS_BASE_SORTED" "$DS_CURRENT")
  rm -f "$DS_CURRENT" "$DS_BASE_SORTED"
else
  violation "design-system baseline file missing: apps/web/design-system-baseline.txt (spec 129 T14)"
fi

# ---------------------------------------------------------------------------
# Check 10: Tailwind arbitrary values + important-modifier classes banned
# (spec 129 §5.4 / OD-6). Bracket-form values (text-[13px], bg-[#fad734],
# z-[9999], arbitrary spacing/colour/size) and `!` important modifiers in
# className strings fail; only token-backed utilities and the token scales
# may be used. Exceptions need an `arbitrary-allow <file> <token>` line with
# a reason in apps/web/design-system-baseline.txt.
# ---------------------------------------------------------------------------
while IFS= read -r match; do
  file="${match%%:*}"
  cleaned="$(printf '%s' "$match" | sed -E 's/\$\{[^}]*\}//g')"
  # Tokenize WITHOUT splitting on "=" (PR-F3 fix): attribute-variant brackets
  # (data-[state=open]:, data-[side=top]:, group-data-[collapsible=icon]:)
  # legitimately contain "=" and are variants, not values (spec 129 §5.4,
  # PR-F3 coordinator ruling). The old "[^...<>=]+" pattern mangled such a
  # token to "data-[state", flagged it, and made it un-allowlistable.
  # Delimiters here are quotes, backticks, braces, parens, commas and angle
  # brackets; whitespace splitting happens via word expansion.
  for tok in $(printf '%s' "$cleaned" | tr "\"'\`{}(),<>" ' ' || true); do
    case "$tok" in
      *' '*|'') continue ;;
    esac
    # Strip attribute-variant bracket segments before testing: the ban
    # targets arbitrary VALUES; the utility a permitted variant modifies is
    # still checked once its variant segment is removed (so
    # data-[state=open]:text-[13px] still fails). Two variant forms exist:
    # attribute-with-value ([...=...], e.g. data-[state=open]:) and the
    # boolean-presence form of data-/aria- variants (data-[inset]:,
    # data-[disabled]:, group-data-[collapsible=icon]: is the =-form).
    stripped="$(printf '%s' "$tok" | sed -E -e 's/\[[^]]*=[^]]*\]/V/g' -e 's/(^|:)([a-zA-Z-]*data|aria)-\[[a-zA-Z][a-zA-Z0-9_-]*\]/\1V/g')"
    is_violation=0
    if printf '%s' "$tok" | grep -qE -e '^!' -e '[a-zA-Z]!$'; then
      is_violation=1
    elif printf '%s' "$stripped" | grep -qE -e '-\['; then
      is_violation=1
    elif printf '%s' "$stripped" | grep -qE -e '(^|:)\[[a-zA-Z][a-zA-Z-]*:[^]]*\]'; then
      # Leading-bracket arbitrary PROPERTY (e.g. [mask-type:luminance]),
      # standalone or behind a variant prefix: a value smuggled as a CSS
      # property. Previously uncaught (the old pattern required "-[").
      is_violation=1
    fi
    if [ "$is_violation" -eq 1 ]; then
      if ! awk -v f="$file" -v t="$tok" '$1=="arbitrary-allow" && $2==f && $3==t { found=1 } END { exit !found }' "$DS_BASELINE" 2>/dev/null; then
        violation "Tailwind arbitrary value / important modifier banned: ${tok} in ${match} -- use token-backed utilities only (spec 129 §5.4); attribute variants such as data-[state=open]: are permitted, arbitrary values and arbitrary properties are not; exceptions need an arbitrary-allow line in apps/web/design-system-baseline.txt"
      fi
    fi
  done
done < <(grep -rn 'className' --include='*.ts' --include='*.tsx' apps/web/src 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Check 11: CSS files under apps/web/src stay literal-free (spec 129 §5.4).
# globals.css (and any future authored .css) must contain zero hex/rgb/hsl
# literals, zero raw px font-sizes and zero ad-hoc numeric z-index — values
# come from the generated tokens. !important in globals.css is permitted
# ONLY inside the @layer overrides block. The generated tokens file is
# exempt (tokens:check guards it).
# ---------------------------------------------------------------------------
while IFS= read -r cssfile; do
  for spec in "hex|$HEX_PAT" "rgb|$RGB_PAT" "fontsize|$FONTSIZE_PAT" "zindex|$ZINDEX_PAT"; do
    cat_name="${spec%%|*}"
    cat_pat="${spec#*|}"
    while IFS= read -r line; do
      violation "literal in CSS (${cat_name}): ${line} -- CSS files consume generated token variables only (spec 129 §5.4)"
    done < <(grep -nE "$cat_pat" "$cssfile" 2>/dev/null || true)
  done
  while IFS= read -r line; do
    violation "!important in CSS outside the overrides layer: ${line} -- globals.css permits it only inside @layer overrides, with a comment citing why (spec 129 §5.3)"
  done < <(awk '
    /@layer overrides[[:space:]]*\{/ { inlayer=1 }
    inlayer && /^}/ { inlayer=0 }
    /!important/ && !inlayer { print FILENAME":"FNR": "$0 }
  ' "$cssfile" 2>/dev/null || true)
done < <(find apps/web/src -name '*.css' 2>/dev/null | grep -v 'styles/tokens.generated.css' || true)

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
