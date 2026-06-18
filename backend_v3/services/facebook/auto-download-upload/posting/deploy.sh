#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
POSTING_DIR="$ROOT_DIR/backend_v3/services/facebook/auto-download-upload/posting"
SCHEDULER_DIR="$POSTING_DIR/scheduler-worker"
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

echo "Ensuring ADU buffer R2 bucket exists..."
$WRANGLER r2 bucket create "fbuploadpro-adu-buffer" >/dev/null 2>&1 || true

ROBOTS_SRC="$POSTING_DIR/r2-bucket-robots.txt"
if [[ -f "$ROBOTS_SRC" ]]; then
  echo "Uploading R2 object robots.txt..."
  $WRANGLER r2 object put "fbuploadpro-adu-buffer/robots.txt" \
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
for dir in "$SCHEDULER_DIR" "$PUBLISH_PROCESSOR_DIR" "$PUBLISHER_DIR"; do
  put_secret "$dir" "SUPABASE_URL" "$SUPABASE_URL"
  put_secret "$dir" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
done

for dir in "$PUBLISH_PROCESSOR_DIR" "$PUBLISHER_DIR"; do
  put_secret "$dir" "INTERNAL_JOB_DISPATCH_TOKEN" "$INTERNAL_JOB_DISPATCH_TOKEN"
done

if [[ -n "${R2_ACCESS_KEY_ID:-}" ]] && [[ -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  echo "Configuring R2 S3 secrets for publisher..."
  put_secret "$PUBLISHER_DIR" "R2_ACCESS_KEY_ID" "$R2_ACCESS_KEY_ID"
  put_secret "$PUBLISHER_DIR" "R2_SECRET_ACCESS_KEY" "$R2_SECRET_ACCESS_KEY"
fi

echo "Deploy order (1→2→3): ADU publisher → publish-processor → scheduler"
echo "Cloudflare worker names: fbuploadpro-adu-1-publisher, fbuploadpro-adu-2-publish-processor, fbuploadpro-adu-3-scheduler"
echo "VPS buffer downloader: see ../downloader/README.md (PM2, not Wrangler)"
deploy_worker "fbuploadpro-adu-1-publisher" "$PUBLISHER_DIR"
deploy_worker "fbuploadpro-adu-2-publish-processor" "$PUBLISH_PROCESSOR_DIR"
deploy_worker "fbuploadpro-adu-3-scheduler" "$SCHEDULER_DIR"

echo "ADU posting pipeline deployment complete."
