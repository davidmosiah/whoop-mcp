# whoop-mcp-server

[![CI](https://github.com/davidmosiah/whoop-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/davidmosiah/whoop-mcp/actions/workflows/ci.yml)

Unofficial MCP server for connecting AI agents to the WHOOP API.

Website: <https://whoopmcp.vercel.app/>

GitHub Pages mirror: <https://davidmosiah.github.io/whoop-mcp/>

> **Unofficial project:** this repository is not affiliated with, endorsed by, sponsored by, or supported by WHOOP, Inc. WHOOP is a trademark of its respective owner. Use this project only with your own WHOOP account and according to WHOOP's Developer Terms and API policies.

Built by [David Mosiah](https://github.com/davidmosiah) for people building practical AI-agent workflows around personal health, recovery, sleep and training context.

## What it does

`whoop-mcp-server` lets MCP-compatible agents read WHOOP data through the official WHOOP OAuth API:

- Profile and body measurements
- Physiological cycles
- Recovery scores, HRV, resting heart rate, SpO2, skin temperature
- Sleep sessions, stages, performance, consistency, efficiency
- Workouts, strain, heart-rate zones and sport metadata
- Daily and weekly workflow summaries for agents
- MCP resources and prompts for agent-native workflows
- Optional SQLite read-through cache
- Privacy modes for summary, structured or raw WHOOP API payloads
- Structured MCP tool outputs and a privacy audit tool
- Human-friendly `doctor` and `auth` CLI commands for setup without manual code copying

The server runs over MCP `stdio`, so it works well as a local integration for agents such as Hermes, OpenClaw, Claude Desktop, Cursor, and other MCP clients.

Helpful docs:

- [Quickstart](docs/quickstart.md)
- [Privacy model](docs/privacy.md)
- [FAQ](docs/faq.md)
- [Roadmap](docs/roadmap.md)
- [Resources and prompts](docs/resources-prompts.md)

## Data availability

This project uses the official WHOOP OAuth API. When the docs or tools say `raw`, they mean the upstream WHOOP API response body for a supported endpoint, not raw device sensor samples.

| Data type | Supported today | Notes |
| --- | --- | --- |
| Profile and body measurements | Yes | Basic profile, height, weight and max heart rate when authorized. |
| Recovery | Yes | Recovery score, HRV, resting heart rate, SpO2 and skin temperature when WHOOP returns a scored recovery. |
| Cycles and strain | Yes | Physiological cycles, day strain, kilojoules and average/max heart rate fields exposed by WHOOP. |
| Sleep | Yes | Sleep sessions, sleep-stage durations, performance, consistency and efficiency fields exposed by WHOOP. |
| Workouts | Yes | Workout strain, sport metadata, heart-rate zones, average/max heart rate and related summary metrics. |
| Raw WHOOP API JSON | Opt-in | Available with `WHOOP_PRIVACY_MODE=raw` or per-call `privacy_mode=raw`. |
| Continuous/high-frequency sensor streams | No | Continuous heart-rate samples and other raw device streams are not available through the official WHOOP API. |
| Live BLE heart-rate listening | No | WHOOP devices can broadcast HR over BLE, but this MCP does not implement a Bluetooth listener. |

## Security and privacy model

- OAuth tokens are stored locally, not returned to the agent.
- Token file defaults to `~/.whoop-mcp/tokens.json` with `0600` permissions.
- Refresh token rotation is protected with a lock file to reduce concurrent-agent refresh races.
- Most tools are read-only after OAuth setup. `whoop_revoke_access` is intentionally destructive and removes access.
- `WHOOP_PRIVACY_MODE` defaults to `structured`; full raw WHOOP API payloads are opt-in.
- This project does not provide medical advice. It exposes user-authorized data for analysis by your own tools/agents.

## Requirements

- Node.js 20+
- A WHOOP Developer app
- OAuth redirect URI configured in the WHOOP Developer Dashboard

Official WHOOP API docs: <https://developer.whoop.com/api/>

## Install with npx

```bash
npx -y whoop-mcp-unofficial doctor
```

For MCP clients, use the package with no subcommand so it starts the MCP stdio server.

## Install from source

```bash
git clone https://github.com/davidmosiah/whoop-mcp.git
cd whoop-mcp
npm install
npm run build
```

## Environment variables

```bash
export WHOOP_CLIENT_ID="your-client-id"
export WHOOP_CLIENT_SECRET="your-client-secret"
export WHOOP_REDIRECT_URI="http://127.0.0.1:3000/callback"

# Optional
export WHOOP_TOKEN_PATH="$HOME/.whoop-mcp/tokens.json"
export WHOOP_SCOPES="read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement"
export WHOOP_PRIVACY_MODE="structured" # summary | structured | raw
export WHOOP_CACHE="sqlite"            # optional: true/sqlite/on
export WHOOP_CACHE_PATH="$HOME/.whoop-mcp/cache.sqlite"
```

Default scopes:

```text
read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement
```

## Human setup flow

This is the recommended path for non-technical setup:

```bash
npx -y whoop-mcp-unofficial setup
npx -y whoop-mcp-unofficial auth
npx -y whoop-mcp-unofficial doctor
```

What these commands do:

- `setup` asks for WHOOP credentials, writes local config, and creates a client config/snippet.
- `doctor` checks Node.js, required WHOOP env vars, redirect URI, token file, privacy mode and cache.
- `auth` starts a temporary local callback server, opens the WHOOP authorization page, captures the OAuth code and saves tokens locally.
- `doctor --json` returns the same setup state in machine-readable form.
- Secrets are stored in `~/.whoop-mcp/config.json` with `0600` permissions, so MCP client configs do not need to contain your WHOOP secret.

For automatic auth, configure the WHOOP Developer app redirect URI as:

```text
http://127.0.0.1:3000/callback
```

## MCP client config

Example local config:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["/absolute/path/to/whoop-mcp/dist/index.js"]
    }
  }
}
```

For npm/npx usage after publication:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "npx",
      "args": ["-y", "whoop-mcp-unofficial"]
    }
  }
}
```

