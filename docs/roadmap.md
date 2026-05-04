# Roadmap

This roadmap prioritizes trust, installability and agent usefulness over flashy surface area.

## Current strengths

- Official WHOOP OAuth API boundary.
- Local-first token storage.
- Structured MCP tool outputs.
- Read-only data tools by default.
- Privacy modes: `summary`, `structured`, `raw`.
- Daily and weekly workflow summaries.
- Setup, auth and doctor CLI flow.
- Static `whoop_capabilities` tool/resource for agent self-discovery.

## Near-term priorities

### 1. Better non-technical onboarding

- Add screenshots or short videos for creating the WHOOP Developer app.
- Add client-specific setup pages for Claude Desktop, Cursor, Windsurf, Hermes and OpenClaw.
- Improve `doctor` output with exact remediation commands where safe.

### 2. Stronger agent evaluations

- Add deterministic fixture-based evals for daily and weekly summary quality.
- Add eval prompts that verify agents choose the correct tool sequence.
- Add privacy evals that assert tokens and secrets never appear in output.

### 3. Better examples

- Add sample `whoop_daily_summary` and `whoop_weekly_summary` JSON/Markdown outputs using synthetic data.
- Add example agent conversations for training, sleep, recovery and weekly planning.
- Add integration examples for local agent runtimes.

### 4. Community contribution loop

- Keep clear issue templates for install help, data coverage requests and feature proposals.
- Label small docs/client examples as `good first issue`.
- Keep unsupported data boundaries explicit so contributors do not accidentally push the project toward private/internal APIs.

## Possible future work

### Optional BLE sidecar

WHOOP devices can broadcast heart rate over Bluetooth Low Energy, but that is separate from the official OAuth API. If added, it should be an optional sidecar with explicit local consent, clear platform constraints and no implication that the official WHOOP API provides continuous HR streams.

### Hosted/remote MCP

A hosted version would require production-grade account isolation, encrypted token storage, consent screens, audit logs, deletion controls, rate limits and security review. The local-first version remains the safest default today.

### More official API coverage

If WHOOP exposes additional official endpoints, this project should add them behind read-only tools with clear schemas, pagination and privacy-mode support.
