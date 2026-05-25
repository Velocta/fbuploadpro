#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
WORKER_DIR="$ROOT/posting/slot-processor-worker"

cd "$WORKER_DIR"
npm install --omit=dev
npx wrangler deploy

echo "Deployed fb-rss-autoposter slot processor"
