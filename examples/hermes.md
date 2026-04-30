# Hermes / local agent setup

This server runs over MCP stdio. Add it to your agent's MCP configuration using a local Node command.

```yaml
mcp_servers:
  whoop:
    command: npx
    args:
      - -y
      - "whoop-mcp-unofficial"
```

Recommended first run:

1. Run `whoop-mcp-server setup --client hermes`.
2. Run `whoop-mcp-server auth`.
3. Ask Hermes to call `whoop_connection_status`.
4. Call `whoop_daily_summary` or `whoop_weekly_summary`.

Keep `WHOOP_CLIENT_SECRET` and `WHOOP_TOKEN_PATH` out of prompts, logs and public repos. `setup` stores secrets in the local WHOOP MCP config instead of this agent config.
