#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORKER_DIR="$ROOT_DIR/backend_v3/services/analytics/followers-metrics-cron-worker"
WRANGLER="npx wrangler@4"

for var_name in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: $var_name"
    exit 1
  fi
done

pushd "$WORKER_DIR" >/dev/null
npm install
printf '%s' "$SUPABASE_URL" | $WRANGLER secret put SUPABASE_URL >/dev/null
printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | $WRANGLER secret put SUPABASE_SERVICE_ROLE_KEY >/dev/null
$WRANGLER deploy
popd >/dev/null

echo "Followers metrics cron deployed."
