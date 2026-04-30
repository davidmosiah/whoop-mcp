# Quickstart

## 1. Install

From npm after package publication:

```bash
npx -y @davidmosiah/whoop-mcp-server
```

From source:

```bash
git clone https://github.com/davidmosiah/whoop-mcp.git
cd whoop-mcp
npm ci
npm run build
node dist/index.js
```

## Optional HTTP transport

stdio is the default. For local HTTP testing:

```bash
WHOOP_MCP_TRANSPORT=http WHOOP_MCP_PORT=3000 node dist/index.js
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

## 2. Configure env

```bash
export WHOOP_CLIENT_ID="your-client-id"
export WHOOP_CLIENT_SECRET="your-client-secret"
export WHOOP_REDIRECT_URI="http://localhost:3000/callback"
```

Optional:

```bash
export WHOOP_PRIVACY_MODE="structured" # summary | structured | raw
export WHOOP_CACHE="sqlite"
export WHOOP_CACHE_PATH="$HOME/.whoop-mcp/cache.sqlite"
export WHOOP_TOKEN_PATH="$HOME/.whoop-mcp/tokens.json"
```

## 3. Authorize WHOOP

1. Call `whoop_get_auth_url`.
2. Open the returned URL.
3. Approve access.
4. Copy the returned `code` or full redirect URL.
5. Call `whoop_exchange_code` with it.

## 4. Use high-level workflows

Start with:

- `whoop_daily_summary`
- `whoop_weekly_summary`
- prompt `daily_performance_coach`
- prompt `weekly_training_review`

Use raw collection tools only when you need lower-level data access.
