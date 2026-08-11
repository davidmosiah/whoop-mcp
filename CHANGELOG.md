## 0.6.1 - 2026-08-01

### Fixed

- **The README was still teaching the contract 0.6.0 deleted.** 0.6.0 fixed the
  `whoop_demo` tool but nothing compared the README with it, so the first thing
  a human reads on this repo kept advertising `whoop_daily_summary.recovery.hrv_ms`,
  `sleep.duration_min`, `sleep.stages.rem_min`, `strain.day_strain`,
  `wellness_context.recovery_band` and `records[].score: 67`. The server returns
  `latest.recovery.hrv_rmssd_milli`, `latest.sleep.actual_sleep_hours`, no
  `stages` block at all, and a `score` that is an **object**. Copying the old
  README example produced a parser that reads `undefined` on every field without
  raising anything.
- The published `markdown` example was wrong too: it showed a `recommendation`
  line the tool never prints and called sleep `sleep_performance` instead of
  `sleep_score`, while omitting `strain_score`, `recent_training_load` and
  `recommended_handoff`.
- Both README examples are now generated from the real tool: 113 key paths,
  their types and their values.

### Added

- `npm run test:readme-contract` (wired into `npm test`) parses the examples out
  of README.md and compares them with a live `whoop_demo` call, failing in four
  directions: a key the README invents, a key it omits, a shared key whose type
  disagrees, and a scalar value gone stale. The example is read from the file,
  never copied into the test — a copy would only move the drift one layer up.

## 0.6.0 - 2026-08-01

### Fixed

- **`whoop_demo` was teaching agents a contract the server never returns.** Every
  one of the 16 key paths in the `whoop_daily_summary` example was invented
  (`date`, `recovery.score`, `sleep.stages.rem_min`, `strain.day_strain`,
  `workouts`, …) while all 53 real ones were missing — an agent that wrote a
  parser against the demo got zero fields on the first live call. Same class of
  error in the other two samples: `whoop_wellness_context` invented 7 keys
  (`window`, `recovery_band`, `sleep_performance`, `day_strain`, `hrv_ms`,
  `resting_heart_rate`, `recommendation`) and omitted 26 including the whole
  `data_quality`, `recommended_handoff` and `telegram_summary` blocks;
  `whoop_list_recoveries` omitted the `endpoint` / `privacy_mode` / `next_token`
  / `has_more` / `pages_fetched` envelope and 18 record fields.
- **The worst one was silent:** the demo called HRV `hrv_ms` while the server
  emits `hrv_rmssd_milli`, and showed `records[].score` as a NUMBER where the
  real structured payload returns an OBJECT. An agent reading `score` there
  "finds" the field and reads it wrong.
- All three samples now match what the real tools return, key for key and type
  for type, including the `next_token` pagination envelope.

### Added

- `npm run test:demo-contract` (wired into `npm test`): registers the real tools
  on a real MCP server, drives them over a synthetic WHOOP API, and fails the
  build in three directions — a key the demo invents, a contract key the demo
  omits, and a shared key whose type disagrees. Arrays compare as the union of
  their elements, so a partially scored record cannot hide half the shape.

## 0.5.7 - 2026-07-30

### Added / Fixed

- Use delx-mcp-kit for privacy escalation; exchange/gate hygiene.

# Changelog

## 0.6.2

- Security: override `fast-uri@3.1.5` and `ip-address@10.4.0` (high Dependabot).




## 0.5.6 - 2026-07-30

### Security

- Agent-requested `privacy_mode=raw` requires `explicit_user_intent=true` (config-default raw still allowed without per-call intent).

## 0.5.5 - 2026-07-30

### Security

- Security: require explicit_user_intent on revoke/disconnect tools so agents cannot wipe OAuth grants autonomously.

## 0.5.4 - 2026-07-16

### Fixed

- Preserve complete upstream recovery, sleep, cycle and workout records in structured mode, including nested scores and future WHOOP fields, while redacting GPS and secret-bearing values.
- Validate WHOOP `start` and `end` as timezone-aware ISO date-times and reject reversed or invalid ranges before any HTTP request.
- Add an executable HTTP-boundary regression suite for exact date-time forwarding, cursor pagination, response extraction and pre-network validation.
- Prove that summary collection failures propagate to the caller instead of being silently converted into partial success.

## 0.5.3 - 2026-06-27

### Added

- Add `whoop-mcp-server demo-capture`, a privacy-sanitized real-demo capture
  command that gates on local OAuth readiness, runs the `whoop_daily_summary`
  path, emits JSON/Markdown transcripts and fails if secrets, local token paths,
  raw payloads, exact recovery numbers or exact sleep details appear.