If you do not run `setup`, you can still provide `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` and `WHOOP_REDIRECT_URI` through your MCP client env block. Prefer `setup` for less secret sprawl.

## OAuth flow

Recommended for humans:

```bash
npx -y whoop-mcp-unofficial auth
```

Manual MCP-client flow:

1. Ask your MCP client to call `whoop_get_auth_url`.
2. Open the returned URL and authorize the app.
3. Copy the final `code` or full redirect URL.
4. Ask your MCP client to call `whoop_exchange_code` with that code/URL.
5. Then call read tools such as `whoop_list_recoveries` or `whoop_get_profile`.

The exchange tool stores tokens locally and intentionally does not return token values.

## Tools

### Auth/setup

- `whoop_get_auth_url` - Generate an OAuth authorization URL.
- `whoop_exchange_code` - Exchange authorization code for local tokens.
- `whoop_revoke_access` - Revoke WHOOP OAuth access and delete local tokens.
- `whoop_connection_status` - Check env, token, Node, redirect, privacy and cache readiness without calling WHOOP.

### User

- `whoop_capabilities` - Explain supported data, unavailable sensor streams, privacy modes, recommended agent workflow and project links without reading WHOOP.
- `whoop_get_profile` - Get basic profile.
- `whoop_get_body_measurements` - Get height, weight and max heart rate.
- `whoop_cache_status` - Show optional SQLite cache status.
- `whoop_privacy_audit` - Show local privacy, cache, env-presence and redaction posture without revealing secrets.

### Collections

All collection tools support:

- `start`: ISO date-time filter
- `end`: ISO date-time filter
- `limit`: WHOOP page size, max 25
- `next_token`: cursor from a previous call
- `all_pages`: fetch multiple pages
- `max_pages`: cap for multi-page fetches
- `response_format`: `markdown` or `json`
- `privacy_mode`: optional override: `summary`, `structured`, or `raw`

Tools:

- `whoop_list_cycles`
- `whoop_list_recoveries`
- `whoop_list_sleeps`
- `whoop_list_workouts`

### Resource reads

- `whoop_get_cycle`
- `whoop_get_sleep`
- `whoop_get_workout`
- `whoop_get_cycle_sleep`
- `whoop_get_cycle_recovery`

### Workflow summaries

These tools fetch the required WHOOP collections, compute defensive baselines, and return structured coaching context for agents. They are read-only and do not store data locally.

- `whoop_daily_summary` - Latest recovery/sleep/load signals plus action candidates for the next 24 hours.
- `whoop_weekly_summary` - Weekly scorecard, prior-window comparison, bottlenecks, action candidates and next-week success metrics.

### Resources

- `whoop://capabilities`
- `whoop://latest/recovery`
- `whoop://latest/sleep`
- `whoop://latest/cycle`
- `whoop://summary/daily`
- `whoop://summary/weekly`

### Prompts

- `daily_performance_coach`
- `weekly_training_review`
- `sleep_recovery_investigator`

Daily summary inputs:

- `days`: lookback window for baseline, default `10`, min `7`, max `30`
- `timezone`: display timezone, default `UTC`
- `response_format`: `markdown` or `json`

Weekly summary inputs:

- `days`: recent analysis window, default `7`
- `compare_days`: prior comparison window, default `7`, use `0` to disable comparison
- `timezone`: display timezone, default `UTC`
- `response_format`: `markdown` or `json`

## Example prompts for agents

```text
Use the WHOOP MCP server to summarize my last 7 days of sleep and recovery. Compare HRV, RHR, sleep performance, consistency and strain. Do not provide medical advice.
```

```text
Fetch my latest recovery, latest sleep and workouts from the last 3 days. Give me a practical training recommendation for today based only on the data.
```

```text
Call whoop_weekly_summary with response_format=json, then turn the bottlenecks and success metrics into a concrete training, sleep and focus plan for next week.
```

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Run locally:

```bash
npm run build
node dist/index.js
```

Test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Optional local HTTP transport:

```bash
WHOOP_MCP_TRANSPORT=http WHOOP_MCP_PORT=3000 node dist/index.js
curl http://127.0.0.1:3000/health
```

## Roadmap

- Public npm package publication
- MCP Registry publication

## Disclaimer

This software is provided as-is. It is not a medical device, does not provide medical advice, and should not be used for diagnosis or treatment. Always consult qualified professionals for medical concerns.
