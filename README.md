<!-- delx-wellness header v2 -->
<h1 align="center">WHOOP MCP</h1>

<div align="center">
  <img src="assets/banner.png" alt="WHOOP MCP — WHOOP MCP for AI agents" width="85%" />
</div>

<h3 align="center">
  Give your AI agent your WHOOP recovery, sleep, strain and HRV &mdash; without copy-pasting from the app.<br>
  Local-first MCP server &mdash; <strong>tokens never leave your machine</strong>.
</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/whoop-mcp-unofficial"><img src="https://img.shields.io/npm/v/whoop-mcp-unofficial?style=for-the-badge&labelColor=0F172A&color=10B981&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/davidmosiah/whoop-mcp/releases/latest"><img src="https://img.shields.io/github/v/release/davidmosiah/whoop-mcp?style=for-the-badge&labelColor=0F172A&color=2563EB&logo=github" alt="GitHub release" /></a>
  <a href="https://www.npmjs.com/package/whoop-mcp-unofficial"><img src="https://img.shields.io/npm/dm/whoop-mcp-unofficial?style=for-the-badge&labelColor=0F172A&color=0EA5A3&logo=npm&logoColor=white" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-22C55E?style=for-the-badge&labelColor=0F172A" alt="License MIT" /></a>
  <a href="https://wellness.delx.ai/connectors/whoop"><img src="https://img.shields.io/badge/SITE-wellness.delx.ai-0EA5A3?style=for-the-badge&labelColor=0F172A" alt="Site" /></a>
</p>

<p align="center">
  <a href="https://github.com/davidmosiah/whoop-mcp/stargazers"><img src="https://img.shields.io/github/stars/davidmosiah/whoop-mcp?style=for-the-badge&labelColor=0F172A&color=FBBF24&logo=github" alt="GitHub stars" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/BUILT_FOR-MCP-7C3AED?style=for-the-badge&labelColor=0F172A" alt="Built for MCP" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness/blob/main/docs/release-index.md"><img src="https://img.shields.io/badge/VERIFIED-release_index-0EA5A3?style=for-the-badge&labelColor=0F172A" alt="Verified release index" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness-hermes"><img src="https://img.shields.io/badge/HERMES-one--command_setup-10B981?style=for-the-badge&labelColor=0F172A" alt="Hermes one-command setup" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness"><img src="https://img.shields.io/badge/WHOOP-FF0026?style=for-the-badge&labelColor=0F172A&logoColor=white" alt="WHOOP" /></a>
</p>

