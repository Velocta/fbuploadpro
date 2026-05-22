#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCHEDULER_DIR="$ROOT_DIR/backend_v2/services/posting-v2/scheduler-worker"
DOWNLOAD_PROCESSOR_DIR="$ROOT_DIR/backend_v2/services/posting-v2/download-processor-worker"
REEL_GETER_DIR="$ROOT_DIR/backend_v2/services/posting-v2/reel-geter-worker"
PUBLISH_PROCESSOR_DIR="$ROOT_DIR/backend_v2/services/posting-v2/publish-processor-worker"
PUBLISHER_DIR="$ROOT_DIR/backend_v2/services/posting-v2/publisher-worker"
DOWNLOADER_SERVICE_DIR="$ROOT_DIR/backend_v2/services/media-v2/downloader-service"
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

echo "Ensuring v2 R2 bucket exists..."
$WRANGLER r2 bucket create "fbuploadprov2-v2-posting-media" >/dev/null 2>&1 || true

ROBOTS_SRC="$ROOT_DIR/backend_v2/services/posting-v2/r2-bucket-robots.txt"
if [[ -f "$ROBOTS_SRC" ]]; then
  echo "Uploading R2 object robots.txt (helps Meta file_url fetch when using r2.dev or similar public URLs)..."
  $WRANGLER r2 object put "fbuploadprov2-v2-posting-media/robots.txt" \
    --file="$ROBOTS_SRC" \
    --content-type="text/plain; charset=utf-8" \
    --remote \
    -y 2>/dev/null || echo "Warning: could not upload robots.txt to R2 (run wrangler r2 object put manually if hosted upload fails with robots.txt)."
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
for dir in \
  "$SCHEDULER_DIR" \
  "$DOWNLOAD_PROCESSOR_DIR" \
  "$REEL_GETER_DIR" \
  "$PUBLISH_PROCESSOR_DIR" \
  "$PUBLISHER_DIR"
do
  put_secret "$dir" "SUPABASE_URL" "$SUPABASE_URL"
  put_secret "$dir" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
done

for dir in \
  "$DOWNLOAD_PROCESSOR_DIR" \
  "$REEL_GETER_DIR" \
  "$PUBLISH_PROCESSOR_DIR" \
  "$PUBLISHER_DIR"
do
  put_secret "$dir" "INTERNAL_JOB_DISPATCH_TOKEN" "$INTERNAL_JOB_DISPATCH_TOKEN"
done

if [[ -n "${RESIDENTIAL_PROXY:-}" ]]; then
  put_secret "$DOWNLOADER_SERVICE_DIR" "RESIDENTIAL_PROXY" "$RESIDENTIAL_PROXY"
fi

echo "Deploy order: downloader-service -> reel-geter -> publisher -> processors -> scheduler"
echo "Set INTERNAL_JOB_DISPATCH_TOKEN in env before deploy (same secret on download-processor, reel-geter, publish-processor, publisher)."
deploy_worker "v2-downloader-service" "$DOWNLOADER_SERVICE_DIR"
deploy_worker "v2-reel-geter" "$REEL_GETER_DIR"
deploy_worker "v2-publisher" "$PUBLISHER_DIR"
deploy_worker "v2-download-processor" "$DOWNLOAD_PROCESSOR_DIR"
deploy_worker "v2-publish-processor" "$PUBLISH_PROCESSOR_DIR"
deploy_worker "v2-scheduler" "$SCHEDULER_DIR"

echo "Posting V2 deployment complete."
echo "Important: keep posting_v2_intake_paused=true until synthetic checks pass."
