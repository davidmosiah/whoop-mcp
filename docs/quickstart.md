# Quickstart

## 1. Create a WHOOP Developer app

Create an OAuth app in the WHOOP Developer Dashboard.

For the easiest setup, set the redirect URI to:

```text
http://127.0.0.1:3000/callback
```

This lets `whoop-mcp-server auth` capture the OAuth callback automatically.

## 2. Install

From npm after package publication:

```bash
npx -y whoop-mcp-unofficial doctor
```

From source:

```bash
git clone https://github.com/davidmosiah/whoop-mcp.git
cd whoop-mcp
npm ci
npm run build
node dist/index.js doctor
```

## 3. Run setup

This is the recommended path. It stores secrets in `~/.whoop-mcp/config.json` with `0600` permissions and creates a client config/snippet without embedding your WHOOP secret.

```bash
npx -y whoop-mcp-unofficial setup
```

You can also run it non-interactively:

```bash
npx -y whoop-mcp-unofficial setup \
  --client generic \
  --client-id "your-client-id" \
  --client-secret "your-client-secret" \
  --redirect-uri "http://127.0.0.1:3000/callback"
```

Prefer interactive setup on shared machines so your client secret is not stored in shell history.

Optional flags:

```bash
--privacy-mode structured # summary | structured | raw
--cache sqlite
--token-path "$HOME/.whoop-mcp/tokens.json"
--cache-path "$HOME/.whoop-mcp/cache.sqlite"
--client claude # generic | claude | cursor | windsurf | hermes | openclaw
```

## 4. Check setup

```bash
npx -y whoop-mcp-unofficial doctor
```

The doctor command checks env vars, redirect URI, token path, token permissions, privacy mode and cache.

## 5. Authorize WHOOP

```bash
npx -y whoop-mcp-unofficial auth
```

This opens the browser, waits for WHOOP to redirect to the local callback, exchanges the code and stores tokens locally.

If a browser cannot be opened automatically:

```bash
npx -y whoop-mcp-unofficial auth --no-open
```

## 6. Add to your MCP client

Use the package without a subcommand:

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

## 7. Use high-level workflows

Start with:

- `whoop_connection_status`
- `whoop_daily_summary`
- `whoop_weekly_summary`
- prompt `daily_performance_coach`
- prompt `weekly_training_review`

Use raw collection tools only when you need lower-level data access.

Important wording: `raw` means the full JSON returned by supported WHOOP API endpoints. It does not mean continuous device sensor streams or second-by-second heart-rate samples. WHOOP's official API exposes processed recovery, cycle, sleep and workout records, not high-frequency raw sensor data.

## Optional HTTP transport

stdio is the default. For local HTTP testing:

```bash
WHOOP_MCP_TRANSPORT=http WHOOP_MCP_PORT=3000 node dist/index.js
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```