> ⚡ **One-command install** with [Delx Wellness for Hermes](https://github.com/davidmosiah/delx-wellness-hermes):
> `npx -y delx-wellness-hermes setup` &mdash; preconfigures this connector and the full Delx Wellness stack in a dedicated Hermes profile.
>
> Or wire it standalone into Claude Desktop / Cursor / ChatGPT Desktop &mdash; see the install section below. Runnable examples live in the [Delx Agent Workbench](https://github.com/davidmosiah/delx-agent-workbench).

> **Public proof:** WHOOP MCP is tracked in the Delx [Open Source Growth Snapshot](https://github.com/davidmosiah/delx-wellness/blob/main/docs/open-source-growth-snapshot.md) alongside downloads, stars and next-action priorities. If it saves you OAuth and MCP setup time, star this repo so other recovery-focused agent builders can find it faster.
>
> **First useful prompt:** `Use whoop_connection_status, then whoop_daily_summary, then give me a 5-line operating brief for today.`

---

<!-- /delx-wellness header v2 -->

**Local-first MCP server that connects AI agents to your WHOOP recovery, sleep, strain and HRV data.**

> **Unofficial project.** Not affiliated with, endorsed by or supported by WHOOP, Inc. WHOOP is a trademark of its respective owner. Use this only with your own WHOOP account and in line with WHOOP's Developer Terms.

Built by [David Mosiah](https://github.com/davidmosiah) for people who use Claude, Cursor, Hermes, OpenClaw or other MCP-compatible agents to think about training, sleep and recovery — without copy-pasting numbers from the WHOOP app.

Part of [Delx Wellness](https://github.com/davidmosiah/delx-wellness), a registry of local-first wellness MCP connectors.

## Prior work and credits

WHOOP MCP Unofficial builds on prior WHOOP MCP groundwork by
[Shashank Mishra](https://github.com/shashankswe2020-ux), including the
OAuth/WHOOP API direction and the earlier MIT-licensed
[`whoop-ai-mcp`](https://www.npmjs.com/package/whoop-ai-mcp) package
([source](https://github.com/shashankswe2020-ux/whoop-mcp)). This project
extends that foundation with local-first setup, privacy audits, dual transport,
agent manifests, summaries, caching, registry metadata and Delx Wellness hub
integration.

> If this connector helps your agent workflow, please star the repo. Stars make the project easier for other AI builders to discover and help Delx keep shipping local-first wellness infrastructure.

<p align="center">
  <img src="assets/whoop-agent-demo.svg" alt="WHOOP MCP local-first agent workflow demo" width="92%" />
</p>

## Why this exists

WHOOP gives you rich physiology — recovery score, HRV, sleep stages, strain — but it lives behind an OAuth API and a closed app. Bringing it into your AI agent today means writing the OAuth dance yourself, storing tokens safely, normalizing responses and handling pagination.

This package does all of that locally, exposes WHOOP through the Model Context Protocol, and lets any MCP-compatible agent read your WHOOP context with one config snippet. Tokens never leave your machine.

## Setup in 60 seconds

You'll need a WHOOP Developer app ([create one here](https://developer.whoop.com/)) with redirect URI `http://127.0.0.1:3000/callback`.

```bash
npx -y whoop-mcp-unofficial setup    # interactive: paste client id + secret
npx -y whoop-mcp-unofficial auth     # opens browser, captures the OAuth code
npx -y whoop-mcp-unofficial doctor   # verifies you're ready
```

Then add this to your MCP client config:

```json
{
  "mcpServers": {
    "whoop": {
      "command": "npx",
      "args": ["-y", "whoop-mcp-unofficial"]
    }
  }
}
```

For Claude Desktop, run `setup --client claude` and the snippet is written for you.

## See it before you connect

No WHOOP account yet? Call `whoop_demo` — it returns realistic **synthetic** recovery, sleep and strain payloads (tagged `is_demo: true`) so your agent learns the data contract before any OAuth. Just ask:

```text
Call whoop_demo and explain what my daily WHOOP signals would look like.
```

Default (`markdown`) output:

<!-- whoop-demo-markdown:start -->
```text
# WHOOP Demo

- **is_demo**: true
- **recovery_score**: 67
- **sleep_score**: 88
- **strain_score**: 11.2
- **recent_training_load**: normal
- **recommended_handoff**: exercise_catalog_recommend_session
```
<!-- whoop-demo-markdown:end -->

With `response_format=json` you get the full shape the live tools return:

<!-- whoop-demo-json:start -->
```json
{
  "ok": true,
  "is_demo": true,
  "sample": {
    "whoop_daily_summary": {
      "kind": "daily_summary",
      "generated_at": "2026-05-01T09:20:00.000Z",
      "lookback_days": 10,
      "data_quality": {
        "confidence": "high",
        "counts": {
          "recoveries": 8,
          "sleeps": 8,
          "cycles": 8,
          "workouts": 3
        },
        "pages_fetched": {
          "recoveries": 1,
          "sleeps": 1,
          "cycles": 1,
          "workouts": 1
        }
      },
      "latest": {
        "recovery": {
          "date": "2026-05-01, 6:12 a.m.",
          "score": 67,
          "band": "green",
          "hrv_rmssd_milli": 58,
          "hrv_delta_pct": -6,
          "resting_heart_rate": 52,
          "resting_hr_delta_bpm": 2,
          "score_state": "SCORED"
        },
        "sleep": {
          "start": "2026-04-30, 10:48 p.m.",
          "performance_pct": 88,
          "consistency_pct": 74,
          "efficiency_pct": 91,
          "actual_sleep_hours": 7.7,
          "sleep_need_hours": 8.4,
          "sleep_debt_hours": 0.6,
          "awake_minutes": 26,
          "disturbances": 5,
          "score_state": "SCORED"
        },
        "cycle": {
          "start": "2026-05-01, 5:04 a.m.",
          "strain": 11.2,
          "baseline_strain": 12.4,
          "score_state": "SCORED"
        },
        "workout": {
          "start": "2026-05-01, 6:35 a.m.",
          "sport": "running",
          "strain": 8.2,
          "high_zone_minutes": 15,
          "aerobic_minutes": 50,
          "score_state": "SCORED"
        }
      },
      "diagnostic": {
        "primary_signal": "Recovery is 67 (green).",
        "signals": [
          "Recovery is 67 (green).",
          "HRV is 58 ms (-6% vs recent baseline).",
          "Resting HR is 52 bpm (2 bpm vs recent baseline).",
          "Sleep performance is 88%; actual sleep 7.7h vs need 8.4h.",
          "Latest cycle strain is 11.2 vs baseline 12.4.",
          "Latest workout: running, strain 8.2."
        ],
        "action_candidates": [
          "Training: good window for progressive load if sleep, soreness and schedule are aligned.",
          "Cognition: schedule deep work during the most stable energy window; use shorter analytical blocks if readiness is low."
        ],
        "disclaimer": "Performance coaching only; not medical advice."
      }
    },
    "whoop_wellness_context": {
      "source": "whoop",
      "context_contract_version": "delx-wellness-context/v1",
      "context_type": "wellness_context",
      "generated_at": "2026-05-01T09:20:00.000Z",
      "recovery_score": 67,
      "sleep_score": 88,
      "strain_score": 11.2,
      "recent_training_load": "normal",
      "soreness": [],
      "injury_flags": [],
      "notes": [
        "WHOOP recovery band: green.",
        "Latest workout: running."
      ],
      "data_quality": {
        "confidence": "high",
        "counts": {
          "recoveries": 8,
          "sleeps": 8,
          "cycles": 8,
          "workouts": 3
        },
        "pages_fetched": {
          "recoveries": 1,
          "sleeps": 1,
          "cycles": 1,
          "workouts": 1
        }
      },
      "recommended_handoff": {
        "tool": "exercise_catalog_recommend_session",
        "reason": "Use WHOOP recovery, sleep and strain to scale workout intensity and volume."
      },
      "telegram_summary": "WHOOP wellness context | Recovery: 67 | Sleep: 88 | Strain: 11.2 | Load: normal"
    },
    "whoop_list_recoveries": {
      "endpoint": "/v2/recovery",
      "privacy_mode": "structured",
      "count": 3,
      "records": [
        {
          "cycle_id": 93101,
          "sleep_id": "1a2b3c4d-0000-4000-8000-000000000001",
          "created_at": "2026-05-01T09:14:00.000Z",
          "updated_at": "2026-05-01T09:14:00.000Z",
          "score_state": "SCORED",
          "recovery_score": 67,
          "resting_heart_rate": 52,
          "hrv_rmssd_milli": 58,
          "user_id": 10000001,
          "user_calibrating": false,
          "spo2_percentage": 96.1,
          "skin_temp_celsius": 33.7,
          "score": {
            "user_calibrating": false,
            "recovery_score": 67,
            "hrv_rmssd_milli": 58,
            "resting_heart_rate": 52,
            "spo2_percentage": 96.1,
            "skin_temp_celsius": 33.7
          }
        }
      ],
      "next_token": "c3ludGhldGljLWRlbW8tcGFnZS0y",
      "has_more": true,
      "pages_fetched": 1
    }
  },
  "notes": [
    "All sample data is synthetic; tagged with is_demo=true.",
    "Real calls return live data from the WHOOP Developer API after OAuth setup.",
    "Shapes are verified against the real tools by scripts/demo-contract-test.mjs on every build.",
    "whoop_list_recoveries is shown in the default privacy_mode=structured; summary mode drops the nested score object.",
    "Performance coaching only; not medical advice."
  ]
}
```
<!-- whoop-demo-json:end -->

The `records` array is trimmed to its first entry here; the live tool returns all
three, each with the same keys. `records[].score` is the untouched WHOOP object,
not a number — a parser that reads it as a scalar silently gets `undefined`.

Once you finish OAuth setup below, `whoop_daily_summary`, `whoop_wellness_context` and `whoop_list_recoveries` return this same shape with your **live** WHOOP data.

## Record a real demo safely

After OAuth is connected, generate a privacy-sanitized transcript for README demos, issue updates or agent evals:

```bash
npx -y whoop-mcp-unofficial demo-capture \
  --output whoop-recovery-demo.redacted.json \
  --markdown whoop-recovery-demo.redacted.md \
  --assert-sanitized
```

`demo-capture` runs the same readiness path an agent should use:
`whoop_connection_status` shape first, then `whoop_daily_summary`, then a short
recovery-aware prompt. It fails closed when setup is incomplete and the
sanitizer blocks OAuth secrets, local token paths, raw payloads, exact recovery
numbers and exact sleep details. The committed
[redaction contract](docs/demo/recovery-demo-redaction-contract.md) is a
fixture-only sample; real captures should be reviewed before publishing.

## Try it with your agent

Three things to ask first:

```text
Use whoop_connection_status to check setup, then run whoop_daily_summary.
Give me a 5-line operating brief for today.
```

```text
Call whoop_weekly_summary with response_format=json. Identify the top
bottleneck and give me a sleep + training plan for next week.
```

```text
Use the whoop_daily_performance_coach prompt. Focus on whether I should train
hard today.
```

## Data availability

This package uses the official WHOOP OAuth API (v2). It does not access raw device sensor streams.

| Data | Available | Notes |
|---|:---:|---|
| Recovery score, HRV, RHR, SpO2, skin temp | ✓ | When WHOOP returns a scored recovery |
| Sleep sessions + stages + performance | ✓ | All scored sleep records |
| Cycles + day strain + kilojoules | ✓ | Physiological cycles |
| Workouts + sport + heart-rate zones | ✓ | All recorded workouts |
| Profile + body measurements | ✓ | Height, weight, max HR |
| Continuous heart-rate / device telemetry | — | Not exposed by WHOOP's public API |
| Live BLE heart-rate listening | — | This package is not a Bluetooth listener |

When this README says `raw`, it means the upstream WHOOP API JSON for a supported endpoint — not raw sensor samples.

## Tools

**Start with these:**

- `whoop_demo` — realistic **synthetic** recovery/sleep/strain payloads, no OAuth needed (see [See it before you connect](#see-it-before-you-connect))
- `whoop_connection_status` — verify local setup before calling WHOOP
- `whoop_data_inventory` — inventory supported data domains, scopes, privacy modes and recommended first calls without calling WHOOP APIs.
- `whoop_daily_summary` — readiness, sleep, load and action candidates for today
- `whoop_weekly_summary` — scorecard, comparison vs prior week, next-week plan

**Auth & diagnostics**

- `whoop_capabilities`, `whoop_agent_manifest`, `whoop_privacy_audit`, `whoop_cache_status`
- `whoop_get_auth_url`, `whoop_exchange_code`, `whoop_revoke_access`

**Profile**

- `whoop_get_profile`, `whoop_get_body_measurements`

**Collections** (paginated, with `start`/`end` filters and privacy-mode override)

- `whoop_list_recoveries`, `whoop_list_sleeps`, `whoop_list_cycles`, `whoop_list_workouts`

Common collection params: `start`, `end`, `limit` (max 25), `next_token`, `all_pages`, `max_pages`, `response_format` (`markdown`/`json`), `privacy_mode` (`summary`/`structured`/`raw`).

`start` and `end` remain exact timezone-aware ISO date-times at the WHOOP boundary. Invalid or reversed ranges fail before a network request.

**Single records by id**

- `whoop_get_cycle`, `whoop_get_sleep`, `whoop_get_workout`
- `whoop_get_cycle_sleep`, `whoop_get_cycle_recovery`

## Prompts

- `whoop_daily_performance_coach` — practical daily plan from today's signals
- `whoop_weekly_training_review` — week comparison + next-week plan
- `whoop_sleep_recovery_investigator` — investigate sleep ↔ recovery patterns

Each accepts `timezone` (IANA, default `UTC`).

## Resources

- `whoop://capabilities`
- `whoop://summary/daily`, `whoop://summary/weekly`
- `whoop://latest/recovery`, `whoop://latest/sleep`, `whoop://latest/cycle`

## Privacy & security

- OAuth tokens are stored in `~/.whoop-mcp/tokens.json` with `0600` permissions and are never returned by tools.
- Refresh-token rotation uses a lock file to avoid concurrent refresh races.
- `whoop_revoke_access` is the only destructive tool — it deletes local tokens and revokes the grant.
- `WHOOP_PRIVACY_MODE` defaults to `structured`. Raw WHOOP API payloads are opt-in via `raw` mode or per-call override.
- Structured mode preserves complete nested physiological data and future upstream fields while removing GPS and secret-bearing values.
- `demo-capture` redacts demo transcripts before writing anything intended for docs or issues.
- The MCP client never sees access or refresh tokens.
- This is **not medical advice**. The server exposes user-authorized data for personal AI workflows, not diagnosis or treatment.

## Configuration

`setup` writes most of these into `~/.whoop-mcp/config.json` (`0600`). Manual env override is supported:

```bash
WHOOP_CLIENT_ID=…
WHOOP_CLIENT_SECRET=…
WHOOP_REDIRECT_URI=http://127.0.0.1:3000/callback

# Optional
WHOOP_SCOPES="read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement"
WHOOP_PRIVACY_MODE=structured        # summary | structured | raw
WHOOP_CACHE=sqlite                   # optional read-through cache
WHOOP_TOKEN_PATH=~/.whoop-mcp/tokens.json
WHOOP_CACHE_PATH=~/.whoop-mcp/cache.sqlite
```

## Hermes / remote setup

```bash
npx -y whoop-mcp-unofficial setup --client hermes --no-auth
npx -y whoop-mcp-unofficial auth                       # run locally if browser auth is needed
npx -y whoop-mcp-unofficial doctor --client hermes
hermes mcp test whoop
```

After Hermes config changes, use `/reload-mcp` or `hermes mcp test whoop`. Don't restart the gateway for normal data access.

If browser OAuth has to happen on a different machine than Hermes, run `auth` locally and copy `~/.whoop-mcp/tokens.json` to the server with `chmod 600`.

## Requirements

- Node.js 20+
- A WHOOP Developer app with redirect URI `http://127.0.0.1:3000/callback`

Default OAuth scopes:

```text
read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement
```

## Development

```bash
git clone https://github.com/davidmosiah/whoop-mcp.git
cd whoop-mcp
npm install
npm test
npm run build
```

Test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Optional local HTTP transport:

```bash
WHOOP_MCP_TRANSPORT=http WHOOP_MCP_PORT=3000 node dist/index.js
curl http://127.0.0.1:3000/health
```

## Docs

- [Quickstart](docs/quickstart.md)
- [Privacy model](docs/privacy.md)
- [FAQ](docs/faq.md)
- [Resources & prompts](docs/resources-prompts.md)
- [Demo redaction contract](docs/demo/recovery-demo-redaction-contract.md)
- [Roadmap](docs/roadmap.md)

## Links

- npm: <https://www.npmjs.com/package/whoop-mcp-unofficial>
- Docs site: <https://wellness.delx.ai/connectors/whoop>
- Legacy docs: <https://whoopmcp.vercel.app/>
- GitHub Pages mirror: <https://davidmosiah.github.io/whoop-mcp/>
- Delx Wellness registry: <https://github.com/davidmosiah/delx-wellness>
- Connector quality standard: <https://github.com/davidmosiah/delx-wellness/blob/main/docs/connector-quality-standard.md>
- Official WHOOP API docs: <https://developer.whoop.com/api/>

<!-- delx-wellness see-also -->

## See also

The full [Delx Wellness](https://wellness.delx.ai) connector library:

| Provider | Package | Repo |
|---|---|---|
| WHOOP | [`whoop-mcp-unofficial`](https://www.npmjs.com/package/whoop-mcp-unofficial) | [whoop-mcp](https://github.com/davidmosiah/whoop-mcp) |
| Oura | [`oura-mcp-unofficial`](https://www.npmjs.com/package/oura-mcp-unofficial) | [ouramcp](https://github.com/davidmosiah/ouramcp) |
| Garmin | [`garmin-mcp-unofficial`](https://www.npmjs.com/package/garmin-mcp-unofficial) | [garminmcp](https://github.com/davidmosiah/garminmcp) |
| Strava | [`strava-mcp-unofficial`](https://www.npmjs.com/package/strava-mcp-unofficial) | [strava-mcp](https://github.com/davidmosiah/strava-mcp) |
| Fitbit | [`fitbit-mcp-unofficial`](https://www.npmjs.com/package/fitbit-mcp-unofficial) | [fitbitmcp](https://github.com/davidmosiah/fitbitmcp) |
| Withings | [`withings-mcp-unofficial`](https://www.npmjs.com/package/withings-mcp-unofficial) | [withingsmcp](https://github.com/davidmosiah/withingsmcp) |
| Apple Health | [`apple-health-mcp-unofficial`](https://www.npmjs.com/package/apple-health-mcp-unofficial) | [apple-health-mcp](https://github.com/davidmosiah/apple-health-mcp) |
| Polar | [`polar-mcp-unofficial`](https://www.npmjs.com/package/polar-mcp-unofficial) | [polarmcp](https://github.com/davidmosiah/polarmcp) |
| Nourish (nutrition) | [`wellness-nourish`](https://www.npmjs.com/package/wellness-nourish) | [wellness-nourish](https://github.com/davidmosiah/wellness-nourish) |

**One-command setup for Hermes** — preconfigures every connector above plus wellness skills + onboarding: [`delx-wellness-hermes`](https://github.com/davidmosiah/delx-wellness-hermes).

<!-- /delx-wellness see-also -->

## 📧 Contact & Support

- 📨 **support@delx.ai** — general questions, integration help, partnerships
- 🐛 **Bug reports / feature requests** — [GitHub Issues](https://github.com/davidmosiah/whoop-mcp/issues)
- 🐦 **Updates** — [@delx369](https://x.com/delx369) on X
- 🌐 **Site** — [wellness.delx.ai](https://wellness.delx.ai)


## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

This software is provided as-is. It is not a medical device, does not provide medical advice, and should not be used for diagnosis or treatment. Always consult qualified professionals for medical concerns.

**Demo:** [docs/readme-demo-synthetic.md](docs/readme-demo-synthetic.md) (synthetic if no device recording).


> Raw mode means official WHOOP API JSON, not continuous sensor streams.

