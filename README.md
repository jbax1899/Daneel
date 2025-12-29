# ARETE
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hippocratic License HL3-CORE](https://img.shields.io/static/v1?label=Hippocratic%20License&message=HL3-CORE&labelColor=5e2751&color=bc8c3d)](https://firstdonoharm.dev/version/3/0/core.html)

> Assistant for Realtime Ethical Thought and Evaluation

An ethics-first, transparent reasoning assistant — built to be self-hosted by anyone.

<img width="1280" height="640" alt="repo-card-1" src="https://github.com/user-attachments/assets/e36fd981-5802-41cc-9efe-f80073e72bdd" />

---

## What is ARETE?

ARETE is an AI assistant that tries to **show its work**.

Most assistants today give you polished answers but hide how they got there. ARETE does the opposite: it focuses on clarity over speed or persuasion. For each response, it aims to surface:

- how confident it is,
- what sources it relied on,
- what trade-offs it considered,
- and what ethical constraints were in play.

The goal is not to replace human judgment, but to make it easier for people and communities to **inspect, question, and correct** the system.

### Design Goals

- **Ethics-first design** – Every feature should help people think more clearly about what matters.
- **Transparency & provenance** – Reasoning and sources should be traceable, not hidden in a black box.
- **Humility & pluralism** – The assistant should express uncertainty and make room for multiple perspectives.
- **Auditability** – Decisions and responses should be loggable and explainable.
- **Responsiveness** – Transparency should invite discussion and correction.
- **Human oversight** – ARETE can guide reflection, but it should never be treated as an oracle.
- **Open & self-hostable** – Anyone should be able to inspect, modify, and run their own instance.

Explore the [public site](https://arete-web.fly.dev/) for more details and a quick demo!

---

## Architecture at a Glance

ARETE is made up of three small services that work together:

- **Discord bot**  
  The conversational interface. It listens in Discord, talks directly to the AI model to generate replies, and sends trace metadata to the backend for safekeeping.

<img width="1200" height="800" alt="chat-dark" src="https://github.com/user-attachments/assets/d2bce55e-2e93-4d9a-b174-87fa52d4d51d" />

- **Web interface**  
  The public-facing site and explanation viewer. It displays documentation and trace reports, and forwards API requests to the backend in a controlled way.

<img width="729" height="488" alt="image" src="https://github.com/user-attachments/assets/0b758ba3-2dc0-4b9f-bcda-073dca57eade" />

- **Backend API**  
  The system’s memory and guardrail layer. It stores response traces, serves runtime configuration, verifies CAPTCHA challenges, enforces rate limits, and exposes audit data.

In production, these services are deployed separately but are designed to behave the same way locally and in the cloud.

Locally, the web service proxies `/api/*` to the backend. On Fly, it reaches the backend over the internal Fly network.

---

## Getting Started (Local Development)

### 1. Clone the repository

```bash
git clone https://github.com/arete-org/arete.git
cd arete
```

### 2. Install dependencies

```bash
pnpm install
```

If pnpm isn't available yet, run `corepack enable` once (Node 16.10+), then re-run `pnpm install`.

### 3. Configure environment variables

```bash
cp .env.example .env
```

At minimum:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
DEVELOPER_USER_ID=...
OPENAI_API_KEY=...
TRACE_API_TOKEN=...
INCIDENT_PSEUDONYMIZATION_SECRET=...
```

### 4. Run the services

Start the backend and web interface:

```bash
pnpm start:dev
```

In another terminal, start the Discord bot:

```bash
pnpm start:bot
```

---

## Useful Commands

### Local development

- `pnpm start:dev` - Backend + web (no bot).
- `pnpm start:bot` - Discord bot only (requires bot env vars).
- `pnpm start:backend` - Backend only (no web or bot).

### Production-style checks

- `pnpm start:prod-test` - Build backend and run production server.
- `pnpm dev:prod-test` - Production backend + web dev server (no bot).

### Validation

- `pnpm build` - Build all workspace packages.
- `pnpm pre-review` - ARETE tags + type-check + lint.

---

## Optional Services

- **Cloudflare Turnstile (abuse prevention)**  
  Turnstile protects public endpoints from abuse.  
  If **both keys** are set, CAPTCHA is enforced.  
  If **neither key** is set, CAPTCHA is skipped.

```env
TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

- **Cloudinary (image uploads)**  
  If Cloudinary credentials are provided, images can be uploaded and referenced in traces.  
  If not, the system falls back to attaching images directly in Discord.

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Provenance & Storage

Response traces are stored in SQLite:

```env
PROVENANCE_SQLITE_PATH=/data/provenance.db
```

On Fly.io, `/data` is backed by a persistent volume. On other hosts, point this path at a durable directory.

---

## Deployment

The repository supports multi-service deployment:

- Docker Compose (local)
- Fly.io (three separate apps: backend, web, discord-bot)

Deployment configuration and scripts live under:

```text
deploy/
```

See `deploy/README.md` for details.

---

## License

ARETE is dual-licensed under:

- MIT
- Hippocratic License v3 (HL3-CORE)

See `docs/LICENSE_STRATEGY.md` for details.

---

## Contributing

Governance and contribution guidelines are still being drafted.

For now, thoughtful discussion, critique, and experimentation are welcome via issues and discussions.
