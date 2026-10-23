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
# Check 6: CSP actually issued by middleware via lib/csp.ts (spec 087/139).
# The old check grepped for 'Content-Security-Policy' in next.config.ts,
# where the string only appears in a COMMENT — it passed even if no CSP
# header was ever sent. This asserts the real wiring instead:
#   - lib/csp.ts defines CSP_HEADER_NAME as a Content-Security-Policy*
#     header name (the single Phase-2 flip point),
#   - lib/csp.ts's applyCspHeaders() sets that header on the response,
#   - middleware.ts uses CSP_HEADER_NAME and calls applyCspHeaders().
# ---------------------------------------------------------------------------
CSP_LIB="apps/web/src/lib/csp.ts"
CSP_MIDDLEWARE="apps/web/src/middleware.ts"
if ! grep -q -E "export const CSP_HEADER_NAME = 'Content-Security-Policy" "$CSP_LIB" 2>/dev/null; then
  violation "CSP header name not defined: ${CSP_LIB} must export CSP_HEADER_NAME = 'Content-Security-Policy...' (the single CSP flip point) -- do not remove or rename it"
fi
if ! grep -q -E 'export function applyCspHeaders' "$CSP_LIB" 2>/dev/null || ! grep -q -F 'response.headers.set(CSP_HEADER_NAME' "$CSP_LIB" 2>/dev/null; then
  violation "applyCspHeaders() in ${CSP_LIB} must set the response header via CSP_HEADER_NAME -- the CSP header must actually be issued, not just named"
fi
if ! grep -q 'CSP_HEADER_NAME' "$CSP_MIDDLEWARE" 2>/dev/null; then
  violation "CSP_HEADER_NAME not used in ${CSP_MIDDLEWARE} -- middleware must set the CSP request header via CSP_HEADER_NAME from lib/csp.ts"
