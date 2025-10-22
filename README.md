# ARETE
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hippocratic License HL3-CORE](https://img.shields.io/static/v1?label=Hippocratic%20License&message=HL3-CORE&labelColor=5e2751&color=bc8c3d)](https://firstdonoharm.dev/version/3/0/core.html)
> Assistant for Realtime Ethical Thought and Evaluation

An ethics-first, transparent reasoning assistant — built to be self-hosted by anyone.

⚠️ Project Status: Early development. Most components are still prototypes or scaffolding.

ARETE builds on lessons from Daneel, a Discord assistant that serves as a functional foundation and reference for the system’s future architecture. The goal is to expand that groundwork into a transparent, ethics-first reasoning assistant — structure first, then functionality.

## Overview
ARETE is a transparent reasoning assistant for open reasoning and ethical reflection.
It helps make reasoning traceable, decisions explainable, and reflection part of the process rather than an afterthought.

Instead of chasing speed or persuasion like other AI systems, ARETE values clarity. You can view exactly how each response is formed—sources, confidence, trade-offs, and ethical constraints—so you can see not just *what* it thinks, but *why*.

## Key Principles
- Ethics-first design — Every feature should help people think more clearly about what matters.
- Transparency & provenance — Reasoning is transparent; each response traces its chain of thought and source.
- Humility and pluralism — Expresses uncertainty and welcomes alternate perspectives.
- Auditability — Decisions are logged and explainable, not ephemeral.
- Responsiveness — Transparency must invite reflection and correction, not just observation.
- Human oversight — ARETE can guide reflection, but never replace it.
- Open and self-hostable — Anyone can inspect, modify, or run their own instance.



## Documentation

| Document  | Description |
| ------------- | ------------- |
| [PHILOSOPHY.md](PHILOSOPHY.md)  | Founding letter and moral charter. |
| [SECURITY.md](.github/SECURITY.md) | Security and ethical safety policy. |
| [LICENSE_STRATEGY.md](LICENSE_STRATEGY.md)  | Dual-license rationale (MIT + Hippocratic License v3). |

## Quickstart
You can deploy ARETE locally or on Fly.io (either path uses the same environment configuration).
1. Clone the repository
```
git clone https://github.com/arete-org/arete.git
cd arete
```
2. Install dependencies
```
npm install
```
3. Configure environment
```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
OPENAI_API_KEY=your_openai_api_key
```
> Optional settings include rate limits and image generation models (see packages/discord-bot/README.md).

4. Run locally
(starts the ethics core, Discord bot, and web server in development mode)
```
npm run dev
```
5. Deploy to Fly.io (optional)
```
flyctl launch
flyctl deploy
```
This launches ARETE as a self-contained service in the cloud.

## Monorepo Structure
This repository houses all major packages:
```
packages/
  ethics-core/    → reasoning engine, provenance, circuit breakers
  discord-bot/    → conversational interface for Discord
  web/            → public landing page & explain viewer
docs/             → philosophy, governance, ethics logs, and framework specs
examples/         → demo scenarios
```

## License

Dual-licensed under MIT + Hippocratic License v3.

The HL3 clauses prohibit unethical use (violations of human rights, state violence, labor exploitation, etc.).

See [LICENSE_STRATEGY.md](LICENSE_STRATEGY.md) for details.

## Contributing

ARETE welcomes thoughtful contributions — technical, philosophical, or editorial.

Guidelines and governance structure are documented (COMING SOON) in:
- CONTRIBUTING.md — workflow and ethics review notes
- GOVERNANCE.md — decision-making processes
- CODE_OF_CONDUCT.md — expectations for dialogue and collaboration
If you're uncertain where to begin, open a **Discusssion** and describe what you'd like to explore.

## Status
**Current phase**: foundation, provenance infrastructure.

Focus areas: audit logging, incident reporting, /explain command, ethical circuit breakers.
