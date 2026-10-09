#!/usr/bin/env bash
set -euo pipefail

# Vercel's Ignored Build Step contract:
# exit 0 => skip deployment
# exit 1 => continue deployment
#
# FIH runtime functions live under api/. Data, ledgers, queues, research,
# docs and GitHub-only orchestration must not consume Vercel deployments.

if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "No parent commit available; deploy."
  exit 1
fi

runtime_paths=(
  api
  package.json
  package-lock.json
  vercel.json
  config
)

if git diff --quiet HEAD^ HEAD -- "${runtime_paths[@]}"; then
  echo "No Vercel runtime changes; skip deployment."
  exit 0
fi

echo "Vercel runtime changes detected; deploy."
exit 1