fi
if ! grep -q -E 'applyCspHeaders\(' "$CSP_MIDDLEWARE" 2>/dev/null; then
  violation "applyCspHeaders() not called in ${CSP_MIDDLEWARE} -- middleware must apply CSP headers to responses via applyCspHeaders() from lib/csp.ts"
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
#
# Multi-line hardening (spec 129 follow-up): the scan does NOT work line by
# line. A small awk lexer first extracts every className attribute
# expression — className="...", className='...' and className={ ... } with
# balanced braces and string/template/${} awareness — folding continuation
# lines into a single record (newlines become spaces), so arbitrary values
# hidden inside a multi-line cn(...) call or a multi-line template literal
# are scanned too. (The old line-based scan only ever saw lines carrying
# the word `className`, so continuation lines were never checked — the
# sidebar's allowlisted transition-[...] classes included.)
# Lexer heuristics, same class as the rest of this script: it skips
# strings/comments while searching (single-quoted search strings bail at
# end-of-line, which bounds the damage from apostrophes in JSX text), and
# regex literals inside className expressions can confuse it.
# ---------------------------------------------------------------------------
CHECK10_AWK="$(mktemp)"
cat > "$CHECK10_AWK" <<'AWK_EOF'
# className-expression extractor for Check 10 (see the shell comments).
# Emits one record per className attribute expression:
#   <file>:<line-of-className>:<expression text, newlines folded to spaces>
BEGIN { buf = "" }
{ buf = buf $0 "\n" }
END {
  len = length(buf)
  for (j = 1; j <= len; j++) ch[j] = substr(buf, j, 1)
  n = len
  state = 0; sm = 0; em = 0; line = 1; startline = 0; out = ""; depth = 0
  i = 1
  while (i <= n) {
    c = ch[i]
    if (state == 0) {
      # Searching for the className keyword; sm tracks skipped literals:
      # 0 code, 1 '..' 2 ".." 3 `..` (opaque), 4 // comment, 5 /* comment.
      if (sm == 0) {
        if (c == "'") { sm = 1; i++ }
        else if (c == "\"") { sm = 2; i++ }
        else if (c == "`") { sm = 3; i++ }
        else if (c == "/" && ch[i+1] == "/") { sm = 4; i += 2 }
        else if (c == "/" && ch[i+1] == "*") { sm = 5; i += 2 }
        else if (c == "c" && ch[i+1] == "l" && ch[i+2] == "a" && ch[i+3] == "s" && ch[i+4] == "s" && ch[i+5] == "N" && ch[i+6] == "a" && ch[i+7] == "m" && ch[i+8] == "e" && !(ch[i-1] ~ /[A-Za-z0-9_$]/) && !(ch[i+9] ~ /[A-Za-z0-9_$]/)) { startline = line; state = 1; i += 9 }
        else { if (c == "\n") line++; i++ }
      } else if (sm == 1 || sm == 2) {
        q = (sm == 1 ? "'" : "\"")
        if (c == "\\") { if (ch[i+1] == "\n") line++; i += 2 }
        else if (c == q || c == "\n") { if (c == "\n") line++; sm = 0; i++ }
        else i++
      } else if (sm == 3) {
        if (c == "\\") { if (ch[i+1] == "\n") line++; i += 2 }
        else if (c == "`") { sm = 0; i++ }
        else { if (c == "\n") line++; i++ }
      } else if (sm == 4) {
        if (c == "\n") { sm = 0; line++ }
        i++
      } else if (sm == 5) {
        if (c == "*" && ch[i+1] == "/") { sm = 0; i += 2 }
        else { if (c == "\n") line++; i++ }
      }
    } else if (state == 1) {
      # After the keyword: only whitespace may precede '='.
      if (c == " " || c == "\t" || c == "\r") i++
      else if (c == "\n") { line++; i++ }
      else if (c == "=") { state = 2; i++ }
      else state = 0
    } else if (state == 2) {
      # After '=': dispatch on the value form.
      if (c == " " || c == "\t" || c == "\r") i++
      else if (c == "\n") { line++; i++ }
      else if (c == "\"") { state = 3; out = "\""; i++ }
      else if (c == "'") { state = 4; out = "'"; i++ }
      else if (c == "{") { state = 5; em = 0; depth = 1; out = "{"; i++ }
      else if (c ~ /[A-Za-z_$]/) {
        out = ""
        while (i <= n && ch[i] ~ /[A-Za-z0-9_$.]/) { out = out ch[i]; i++ }
        printf "%s:%d:%s\n", FILENAME, startline, out
        out = ""; state = 0
      }
      else state = 0
    } else if (state == 3 || state == 4) {
      # JSX attribute string: ends at the matching quote (JSX has no
      # backslash escapes in attribute strings); may span lines.
      q = (state == 3 ? "\"" : "'")
      if (c == q) { out = out c; printf "%s:%d:%s\n", FILENAME, startline, out; out = ""; state = 0; i++ }
      else if (c == "\n") { out = out " "; line++; i++ }
      else { out = out c; i++ }
    } else if (state == 5) {
      # Inside className={ ... }: em tracks 0 code, 1 '..', 2 "..",
      # 3 template, 4 // comment, 5 /* comment. resume[d] records that
      # depth d was entered from a template ${...} at depth d-1.
      if (em == 0) {
        if (c == "'") { em = 1; out = out c; i++ }
        else if (c == "\"") { em = 2; out = out c; i++ }
        else if (c == "`") { em = 3; out = out c; i++ }
        else if (c == "/" && ch[i+1] == "/") { em = 4; out = out " "; i += 2 }
        else if (c == "/" && ch[i+1] == "*") { em = 5; out = out " "; i += 2 }
        else if (c == "{") { depth++; out = out c; i++ }
        else if (c == "}") {
          depth--; out = out c; i++
          if (depth == 0) { printf "%s:%d:%s\n", FILENAME, startline, out; out = ""; state = 0 }
          else if ((depth + 1) in resume) { em = resume[depth + 1]; delete resume[depth + 1] }
        }
        else if (c == "\n") { out = out " "; line++; i++ }
        else { out = out c; i++ }
      } else if (em == 1 || em == 2) {
        q = (em == 1 ? "'" : "\"")
        if (c == "\\") {
          out = out c; nx = ch[i+1]
          if (nx == "\n") { out = out " "; line++ } else out = out nx
          i += 2
        }
        else if (c == q) { em = 0; out = out c; i++ }
        else if (c == "\n") { out = out " "; line++; i++ }
        else { out = out c; i++ }
      } else if (em == 3) {
        if (c == "\\") {
          out = out c; nx = ch[i+1]
          if (nx == "\n") { out = out " "; line++ } else out = out nx
          i += 2
        }
        else if (c == "`") { em = 0; out = out c; i++ }
        else if (c == "$" && ch[i+1] == "{") { resume[depth + 1] = 3; depth++; em = 0; out = out "${"; i += 2 }
        else if (c == "\n") { out = out " "; line++; i++ }
        else { out = out c; i++ }
      } else if (em == 4) {
        if (c == "\n") { em = 0; out = out " "; line++ }
        i++
      } else if (em == 5) {
        if (c == "*" && ch[i+1] == "/") { em = 0; i += 2 }
        else { if (c == "\n") line++; i++ }
      }
    }
  }
}
AWK_EOF
while IFS= read -r match; do
  file="${match%%:*}"
  cleaned="$(printf '%s' "$match" | sed -E 's/\$\{[^}]*\}//g')"
  # Tokenize WITHOUT splitting on "=" (PR-F3 fix): attribute-variant brackets
  # (data-[state=open]:, data-[side=top]:, group-data-[collapsible=icon]:)
  # legitimately contain "=" and are variants, not values (spec 129 §5.4,
  # PR-F3 coordinator ruling). The old "[^...<>=]+" pattern mangled such a
  # token to "data-[state", flagged it, and made it un-allowlistable.
  # Delimiters here are quotes, backticks, braces, parens and angle
  # brackets; whitespace splitting happens via word expansion. Commas are
  # NOT delimiters (multi-line hardening): bracket-form values may contain
  # commas (transition-[left,right,width]) and the baseline allowlist
  # matches exact tokens, so a token must survive tokenisation whole;
  # cn(...) arguments are already separated by their quotes.
  for tok in $(printf '%s' "$cleaned" | tr "\"'\`{}()<>" ' ' || true); do
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
done < <(
  while IFS= read -r c10_file; do
    awk -f "$CHECK10_AWK" "$c10_file" 2>/dev/null || true
  done < <(grep -rl 'className' --include='*.ts' --include='*.tsx' apps/web/src 2>/dev/null || true)
)
rm -f "$CHECK10_AWK"

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
# Check 12: silent-failure pattern family banned (spec 137 §3.1 / PR-A1a).
# In data code a failed request or a caught error must surface — never
# vanish. Banned in apps/web/src:
#   not-ok-return     `if (!res.ok) return;` (or return null/undefined;)
#   bare-catch-return a catch block whose whole body is a bare return
#   empty-catch       a catch block whose whole body is empty / comments
# Pre-existing occurrences are frozen per file+category in
# apps/web/silent-failure-baseline.txt (same discipline as check 9):
# any increase or new file fails; a decrease fails until the baseline
# is updated in the same PR. Existing occurrences ride the surface
# rebuilds that own each file (spec 137 §4.1.2) — this check stops new
# ones from the day it lands. New code talks to the API through
# apps/web/src/lib/api (typed client: throws ApiError, never swallows).
# ---------------------------------------------------------------------------
SF_BASELINE="apps/web/silent-failure-baseline.txt"
if [ -f "$SF_BASELINE" ]; then
  SF_SCANNER="$(mktemp)"
  cat > "$SF_SCANNER" <<'PERL_EOF'