- Add a fixture-backed demo-capture regression test and a versioned
  `docs/demo/recovery-demo-redaction-contract.md` sample so public WHOOP demos
  have a reviewable privacy contract before real-account captures are shared.

## 0.5.2 - 2026-06-27

### Docs

- Add explicit prior-work credit for Shashank Mishra and the MIT-licensed
  `whoop-ai-mcp` package in the README, docs site, LLM docs and new
  `docs/credits.md` page.
- Add metadata checks so the Shashank / `whoop-ai-mcp` attribution cannot be
  accidentally removed from primary docs.

## 0.5.1 - 2026-06-27

### Security

- Pin transitive `hono` resolution to `4.12.27` via npm overrides, resolving production audit advisories while keeping the public MCP API unchanged.

## 0.5.0 - 2026-06-02

### Added
- **MCP completions on prompt arguments** — the `timezone` arg on all 3 prompts (`whoop_daily_performance_coach`, `whoop_weekly_training_review`, `whoop_sleep_recovery_investigator`) now autocompletes common IANA timezones, so MCP clients (Claude, Goose, Cursor) suggest valid values instead of the agent guessing.
- **Parameterized resource template `whoop://latest/{type}`** — agents can read the latest record for any domain (`recovery` | `sleep` | `cycle` | `workout`) via one URI, with `{type}` autocompletion. Adds `workout` (no fixed resource before) and reuses the privacy-mode-aware reader. The fixed `whoop://latest/{recovery,sleep,cycle}` resources remain for listing. No behavior or gating change.

## 0.4.5 - 2026-05-29

### Docs

- **README "See it before you connect" section** — documents the existing `whoop_demo` tool with real captured markdown + JSON output, so agents and first-time users can see the recovery/sleep/strain data contract before completing OAuth. Adds `whoop_demo` to the "Start with these" tools list. No code changes.

## 0.4.3 - 2026-05-20

### Added

- **HTTP response cache middleware** (`src/services/http-cache.ts`) — in-memory cache layered OUTSIDE retry (`fetchWithCache → fetchWithRetry → fetch`), so cached responses skip both network and retry. Default 60s TTL for GET only; POST/PUT/DELETE and 4xx/5xx responses are never cached.
- **`WHOOP_NO_CACHE=true` env var** — global per-process cache bypass; advertised in `server.json`.
- **Per-call `cache_ttl: 0`** request option — opts a single call out of cache without disabling globally.
- **Query-param-order-insensitive cache keys** — `?start=…&end=…&limit=…` and `?limit=…&end=…&start=…` share one cache entry.
- **`whoop_cache_status` now reports `http_cache` stats** alongside SQLite stats: `size`, `hit_count`, `miss_count`, `hit_rate`, `default_ttl_seconds`, `bypass_env_var`.
- `scripts/http-cache-test.mjs` — eight-case unit suite covering cache hit, POST never cached, TTL expiration, query-param normalization, 4xx not cached, env-var bypass, per-call `cache_ttl: 0`, and `getCacheStats()` math.

## 0.4.2 - 2026-05-19

### Added

- **Dedicated HTTP retry middleware** (`src/services/http-retry.ts`) — extracted from `WhoopClient.fetchWithRetry` into a reusable, testable function with exponential backoff (500ms / 1s / 2s), ±20% jitter, and `Retry-After` header parsing (supports both seconds and HTTP-date formats).
- **`WHOOP_NO_RETRY=true` env flag** — disables retries entirely for tests or callers that want raw error propagation.
- **HTTP 408 added to retryable status set** alongside 429, 500, 502, 503, 504 — request-timeout responses are now transparently retried.
- **Network-error retries** — fetch failures (ECONNRESET, ENOTFOUND, timeouts) are now retried with the same backoff schedule as HTTP errors instead of bubbling up on the first failure.
- **Structured stderr logs** — each retry now writes `[whoop-mcp] retry N/3 after Xms (status=Y or error=Z)` so agents can correlate spike-and-recovery patterns in their logs.
- `scripts/http-retry-test.mjs` — six-case unit suite covering happy path, Retry-After header, env disable flag, 401 non-retry, exhaustion, and network-error retry.

### Changed

- `WhoopClient.fetchWithRetry` now delegates to the shared middleware so the auth-failure 401 re-auth flow benefits from the same backoff guarantees.
- Backoff no longer falls back to `x-ratelimit-reset` only — defers to `Retry-After` first (standard) and only computes jittered exponential if the header is absent or unparseable.

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
