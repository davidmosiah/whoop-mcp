---
name: whoop-mcp
description: >-
  Read the user's WHOOP recovery, HRV, sleep and strain through the local whoop MCP server. Use when the user asks about WHOOP data, recovery score, whether to train hard or rest today, sleep performance, strain, HRV trends, or a daily or weekly recovery brief. Starts with connection status, falls back to synthetic demo data before OAuth, and never asks for secrets in chat.
---

# WHOOP

MCP server `whoop` from the `whoop-mcp-unofficial@0.7.0` npm package, run locally through `npx`. It reads recovery, HRV, resting heart rate, sleep stages and performance, strain, cycles and workouts. Data source: the official WHOOP OAuth API (v2).

## Workflow

1. Start with `whoop_connection_status`. Then pick what fits the question: `whoop_daily_summary`, `whoop_weekly_summary`, `whoop_recovery_trend`, `whoop_sleep_trend`.
2. If `whoop_connection_status` reports the connector is not ready, call `whoop_demo` for clearly labelled synthetic data so the user sees the shape of the answer, then give them the setup commands below to run in their own terminal.
3. Lead with the answer to the user's question, then the two or three numbers that support it, with dates. Say when data is missing or stale instead of filling gaps.

## Setup (the user runs this in a terminal, not in chat)

```bash
npx -y whoop-mcp-unofficial@0.7.0 setup --client generic
npx -y whoop-mcp-unofficial@0.7.0 auth
npx -y whoop-mcp-unofficial@0.7.0 doctor
```

`setup` asks for the WHOOP developer app client ID and secret and saves them locally (`--client generic` because this plugin already registers the server with Hermes); `auth` opens the WHOOP consent page in the browser and stores the OAuth tokens under `~/.whoop-mcp/` with 0600 permissions; `doctor` confirms readiness.

## Safety

- Never ask the user to paste client secrets, passwords, tokens or MFA codes into the chat; setup happens in their terminal.
- Tools that change local state: whoop_profile_update (local profile only), whoop_exchange_code (stores OAuth tokens locally). Use them only when the user asks.
- Destructive: whoop_revoke_access (revokes the WHOOP grant and deletes local tokens). Confirm with the user first.
- Not medical advice: the data supports personal reflection and planning, not diagnosis or treatment. Point the user to a clinician for symptoms, medication or anything urgent.
