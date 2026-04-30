# Privacy Model

This project handles sensitive personal health data. The default posture is to expose structured fields, not raw WHOOP payloads.

## Privacy modes

Set globally:

```bash
export WHOOP_PRIVACY_MODE="structured"
```

Or per supported tool call with `privacy_mode`.

Modes:

- `summary`: minimum fields needed for basic interpretation.
- `structured`: normalized fields useful for agents and analytics. This is the default.
- `raw`: full WHOOP API payload. Use only when you explicitly need upstream details.

## Token storage

OAuth tokens are stored locally at `WHOOP_TOKEN_PATH`, defaulting to:

```text
~/.whoop-mcp/tokens.json
```

The token file is written with `0600` permissions. Do not place token files in public repos, shared folders or logs.

## SQLite cache

If enabled with `WHOOP_CACHE=sqlite`, API responses are cached locally in SQLite. This improves resilience and reduces repeated reads, but it also stores health data locally. Keep the cache path private.

## Revoke access

Use `whoop_revoke_access` to revoke the WHOOP OAuth grant and delete the local token file.

## Audit and redaction

Use `whoop_privacy_audit` to inspect the local privacy posture without exposing secret values. Tool responses use structured MCP output and redact common secret-bearing keys such as OAuth access tokens, refresh tokens, client secrets and authorization headers.
