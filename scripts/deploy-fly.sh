#!/usr/bin/env bash
set -euo pipefail

if ! command -v fly >/dev/null 2>&1; then
  echo "Fly CLI is required. Install from https://fly.io/docs/flyctl/install/"
  exit 1
fi

fly deploy -c deploy/fly.backend.toml
fly deploy -c deploy/fly.web.toml
fly deploy -c deploy/fly.bot.toml
