# FAQ

## Is this official?

No. This is an unofficial open-source project and is not affiliated with, endorsed by, sponsored by, or supported by WHOOP, Inc.

## What data can it fetch?

It can fetch the data exposed by the official WHOOP OAuth API, including profile, body measurements, recovery, physiological cycles, sleep and workouts.

Examples include recovery score, HRV, resting heart rate, SpO2, skin temperature, sleep-stage durations, sleep performance, strain, workout heart-rate zones and sport metadata when WHOOP returns those fields.

## Does `raw` mean raw sensor data?

No. In this project, `raw` means the full JSON payload returned by a supported WHOOP API endpoint.

It does not mean continuous sensor streams, second-by-second heart-rate samples, accelerometer data or raw device telemetry. WHOOP devices can broadcast heart rate over BLE, but continuous heart-rate data is not available through the official WHOOP API and this MCP does not implement a Bluetooth listener.

## Why not use an internal or unofficial WHOOP endpoint?

Because the goal is to build a safe, durable, community-friendly MCP server. This project intentionally stays inside the official OAuth API boundary.

## Where are tokens stored?

OAuth tokens are stored locally, by default at:

```text
~/.whoop-mcp/tokens.json
```

The file is written with user-only permissions. Token values are not returned by MCP tools.

## Can non-technical users install it?

The intended path is:

```bash
npx -y whoop-mcp-unofficial setup
npx -y whoop-mcp-unofficial auth
npx -y whoop-mcp-unofficial doctor
```

The `setup` command stores local config, `auth` opens the WHOOP OAuth flow, and `doctor` verifies readiness.

## What should agents call first?

Agents should call:

1. `whoop_agent_manifest` when installing, configuring or running inside Hermes/OpenClaw-style agents.
2. `whoop_capabilities`
3. `whoop_connection_status`
4. `whoop_daily_summary` or `whoop_weekly_summary`

Agents should use lower-level collection tools only when they need detailed records.

## Does it give medical advice?

No. The summaries are framed as recovery, sleep, training and performance context. They should not be treated as diagnosis, treatment or emergency monitoring.

## Can this become a remote hosted MCP?

Possibly, but the current default is local-first because WHOOP data is sensitive. A hosted version would need stronger account isolation, encrypted token storage, explicit user consent, rate-limit handling, observability and a clear data deletion path.

## How can people contribute?

Open an issue with one of the templates:

- install/help request
- data coverage request
- feature request
- bug report

Good first contributions include client setup examples, docs improvements, more summary fixtures and safer onboarding copy.

## What is the main project URL?

The primary website is:

```text
https://whoopmcp.vercel.app/
```

The GitHub Pages mirror remains available at:

```text
https://davidmosiah.github.io/whoop-mcp/
```
