# Changelog

## 0.1.2

- Add `whoop_capabilities` and `whoop://capabilities` so agents can discover supported data, unsupported raw sensor streams, privacy modes and recommended tool order without calling WHOOP.
- Add explicit data-boundary documentation for raw WHOOP API payloads vs raw device sensor streams.
- Add FAQ, roadmap, install-help/data-coverage issue templates and PR checklist.
- Improve the GitHub Pages site with data-boundary, FAQ and community/contribution sections.

## 0.1.1

- Add `whoop-mcp-unofficial` as a binary alias so `npx -y whoop-mcp-unofficial setup` works directly.

## 0.1.0

Initial public SOTA-oriented release candidate.

- WHOOP OAuth authorization and code exchange.
- Refresh-token locking for concurrent agents.
- WHOOP v2 profile, body, cycle, recovery, sleep and workout tools.
- Daily and weekly summary workflow tools.
- Privacy modes: `summary`, `structured`, `raw`.
- Optional SQLite read-through cache.
- MCP resources for latest records and summaries.
- MCP prompts for daily coaching, weekly training review and sleep/recovery investigation.
- Local token storage with restrictive file permissions.
- Revoke-access tool.
- CI, smoke test and fixture tests.
