#!/usr/bin/env bash
set -euo pipefail

# Deploy all production backend Cloudflare workers in execution order.
#
# Required environment variables:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - PUBLISH_CALLBACK_TOKEN
# - DATACENTER_PROXY
# - RESIDENTIAL_PROXY
# Optional:
# - SCHEDULER_TEST_API_KEY
# - DOCKER_HOST (defaults to unix:///var/run/docker.sock)
# - WRANGLER_DOCKER_BIN (defaults to detected docker binary)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ORCHESTRATOR_DIR="$ROOT_DIR/backend/services/posting/posting-orchestrator-worker"
DOWNLOADER_QUEUE_DIR="$ROOT_DIR/backend/services/media/downloader-queue-worker"
SCHEDULER_DIR="$ROOT_DIR/backend/services/posting/posting-scheduler-worker"
FOLLOWERS_CRON_DIR="$ROOT_DIR/backend/services/analytics/followers-metrics-cron-worker"
WRANGLER="npx wrangler@4"
POSTING_QUEUE_NAME="fbuploadprov2-prod-posting-download-jobs"
POSTING_MEDIA_BUCKET_NAME="fbuploadprov2-prod-posting-media"
DOCKER_HOST="${DOCKER_HOST:-unix:///var/run/docker.sock}"

required_vars=(
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  PUBLISH_CALLBACK_TOKEN
  DATACENTER_PROXY
  RESIDENTIAL_PROXY
)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: $var_name"
    echo "Export all required values, then run again."
    exit 1
  fi
done

echo "Checking Wrangler authentication..."
if ! $WRANGLER whoami >/dev/null 2>&1; then
  echo "Wrangler is not authenticated. Run: npx wrangler@4 login"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for Cloudflare Container builds (posting-02-downloader)."
  echo "Install Docker and buildx, then retry."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install worker dependencies."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to run wrangler."
  exit 1
fi

export WRANGLER_DOCKER_BIN="${WRANGLER_DOCKER_BIN:-$(command -v docker)}"
export DOCKER_HOST

if ! "$WRANGLER_DOCKER_BIN" info >/dev/null 2>&1; then
  echo "Docker is installed but not accessible from this shell."
  echo "Fix Docker socket access (docker group / relogin), then retry."
  exit 1
fi

echo "Ensuring queue exists: $POSTING_QUEUE_NAME"
$WRANGLER queues create "$POSTING_QUEUE_NAME" >/dev/null 2>&1 || true
echo "Ensuring R2 bucket exists: $POSTING_MEDIA_BUCKET_NAME"
$WRANGLER r2 bucket create "$POSTING_MEDIA_BUCKET_NAME" >/dev/null 2>&1 || true

put_secret() {
  local dir="$1"
  local name="$2"
  local value="$3"
  pushd "$dir" >/dev/null
  printf '%s' "$value" | $WRANGLER secret put "$name" >/dev/null
  popd >/dev/null
}

deploy_worker() {
  local service_name="$1"
  local dir="$2"
  echo "Deploying $service_name..."
  pushd "$dir" >/dev/null
  npm install
  $WRANGLER deploy
  popd >/dev/null
}

echo "Resource names:"
echo "  posting-01 scheduler: fbuploadprov2-prod-posting-01-scheduler"
echo "  posting-02 downloader: fbuploadprov2-prod-posting-02-downloader"
echo "  posting-03 publisher: fbuploadprov2-prod-posting-03-publisher"
echo "  posting queue: $POSTING_QUEUE_NAME"
echo "  posting media bucket: $POSTING_MEDIA_BUCKET_NAME"
echo "  docker host: $DOCKER_HOST"
echo "  wrangler docker bin: $WRANGLER_DOCKER_BIN"
echo "  publisher DO class: PostingPublishStateDO"
echo "  downloader container class: PostingDownloadContainer"
echo "  followers worker: fbuploadprov2-prod-analytics-01-followers-cron"

echo "1/4 Configure + deploy posting-03 publisher"
put_secret "$ORCHESTRATOR_DIR" "SUPABASE_URL" "$SUPABASE_URL"
put_secret "$ORCHESTRATOR_DIR" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
put_secret "$ORCHESTRATOR_DIR" "PUBLISH_CALLBACK_TOKEN" "$PUBLISH_CALLBACK_TOKEN"
deploy_worker "fbuploadprov2-prod-posting-03-publisher" "$ORCHESTRATOR_DIR"

echo "2/4 Configure + deploy posting-02 downloader"
put_secret "$DOWNLOADER_QUEUE_DIR" "SUPABASE_URL" "$SUPABASE_URL"
put_secret "$DOWNLOADER_QUEUE_DIR" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
put_secret "$DOWNLOADER_QUEUE_DIR" "PUBLISH_CALLBACK_TOKEN" "$PUBLISH_CALLBACK_TOKEN"
put_secret "$DOWNLOADER_QUEUE_DIR" "DATACENTER_PROXY" "$DATACENTER_PROXY"
put_secret "$DOWNLOADER_QUEUE_DIR" "RESIDENTIAL_PROXY" "$RESIDENTIAL_PROXY"
deploy_worker "fbuploadprov2-prod-posting-02-downloader" "$DOWNLOADER_QUEUE_DIR"

echo "3/4 Configure + deploy posting-01 scheduler"
put_secret "$SCHEDULER_DIR" "SUPABASE_URL" "$SUPABASE_URL"
put_secret "$SCHEDULER_DIR" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
if [[ -n "${SCHEDULER_TEST_API_KEY:-}" ]]; then
  put_secret "$SCHEDULER_DIR" "SCHEDULER_TEST_API_KEY" "$SCHEDULER_TEST_API_KEY"
fi
deploy_worker "fbuploadprov2-prod-posting-01-scheduler" "$SCHEDULER_DIR"

echo "4/4 Configure + deploy followers cron"
put_secret "$FOLLOWERS_CRON_DIR" "SUPABASE_URL" "$SUPABASE_URL"
put_secret "$FOLLOWERS_CRON_DIR" "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
deploy_worker "fbuploadprov2-prod-analytics-01-followers-cron" "$FOLLOWERS_CRON_DIR"

echo "Production worker deployment completed."
echo "Next steps: apply DB migrations and run scheduler-off test injection."