use strict;
use warnings;
my %counts;
for my $file (@ARGV) {
  open my $fh, '<', $file or next;
  local $/;
  my $content = <$fh>;
  close $fh;
  next unless defined $content;
  my $notok = 0;
  $notok++ while $content =~ /if\s*\(\s*!\s*[A-Za-z_\$][A-Za-z0-9_\$]*\.ok\s*\)\s*\{?\s*return\s*(?:null|undefined)?\s*;\s*\}?/g;
  $counts{"not-ok-return $file"} += $notok if $notok;
  while ($content =~ /catch\s*(?:\([^)]*\))?\s*\{/g) {
    my $rest = substr($content, pos($content));
    while (1) {
      if    ($rest =~ s/\A\s+//)          { next; }
      elsif ($rest =~ s/\A\/\/[^\n]*//)   { next; }
      elsif ($rest =~ s/\A\/\*.*?\*\///s) { next; }
      last;
    }
    if ($rest =~ /\A\}/) {
      $counts{"empty-catch $file"}++;
    }
    elsif ($rest =~ /\Areturn\s*(?:null|undefined)?\s*;\s*\}/) {
      $counts{"bare-catch-return $file"}++;
    }
  }
}
for my $key (sort keys %counts) {
  my ($cat, $file) = split / /, $key, 2;
  print "$cat $file $counts{$key}\n";
}
PERL_EOF
  SF_CURRENT="$(mktemp)"
  find apps/web/src -name '*.ts' -o -name '*.tsx' | sort | xargs perl "$SF_SCANNER" > "$SF_CURRENT" 2>/dev/null || true
  SF_BASE_SORTED="$(mktemp)"
  grep -E '^(not-ok-return|bare-catch-return|empty-catch)[[:space:]]' "$SF_BASELINE" | sort > "$SF_BASE_SORTED"
  while IFS= read -r change; do
    [ -z "$change" ] && continue
    kind="$(printf '%s' "$change" | awk '{print $1}')"
    cat_name="$(printf '%s' "$change" | awk '{print $2}')"
    fname="$(printf '%s' "$change" | awk '{print $3}')"
    old_n="$(printf '%s' "$change" | awk '{print $4}')"
    new_n="$(printf '%s' "$change" | awk '{print $5}')"
    if [ "$kind" = "INCREASE" ]; then
      violation "silent-failure ban (${cat_name}): ${fname} has ${new_n} occurrence(s), baseline is ${old_n} -- surface the error (throw / present via the ladder); data code uses the typed client in src/lib/api (spec 137 §3.1); do not raise the baseline"
    else
      violation "silent-failure baseline STALE (${cat_name}): ${fname} dropped from ${old_n} to ${new_n} -- update apps/web/silent-failure-baseline.txt in this PR (spec 137 PR-A1a)"
    fi
  done < <(awk '
    NR==FNR { base[$1" "$2]=$3; seen[$1" "$2]=1; next }
    { cur[$1" "$2]=$3; seen[$1" "$2]=1 }
    END { for (k in seen) { b=base[k]+0; c=cur[k]+0;
      if (c>b) print "INCREASE", k, b, c; else if (c<b) print "DECREASE", k, b, c } }
  ' "$SF_BASE_SORTED" "$SF_CURRENT")
  rm -f "$SF_SCANNER" "$SF_CURRENT" "$SF_BASE_SORTED"
else
  violation "silent-failure baseline file missing: apps/web/silent-failure-baseline.txt (spec 137 PR-A1a)"
fi

# ---------------------------------------------------------------------------
# Check 13: localStorage allowlist (spec 137 §3.9 / PR-A1b).
# Direct localStorage access in apps/web/src is allowlist-only:
#   lib/storage/preferences.ts (typed helper), app/layout.tsx (theme-init,
#   spec 129), lib/auth-broadcast.ts + workspace-lifecycle-guard.tsx (the
#   auth cross-tab broadcast mechanism). Every other usage is frozen per
#   file in apps/web/localstorage-baseline.txt (same discipline as checks
#   9/12): any new file or increase fails; a decrease fails until the
#   baseline is updated in the same PR. Frozen usages are classified in
#   PR-A1b's per-site table with named migration owners (spec 137 §4.1.7).
# ---------------------------------------------------------------------------
LS_BASELINE="apps/web/localstorage-baseline.txt"
LS_ALLOWLIST=" apps/web/src/lib/storage/preferences.ts apps/web/src/app/layout.tsx apps/web/src/lib/auth-broadcast.ts apps/web/src/components/workspace/workspace-lifecycle-guard.tsx "
if [ -f "$LS_BASELINE" ]; then
  LS_CURRENT="$(mktemp)"
  while IFS= read -r ls_file; do
    case "$LS_ALLOWLIST" in
      *" $ls_file "*) continue ;;
    esac
    ls_count="$(grep -o 'localStorage' "$ls_file" 2>/dev/null | wc -l | tr -d ' ')"
    [ "$ls_count" -gt 0 ] && printf '%s %s\n' "$ls_file" "$ls_count" >> "$LS_CURRENT"
  done < <(find apps/web/src -name '*.ts' -o -name '*.tsx' | sort)
  LS_BASE_SORTED="$(mktemp)"
  grep -E '^apps/web/src/' "$LS_BASELINE" | sort > "$LS_BASE_SORTED"
  while IFS= read -r change; do
    [ -z "$change" ] && continue
    kind="$(printf '%s' "$change" | awk '{print $1}')"
    fname="$(printf '%s' "$change" | awk '{print $2}')"
    old_n="$(printf '%s' "$change" | awk '{print $3}')"
    new_n="$(printf '%s' "$change" | awk '{print $4}')"
    if [ "$kind" = "INCREASE" ]; then
      violation "localStorage allowlist: ${fname} has ${new_n} occurrence(s), baseline is ${old_n} -- direct access is allowlist-only (spec 137 §3.9); device preferences go through src/lib/storage/preferences.ts; do not raise the baseline"
    else
      violation "localStorage baseline STALE: ${fname} dropped from ${old_n} to ${new_n} -- update apps/web/localstorage-baseline.txt in this PR (spec 137 PR-A1b)"
    fi
  done < <(awk '
    NR==FNR { base[$1]=$2; seen[$1]=1; next }
    { cur[$1]=$2; seen[$1]=1 }
    END { for (k in seen) { b=base[k]+0; c=cur[k]+0;
      if (c>b) print "INCREASE", k, b, c; else if (c<b) print "DECREASE", k, b, c } }
  ' "$LS_BASE_SORTED" "$LS_CURRENT")
  rm -f "$LS_CURRENT" "$LS_BASE_SORTED"
else
  violation "localStorage baseline file missing: apps/web/localstorage-baseline.txt (spec 137 PR-A1b)"
fi

# ---------------------------------------------------------------------------
# Check 14: `any` ratchet (spec 137 §3.7 / PR-A4).
# Type-position `any` in apps/web/src may only go DOWN. Counting method
# (the baseline of record, recorded in apps/web/any-baseline.txt):
# occurrences of the type-position pattern below via grep -oE — prose
# uses of the word "any" do not count. Frozen per file (same discipline
# as checks 9/12/13): any increase or new file fails; a decrease fails
# until the baseline is updated in the same PR. PR-A4 cleared the whole
# API-route/lib-owned share (205 -> 58); each residual names its owning
# surface in the baseline header (spec 137 §4.1.6).
# ---------------------------------------------------------------------------
ANY_BASELINE="apps/web/any-baseline.txt"
ANY_PAT='(:[[:space:]]*any\b|as[[:space:]]+any\b|<any[[:space:]]*[>,]|,[[:space:]]*any[[:space:]]*[>,]|\bany\[\])'
if [ -f "$ANY_BASELINE" ]; then
  ANY_CURRENT="$(mktemp)"
  while IFS= read -r any_file; do
    any_count="$(grep -oE "$ANY_PAT" "$any_file" 2>/dev/null | wc -l | tr -d ' ')"
    [ "$any_count" -gt 0 ] && printf '%s %s\n' "$any_file" "$any_count" >> "$ANY_CURRENT"
  done < <(find apps/web/src -name '*.ts' -o -name '*.tsx' | sort)
  ANY_BASE_SORTED="$(mktemp)"
  grep -E '^apps/web/src/' "$ANY_BASELINE" | sort > "$ANY_BASE_SORTED"
  while IFS= read -r change; do
    [ -z "$change" ] && continue
    kind="$(printf '%s' "$change" | awk '{print $1}')"
    fname="$(printf '%s' "$change" | awk '{print $2}')"
    old_n="$(printf '%s' "$change" | awk '{print $3}')"
    new_n="$(printf '%s' "$change" | awk '{print $4}')"
    if [ "$kind" = "INCREASE" ]; then
      violation "any ratchet INCREASED: ${fname} has ${new_n} type-position any occurrence(s), baseline is ${old_n} -- type the boundary properly (zod-inferred types, contracts row types, unknown + narrowing); do not raise the baseline (spec 137 §3.7)"
    else
      violation "any baseline STALE: ${fname} dropped from ${old_n} to ${new_n} -- update apps/web/any-baseline.txt in this PR (spec 137 PR-A4)"
    fi
  done < <(awk '
    NR==FNR { base[$1]=$2; seen[$1]=1; next }
    { cur[$1]=$2; seen[$1]=1 }
    END { for (k in seen) { b=base[k]+0; c=cur[k]+0;
      if (c>b) print "INCREASE", k, b, c; else if (c<b) print "DECREASE", k, b, c } }
  ' "$ANY_BASE_SORTED" "$ANY_CURRENT")
  rm -f "$ANY_CURRENT" "$ANY_BASE_SORTED"
else
  violation "any baseline file missing: apps/web/any-baseline.txt (spec 137 PR-A4)"
fi

# ---------------------------------------------------------------------------
# Check 15: raw <img> freeze (spec 137 §3.5 / PR-A4).
# ESLint @next/next/no-img-element is an error across apps/web/src with
# a per-file freeze for the 16 surface-owned files that still carry the
# 23 pre-existing raw <img> elements; this check is the count-level
# backstop (it also covers files ESLint's freeze list names): counts
# frozen per file in apps/web/img-baseline.txt — any increase or new
# file fails; a decrease fails until the baseline (and the ESLint
# freeze list, when a file reaches zero) is updated in the same PR.
# Conversions to next/image ride the surface rebuilds (§4.1.4).
# ---------------------------------------------------------------------------
IMG_BASELINE="apps/web/img-baseline.txt"
if [ -f "$IMG_BASELINE" ]; then
  IMG_CURRENT="$(mktemp)"
  while IFS= read -r img_file; do
    img_count="$(grep -o '<img' "$img_file" 2>/dev/null | wc -l | tr -d ' ')"
    [ "$img_count" -gt 0 ] && printf '%s %s\n' "$img_file" "$img_count" >> "$IMG_CURRENT"
  done < <(find apps/web/src -name '*.ts' -o -name '*.tsx' | sort)
  IMG_BASE_SORTED="$(mktemp)"
  grep -E '^apps/web/src/' "$IMG_BASELINE" | sort > "$IMG_BASE_SORTED"
  while IFS= read -r change; do
    [ -z "$change" ] && continue
    kind="$(printf '%s' "$change" | awk '{print $1}')"
    fname="$(printf '%s' "$change" | awk '{print $2}')"
    old_n="$(printf '%s' "$change" | awk '{print $3}')"
    new_n="$(printf '%s' "$change" | awk '{print $4}')"
    if [ "$kind" = "INCREASE" ]; then
      violation "raw <img> INCREASED: ${fname} has ${new_n} occurrence(s), baseline is ${old_n} -- use next/image (spec 137 §3.5); do not raise the baseline"
    else
      violation "img baseline STALE: ${fname} dropped from ${old_n} to ${new_n} -- update apps/web/img-baseline.txt (and the ESLint freeze list when a file reaches zero) in this PR (spec 137 PR-A4)"
    fi
  done < <(awk '
    NR==FNR { base[$1]=$2; seen[$1]=1; next }
    { cur[$1]=$2; seen[$1]=1 }
    END { for (k in seen) { b=base[k]+0; c=cur[k]+0;
      if (c>b) print "INCREASE", k, b, c; else if (c<b) print "DECREASE", k, b, c } }
  ' "$IMG_BASE_SORTED" "$IMG_CURRENT")
  rm -f "$IMG_CURRENT" "$IMG_BASE_SORTED"
else
  violation "img baseline file missing: apps/web/img-baseline.txt (spec 137 PR-A4)"
fi

# ---------------------------------------------------------------------------
# Check 16: responsive @media width literals must match the token
# breakpoint scale (spec 139 / mobile audit M-G1).
# @media (min|max)-width px literals in apps/web/src/**/*.{css,tsx} must
# be one of 480 / 768 / 1024 / 1280. Pre-existing legacy literals are
# frozen per file+literal in apps/web/responsive-media-baseline.txt
# (same discipline as checks 9/12-15): any increase or new file+literal
# fails with file:line; a decrease fails until the baseline entry is
# removed in the same PR (the baseline burns down as surfaces 130-136
# rebuild — do NOT add entries). Line-based heuristic, same class as
# the rest of this script: the width feature must sit on the @media
# line, which is how every @media query in this tree is written.
# A missing baseline file grants ZERO exemptions (every off-scale
# literal then fails with file:line) rather than failing on the
# missing file itself — that keeps the synthetic fixture trees of
# .github/scripts/tests/check-10-multiline.sh, which plant no @media
# literals and scaffold only the baselines they exercise, green
# without weakening enforcement on any real literal. The diff awk
# below classifies its two inputs by FILENAME (not NR==FNR) so an
# EMPTY sorted baseline is not mistaken for the current counts.
# ---------------------------------------------------------------------------
RESP_BASELINE="apps/web/responsive-media-baseline.txt"
RESP_ALLOWED=" 480 768 1024 1280 "
  RESP_OCCURRENCES="$(mktemp)"
  RESP_COUNTS_RAW="$(mktemp)"
  while IFS= read -r match; do
    rfile="$(printf '%s' "$match" | cut -d: -f1)"
    rline="$(printf '%s' "$match" | cut -d: -f2)"
    while IFS= read -r feat; do
      [ -z "$feat" ] && continue
      lit="$(printf '%s' "$feat" | grep -oE '[0-9]+(\.[0-9]+)?px' | head -1)"
      num="${lit%px}"
      case "$RESP_ALLOWED" in
        *" $num "*) continue ;;
      esac
      printf '%s:%s %s\n' "$rfile" "$rline" "$lit" >> "$RESP_OCCURRENCES"
      printf '%s %s\n' "$rfile" "$lit" >> "$RESP_COUNTS_RAW"
    done < <(printf '%s' "$match" | grep -oE '(min|max)-width:[[:space:]]*[0-9]+(\.[0-9]+)?px' || true)
  done < <(grep -rn '@media' --include='*.css' --include='*.tsx' apps/web/src 2>/dev/null || true)
  RESP_CURRENT="$(mktemp)"
  sort "$RESP_COUNTS_RAW" | uniq -c | awk '{print $2, $3, $1}' | sort > "$RESP_CURRENT"
  RESP_BASE_SORTED="$(mktemp)"
  if [ -f "$RESP_BASELINE" ]; then
    grep -E '^apps/web/src/' "$RESP_BASELINE" | sort | uniq -c | awk '{print $2, $3, $1}' | sort > "$RESP_BASE_SORTED"
  fi
  while IFS= read -r change; do
    [ -z "$change" ] && continue
    kind="$(printf '%s' "$change" | awk '{print $1}')"
    fname="$(printf '%s' "$change" | awk '{print $2}')"
    lit="$(printf '%s' "$change" | awk '{print $3}')"
    old_n="$(printf '%s' "$change" | awk '{print $4}')"
    new_n="$(printf '%s' "$change" | awk '{print $5}')"
    if [ "$kind" = "INCREASE" ]; then
      while IFS= read -r occ; do
        [ -z "$occ" ] && continue
        violation "responsive @media literal off the token breakpoint scale: ${occ} -- @media widths must be one of 480px/768px/1024px/1280px (spec 139 M-G1); ${fname} ${lit} count is ${new_n}, baseline is ${old_n} -- do NOT add baseline entries; use a token breakpoint"
      done < <(awk -v f="$fname" -v l="$lit" '$2==l && index($1, f":")==1 {print $1}' "$RESP_OCCURRENCES")
    else
      violation "responsive baseline STALE: ${fname} ${lit} dropped from ${old_n} to ${new_n} -- remove the entry from apps/web/responsive-media-baseline.txt in this PR (spec 139 M-G1 burn-down)"
    fi
  done < <(awk '
    FILENAME==ARGV[1] { base[$1" "$2]=$3; seen[$1" "$2]=1; next }
    { cur[$1" "$2]=$3; seen[$1" "$2]=1 }
    END { for (k in seen) { b=base[k]+0; c=cur[k]+0;
      if (c>b) print "INCREASE", k, b, c; else if (c<b) print "DECREASE", k, b, c } }
  ' "$RESP_BASE_SORTED" "$RESP_CURRENT")
  rm -f "$RESP_OCCURRENCES" "$RESP_COUNTS_RAW" "$RESP_CURRENT" "$RESP_BASE_SORTED"

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
