# whoop-mcp-server

Unofficial MCP server for connecting AI agents to the WHOOP API.

> **Unofficial project:** this repository is not affiliated with, endorsed by, sponsored by, or supported by WHOOP, Inc. WHOOP is a trademark of its respective owner. Use this project only with your own WHOOP account and according to WHOOP's Developer Terms and API policies.

## What it does

`whoop-mcp-server` lets MCP-compatible agents read WHOOP data through the official WHOOP OAuth API:

- Profile and body measurements
- Physiological cycles
- Recovery scores, HRV, resting heart rate, SpO2, skin temperature
- Sleep sessions, stages, performance, consistency, efficiency
- Workouts, strain, heart-rate zones and sport metadata

The server runs over MCP `stdio`, so it works well as a local integration for agents such as Hermes, OpenClaw, Claude Desktop, Cursor, and other MCP clients.

## Security and privacy model

- OAuth tokens are stored locally, not returned to the agent.
- Token file defaults to `~/.whoop-mcp/tokens.json` with `0600` permissions.
- Refresh token rotation is protected with a lock file to reduce concurrent-agent refresh races.
- Tools are read-only after OAuth setup.
- This project does not provide medical advice. It exposes user-authorized data for analysis by your own tools/agents.

## Requirements

- Node.js 20+
- A WHOOP Developer app
- OAuth redirect URI configured in the WHOOP Developer Dashboard

Official WHOOP API docs: <https://developer.whoop.com/api/>

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
export WHOOP_REDIRECT_URI="http://localhost:3000/callback"

# Optional
export WHOOP_TOKEN_PATH="$HOME/.whoop-mcp/tokens.json"
export WHOOP_SCOPES="read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement"
```

Default scopes:

```text
read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement
```

## MCP client config

Example local config:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "node",
      "args": ["/absolute/path/to/whoop-mcp/dist/index.js"],
      "env": {
        "WHOOP_CLIENT_ID": "your-client-id",
        "WHOOP_CLIENT_SECRET": "your-client-secret",
        "WHOOP_REDIRECT_URI": "http://localhost:3000/callback"
      }
    }
  }
}
```

If installed globally in the future, the command can be `whoop-mcp-server` instead of `node .../dist/index.js`.

## OAuth flow

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

### User

- `whoop_get_profile` - Get basic profile.
- `whoop_get_body_measurements` - Get height, weight and max heart rate.

### Collections

All collection tools support:

- `start`: ISO date-time filter
- `end`: ISO date-time filter
- `limit`: WHOOP page size, max 25
- `next_token`: cursor from a previous call
- `all_pages`: fetch multiple pages
- `max_pages`: cap for multi-page fetches
- `response_format`: `markdown` or `json`

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

## Example prompts for agents

```text
Use the WHOOP MCP server to summarize my last 7 days of sleep and recovery. Compare HRV, RHR, sleep performance, consistency and strain. Do not provide medical advice.
```

```text
Fetch my latest recovery, latest sleep and workouts from the last 3 days. Give me a practical training recommendation for today based only on the data.
```

## Development

```bash
npm install
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

## Roadmap

- SQLite cache for offline/local analytics
- `whoop_daily_summary` and `whoop_weekly_summary` workflow tools
- Optional HTTP transport
- More structured output schemas
- Safer redaction and audit logging helpers
- Example Hermes/OpenClaw setup guides

## Disclaimer

This software is provided as-is. It is not a medical device, does not provide medical advice, and should not be used for diagnosis or treatment. Always consult qualified professionals for medical concerns.
