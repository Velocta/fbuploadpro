#!/usr/bin/env bash
# In-App Scheduler Posting Service Deployment Script
# 
# Architecture: 3-Step Pipeline / 2-Worker Setup
# 1. Scheduler (Database-Level Stored Procedure): Generates jobs in postgres
# 2. Processor Worker (fbuploadpro-fb-inapp-schedule-processor): Cron-triggered orchestrator
# 3. Publisher Worker (fbuploadpro-fb-inapp-schedule-publisher): Isolated execution worker
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
POSTING_DIR="$ROOT_DIR/backend_v3/services/facebook/inapp-schedule/posting"
PUBLISH_PROCESSOR_DIR="$POSTING_DIR/publish-processor-worker"
PUBLISHER_DIR="$POSTING_DIR/publisher-worker"
WRANGLER="npx wrangler@4"

required_vars=(
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  INTERNAL_JOB_DISPATCH_TOKEN
)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: $var_name"
    exit 1
  fi
done

if ! $WRANGLER whoami >/dev/null 2>&1; then
  echo "Wrangler is not authenticated. Run: npx wrangler@4 login"
  exit 1
fi

echo "Ensuring user-media R2 bucket exists..."
$WRANGLER r2 bucket create "fbuploadpro-user-media" >/dev/null 2>&1 || true

ROBOTS_SRC="$POSTING_DIR/r2-bucket-robots.txt"
if [[ -f "$ROBOTS_SRC" ]]; then
  echo "Uploading R2 object robots.txt..."
  $WRANGLER r2 object put "fbuploadpro-user-media/robots.txt" \
    --file="$ROBOTS_SRC" \
    --content-type="text/plain; charset=utf-8" \
    --remote \
    -y 2>/dev/null || echo "Warning: could not upload robots.txt to R2."
fi

put_secret() {
  local dir="$1"
  local name="$2"
  local value="$3"
  pushd "$dir" >/dev/null
  printf '%s' "$value" | $WRANGLER secret put "$name" >/dev/null
  popd >/dev/null
}

deploy_worker() {
  local name="$1"
  local dir="$2"
  echo "Deploying $name ..."
  pushd "$dir" >/dev/null
  npm install
  $WRANGLER deploy
  popd >/dev/null
}

echo "Configuring worker secrets..."
for dir in "$PUBLISH_PROCESSOR_DIR" "$PUBLISHER_DIR"; do
  put_secret "$dir" "SUPABASE_URL" "$SUPABASE_URL"
  put_secret "$dir" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
  put_secret "$dir" "INTERNAL_JOB_DISPATCH_TOKEN" "$INTERNAL_JOB_DISPATCH_TOKEN"
done

if [[ -n "${R2_ACCESS_KEY_ID:-}" ]] && [[ -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  echo "Configuring R2 S3 secrets for publisher..."
  put_secret "$PUBLISHER_DIR" "R2_ACCESS_KEY_ID" "$R2_ACCESS_KEY_ID"
  put_secret "$PUBLISHER_DIR" "R2_SECRET_ACCESS_KEY" "$R2_SECRET_ACCESS_KEY"
fi

echo "Deploy order (1→2): In-App publisher → processor"
echo "Cloudflare worker names: fbuploadpro-fb-inapp-schedule-publisher, fbuploadpro-fb-inapp-schedule-processor"
deploy_worker "fbuploadpro-fb-inapp-schedule-publisher" "$PUBLISHER_DIR"
deploy_worker "fbuploadpro-fb-inapp-schedule-processor" "$PUBLISH_PROCESSOR_DIR"

echo "In-App posting pipeline deployment complete."
