$ErrorActionPreference = 'Stop'

if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
  Write-Host "Fly CLI is required. Install from https://fly.io/docs/flyctl/install/"
  exit 1
}

fly deploy -c deploy/fly.backend.toml
fly deploy -c deploy/fly.web.toml
fly deploy -c deploy/fly.bot.toml
