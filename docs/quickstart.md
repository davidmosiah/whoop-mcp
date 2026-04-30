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
npx -y @davidmosiah/whoop-mcp-server doctor
```

From source:

```bash
git clone https://github.com/davidmosiah/whoop-mcp.git
cd whoop-mcp
npm ci
npm run build
node dist/index.js doctor
```

## 3. Configure env

```bash
export WHOOP_CLIENT_ID="your-client-id"
export WHOOP_CLIENT_SECRET="your-client-secret"
export WHOOP_REDIRECT_URI="http://127.0.0.1:3000/callback"
```

Optional:

```bash
export WHOOP_PRIVACY_MODE="structured" # summary | structured | raw
export WHOOP_CACHE="sqlite"
export WHOOP_CACHE_PATH="$HOME/.whoop-mcp/cache.sqlite"
export WHOOP_TOKEN_PATH="$HOME/.whoop-mcp/tokens.json"
```

## 4. Check setup

```bash
npx -y @davidmosiah/whoop-mcp-server doctor
```

The doctor command checks env vars, redirect URI, token path, token permissions, privacy mode and cache.

## 5. Authorize WHOOP

```bash
npx -y @davidmosiah/whoop-mcp-server auth
```

This opens the browser, waits for WHOOP to redirect to the local callback, exchanges the code and stores tokens locally.

If a browser cannot be opened automatically:

```bash
npx -y @davidmosiah/whoop-mcp-server auth --no-open
```

## 6. Add to your MCP client

Use the package without a subcommand:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "npx",
      "args": ["-y", "@davidmosiah/whoop-mcp-server"],
      "env": {
        "WHOOP_CLIENT_ID": "your-client-id",
        "WHOOP_CLIENT_SECRET": "your-client-secret",
        "WHOOP_REDIRECT_URI": "http://127.0.0.1:3000/callback",
        "WHOOP_PRIVACY_MODE": "structured"
      }
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

## Optional HTTP transport

stdio is the default. For local HTTP testing:

```bash
WHOOP_MCP_TRANSPORT=http WHOOP_MCP_PORT=3000 node dist/index.js
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```
