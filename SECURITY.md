# Security Policy

## Supported versions

This project is early-stage. Security fixes target the latest `main` branch until tagged releases exist.

## Reporting a vulnerability

Please report vulnerabilities privately by opening a GitHub security advisory or contacting the maintainer directly. Do not post OAuth tokens, client secrets, token files, or personal health data in public issues.

## Sensitive data handled by this project

- WHOOP OAuth client secret from `WHOOP_CLIENT_SECRET`
- WHOOP local setup config at `~/.whoop-mcp/config.json`
- WHOOP access and refresh tokens in `WHOOP_TOKEN_PATH`
- Personal health, sleep, recovery and workout data returned by the WHOOP API

## Local hardening expectations

- Store tokens on a trusted machine only.
- Prefer `whoop-mcp-server setup` over putting `WHOOP_CLIENT_SECRET` directly in MCP client configs.
- The setup config is written with `0600` permissions and should stay outside synced/shared folders.
- Keep the token path outside synced/shared folders when possible.
- Restrict token file permissions to the local user. The server writes token files with `0600` permissions.
- Avoid passing `--client-secret` on shared shells because it may appear in shell history or process listings; use interactive setup instead.
- Do not paste raw API responses into public issues if they include personal health data.
- Prefer `response_format=markdown` for agent-facing summaries and `response_format=json` only when you need structured processing.

## Non-goals

This MCP server is not a medical device, clinical tool, or emergency monitoring system.

## Input and dependency hardening

The server supports a single trusted local OS user. HTTP remains loopback-only by default and has no per-client authorization layer; do not expose it to untrusted networks.

- Both stdio and HTTP tool calls accept at most 10,000 combined object members and array elements in arguments. Larger inputs fail before tool input-schema validation or tool execution. This is not a global process-memory limit.
- HTTP JSON bodies remain limited to 1 MiB. Compressed request bodies are explicitly unsupported and return HTTP 415; send uncompressed JSON.
- Dependency security updates do not enable caching or change provider authentication. Run `npm run test:input-limits` after a build to verify ordinary requests, the element boundary, oversized arguments, malformed JSON, body size and compressed-body rejection using synthetic data only.

SDK option reference: https://github.com/modelcontextprotocol/typescript-sdk/blob/3b73021a0a2272c0c04c3917bcdb03398b3ec63f/src/server/mcp.ts#L100-L109 . `maxToolInputElements` is opt-in upstream; this server explicitly sets it to 10,000.
