# WHOOP OAuth Setup

Create a WHOOP Developer app in the WHOOP Developer Dashboard and configure a redirect URI.

Required environment variables:

```bash
WHOOP_CLIENT_ID="..."
WHOOP_CLIENT_SECRET="..."
WHOOP_REDIRECT_URI="http://127.0.0.1:3000/callback"
```

Default scopes:

```text
read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement
```

The easiest human flow:

```bash
whoop-mcp-server doctor
whoop-mcp-server auth
whoop-mcp-server doctor
```

`auth` opens the browser, captures the local callback and stores tokens without printing token values.

The manual MCP flow:

1. `whoop_get_auth_url`
2. Browser approval
3. `whoop_exchange_code`
4. Data tools and summaries

Tokens rotate during refresh. This server uses a local lock file to reduce refresh-token races when multiple agents call the server concurrently.
