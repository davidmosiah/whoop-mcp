# WHOOP OAuth Setup

Create a WHOOP Developer app in the WHOOP Developer Dashboard and configure a redirect URI.

Required environment variables:

```bash
WHOOP_CLIENT_ID="..."
WHOOP_CLIENT_SECRET="..."
WHOOP_REDIRECT_URI="http://localhost:3000/callback"
```

Default scopes:

```text
read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement
```

The MCP flow:

1. `whoop_get_auth_url`
2. Browser approval
3. `whoop_exchange_code`
4. Data tools and summaries

Tokens rotate during refresh. This server uses a local lock file to reduce refresh-token races when multiple agents call the server concurrently.
