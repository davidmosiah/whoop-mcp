# Changelog

## 0.4.1 - 2026-05-11

### Fixed

- **Profile-store regex no longer false-positives on common wellness words.** Split `SECRET_PATTERNS` into `SECRET_KEY_PATTERNS` (broad, for field names like `oauth_token`) and `SECRET_VALUE_PATTERNS` (high-specificity, only credential shapes: JWTs, `Bearer <token>`, `sk_live_`, `sk-proj-`, `xoxb-`, `github_pat_`, raw `Authorization:` headers). Previously legitimate text like "5 training sessions per week", "limit cookies", "I need to refresh my approach", or "secret sauce: more sleep" was rejected.
- **Partial-profile reads no longer crash downstream.** `readProfileFile` now structurally merges with `DEFAULT_PROFILE` when legacy Hermes/OpenClaw files lacked sub-objects (goals, devices, training, nutrition, preferences, safety). Previously `buildProfileSummary` and `missingCriticalFields` would throw.
- **Onboarding `privacy_note` no longer hard-codes a single connector path.** Lists multiple example paths so the message reads correctly from every connector.

## 0.4.0 - 2026-05-11

- Add shared Delx wellness profile support, vendored from `delx-wellness/lib/profile-store.ts` into `src/services/profile-store.ts` (no new npm deps; Node built-ins only).
- Add `whoop_profile_get` tool — read the shared profile (`~/.delx-wellness/profile.json`), returns summary, missing_critical fields and storage_path. Read-only.
- Add `whoop_profile_update` tool — patch the shared profile; requires `explicit_user_intent=true`. Rejects any field that looks like a secret (oauth/token/secret/password/cookie/refresh/api_key/session).
- Add `whoop_onboarding` tool — return the 11-question onboarding flow (`en` or `pt-BR`) plus current profile state and missing critical fields. Read-only.
- Add `whoop-mcp-server onboarding` CLI command — print the onboarding flow JSON (and a TTY-friendly Markdown summary when stderr is a TTY).
- `recommended_first_calls` now leads with `whoop_profile_get` so agents check the shared profile state before walking quickstart.
- Auto-migration from Hermes (`~/.hermes/profiles/delx-wellness/wellness-profile.json`) and OpenClaw (`~/.openclaw-delx-wellness/workspace/wellness-profile.json`) legacy paths to the canonical `~/.delx-wellness/profile.json`.
- Tool count: 25 → 28.

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
