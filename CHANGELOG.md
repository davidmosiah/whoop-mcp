# Changelog

## 0.3.0 - 2026-05-10

- Add `whoop_quickstart` tool — personalized 3-step setup walkthrough adapted to current state (env vars set? OAuth token present? what's next?). Returns cross-connector hints to pair with wellness-nourish, wellness-cycle-coach, and wellness-cgm-mcp.
- Add `whoop_demo` tool — realistic example payloads of `whoop_daily_summary`, `whoop_wellness_context`, and `whoop_list_recoveries` so agents see the contract before any real WHOOP API call.
- `recommended_first_calls` on the agent manifest now leads with `whoop_quickstart` and `whoop_demo`.
- Tool count: 23 → 25.

## 0.1.4

- Add SEO/GEO production metadata: JSON-LD, robots.txt, sitemap.xml, llms.txt, security.txt and PNG social preview.
- Include SEO/GEO static docs in npm package files while continuing to exclude local Vercel metadata.

## 0.1.3

- Set `https://whoopmcp.vercel.app/` as the primary project URL in README/package metadata while keeping GitHub Pages as a mirror.
- Refine the landing page hero, install path, project links and architecture section for a clearer first-time user experience.
- Add a new high-fidelity SVG architecture visual and refresh the hero illustration.
- Tighten npm package file inclusion so local Vercel metadata cannot ship in package tarballs.

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
