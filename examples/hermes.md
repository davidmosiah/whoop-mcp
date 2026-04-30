# Hermes / local agent setup

This server runs over MCP stdio. Add it to your agent's MCP configuration using a local Node command.

```yaml
mcp_servers:
  whoop:
    command: npx
    args:
      - -y
      - "@davidmosiah/whoop-mcp-server"
    env:
      WHOOP_CLIENT_ID: your-client-id
      WHOOP_CLIENT_SECRET: your-client-secret
      WHOOP_REDIRECT_URI: http://localhost:3000/callback
      WHOOP_TOKEN_PATH: /root/.whoop-mcp/tokens.json
      WHOOP_PRIVACY_MODE: structured
      WHOOP_CACHE: sqlite
```

Recommended first run:

1. Ask the agent to call `whoop_get_auth_url`.
2. Open the returned URL and authorize WHOOP.
3. Give the returned code/full redirect URL to `whoop_exchange_code`.
4. Call `whoop_daily_summary` or `whoop_weekly_summary`.

Keep `WHOOP_CLIENT_SECRET` and `WHOOP_TOKEN_PATH` out of prompts, logs and public repos.
