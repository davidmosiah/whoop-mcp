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
