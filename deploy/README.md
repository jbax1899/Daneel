# Deployment (Issue #96)

This folder defines the minimal 3-service split for local/self-hosted Docker Compose.

Services:
- backend: Node server (`server.js`) for `/api/*`, Turnstile verification, rate limiting, tracing, and GitHub webhooks.
- web: builds the Vite app and serves it with Caddy, proxying `/api/*` to backend.
- discord-bot: Discord bot runtime only.

## Prerequisites
- Ensure `.env` is present at the repo root.

## Start
`docker compose -f deploy/compose.yml up --build`

## Stop
`docker compose -f deploy/compose.yml down`

## Fly.io
- Backend: `fly deploy -c deploy/fly.backend.toml`
- Web: `fly deploy -c deploy/fly.web.toml`
- Bot: `fly deploy -c deploy/fly.bot.toml`
- All three (bash): `./scripts/deploy-fly.sh`
- All three (PowerShell): `./scripts/deploy-fly.ps1`
  (Requires Fly CLI: https://fly.io/docs/flyctl/install/)
  TODO: add interactive prompts in the deploy scripts for setting Fly secrets (`fly secrets set`).
  Note: we use three separate Fly apps to mirror the Docker Compose service split.

## Notes
- Only the web service is exposed on host port 8080 (`http://localhost:8080`) to avoid admin privileges.
- The backend listens internally on port 3000 and stores data in `/data` (Docker volume: `arete-data`).
- Blog post JSONs are expected to move to backend-owned storage under `/data` and be served via backend endpoints.
  (Current backend code still writes to the web build output; this will be resolved in issue #97.)
