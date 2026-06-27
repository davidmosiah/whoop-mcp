import { dirname, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { buildConnectionStatus, type ConnectionStatus } from "../services/connection-status.js";
import { getConfig } from "../services/config.js";
import { buildDailySummary } from "../services/summary.js";
import { WhoopClient } from "../services/whoop-client.js";

type JsonRecord = Record<string, unknown>;

interface DemoCaptureOptions {
  fixture: boolean;
  assertSanitized: boolean;
  output?: string;
  markdown?: string;
  days: number;
  timezone?: string;
}

interface SanitizedDemoTranscript {
  kind: "whoop_real_recovery_demo";
  schema_version: 1;
  captured_at: string;
  source: "live_whoop_api" | "fixture_privacy_test";
  commands: string[];
  privacy_contract: {
    oauth_secrets_included: false;
    raw_payloads_included: false;
    exact_recovery_numbers_included: false;
    exact_sleep_details_included: false;
    local_paths_included: false;
  };
  connection_status: JsonRecord;
  daily_summary: JsonRecord;
  recovery_aware_prompt: {
    prompt: string;
    sanitized_agent_response: string[];
  };
  privacy_checks: {
    passed: boolean;
    forbidden_patterns_checked: string[];
  };
}

const FORBIDDEN_PATTERN_LABELS = [
  "access token",
  "refresh token",
  "client secret",
  "authorization bearer",
  "exact recovery score key",
  "exact HRV key",
  "exact resting heart-rate key",
  "exact sleep-performance key",
  "exact strain key",
  "local token path"
];

const FORBIDDEN_PATTERNS = [
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /client[_-]?secret/i,
  /bearer\s+[a-z0-9._-]+/i,
  /"recovery_score"\s*:/i,
  /"hrv[^"]*"\s*:/i,
  /"resting_heart_rate"\s*:/i,
  /"sleep_performance[^"]*"\s*:/i,
  /"strain"\s*:/i,
  /\.whoop-mcp\/tokens\.json/i
];

export async function runDemoCaptureCommand(args: string[]): Promise<number> {
  const options = parseOptions(args);
  const status = await buildConnectionStatus();

  if (!options.fixture && !status.ready_for_whoop_api) {
    console.error("Cannot capture a real WHOOP demo because local OAuth setup is not ready.");
    console.error(JSON.stringify({
      connection_status: sanitizeConnectionStatus(status),
      next_steps: status.next_steps
    }, null, 2));
    return 1;
  }

  const summary = options.fixture
    ? fixtureDailySummary()
    : await buildDailySummary(new WhoopClient(getConfig()), { days: options.days, timezone: options.timezone });

  const transcript = buildTranscript({
    status,
    summary,
    source: options.fixture ? "fixture_privacy_test" : "live_whoop_api"
  });
  const check = assertSanitized(transcript);
  transcript.privacy_checks.passed = check.passed;

  if (!check.passed) {
    console.error(`Demo capture failed sanitization: ${check.failures.join(", ")}`);
    return 1;
  }

  if (options.assertSanitized) {
    console.error("Sanitized WHOOP demo transcript passed privacy checks.");
  }

  const json = `${JSON.stringify(transcript, null, 2)}\n`;
  if (options.output) {
    await writeText(options.output, json);
  } else {
    console.log(json.trimEnd());
  }

  if (options.markdown) {
    await writeText(options.markdown, renderMarkdown(transcript));
  }

  return 0;
}

function parseOptions(args: string[]): DemoCaptureOptions {
  const options: DemoCaptureOptions = {
    fixture: false,
    assertSanitized: false,
    days: 14
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--fixture") {
      options.fixture = true;
    } else if (arg === "--assert-sanitized") {
      options.assertSanitized = true;
    } else if (arg === "--output") {
      options.output = takeValue(args, index, "--output");
      index += 1;
    } else if (arg === "--markdown") {
      options.markdown = takeValue(args, index, "--markdown");
      index += 1;
    } else if (arg === "--days") {
      const raw = takeValue(args, index, "--days");
      const days = Number(raw);
      if (!Number.isInteger(days) || days < 7 || days > 60) {
        throw new Error("--days must be an integer from 7 to 60.");
      }
      options.days = days;
      index += 1;
    } else if (arg === "--timezone") {
      options.timezone = takeValue(args, index, "--timezone");
      index += 1;
    } else {
      throw new Error(`Unknown demo-capture option: ${arg}`);
    }
  }

  return options;
}

function takeValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}.`);
  return value;
}

async function writeText(path: string, text: string): Promise<void> {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, text, "utf8");
}

function buildTranscript(input: {
  status: ConnectionStatus;
  summary: JsonRecord;
  source: SanitizedDemoTranscript["source"];
}): SanitizedDemoTranscript {
  const daily = sanitizeDailySummary(input.summary);
  return {
    kind: "whoop_real_recovery_demo",
    schema_version: 1,
    captured_at: new Date().toISOString(),
    source: input.source,
    commands: [
      "whoop_connection_status",
      "whoop_daily_summary",
      "Use my latest WHOOP recovery, sleep and strain. Tell me if today should be a push, maintain or recovery day, then give me one action that matters most tonight."
    ],
    privacy_contract: {
      oauth_secrets_included: false,
      raw_payloads_included: false,
      exact_recovery_numbers_included: false,
      exact_sleep_details_included: false,
      local_paths_included: false
    },
    connection_status: sanitizeConnectionStatus(input.status),
    daily_summary: daily,
    recovery_aware_prompt: {
      prompt: "Use my latest WHOOP recovery, sleep and strain. Tell me if today should be a push, maintain or recovery day, then give me one action that matters most tonight.",
      sanitized_agent_response: buildAgentResponse(daily)
    },
    privacy_checks: {
      passed: false,
      forbidden_patterns_checked: FORBIDDEN_PATTERN_LABELS
    }
  };
}

function sanitizeConnectionStatus(status: ConnectionStatus): JsonRecord {
  return {
    ready_for_whoop_api: status.ready_for_whoop_api,
    node_supported: status.node.supported,
    privacy_mode: status.privacy_mode,
    oauth_config: {
      client_id_present: Boolean(status.required_env.WHOOP_CLIENT_ID),
      secret_present: Boolean(status.required_env.WHOOP_CLIENT_SECRET),
      redirect_uri_present: Boolean(status.required_env.WHOOP_REDIRECT_URI),
      local_callback_supported: status.automatic_auth_supported
    },
    local_config: {
      source: status.config.source,
      exists: status.config.exists,
      secure_permissions: status.config.secure_permissions !== false
    },
    saved_grant: {
      exists: status.token.exists,
      readable: status.token.readable,
      secure_permissions: status.token.secure_permissions !== false,
      expired: status.token.expired === true,
      renewable: status.token.has_refresh_token === true
    },
    cache_enabled: status.cache.enabled
  };
}

function sanitizeDailySummary(summary: JsonRecord): JsonRecord {
  const latest = asRecord(summary.latest);
  const recovery = asRecord(latest.recovery);
  const sleep = asRecord(latest.sleep);
  const cycle = asRecord(latest.cycle);
  const workout = asRecord(latest.workout);
  const dataQuality = asRecord(summary.data_quality);
  const counts = asRecord(dataQuality.counts);
  const diagnostic = asRecord(summary.diagnostic);

  return {
    kind: summary.kind,
    lookback_days: summary.lookback_days,
    data_quality: {
      confidence: dataQuality.confidence,
      availability: {
        recoveries: bucketCount(counts.recoveries),
        sleeps: bucketCount(counts.sleeps),
        cycles: bucketCount(counts.cycles),
        workouts: bucketCount(counts.workouts)
      }
    },
    latest: {
      recovery: {
        available: Boolean(latest.recovery),
        band: stringOrUnknown(recovery.band),
        state: stringOrUnknown(recovery.score_state)
      },
      sleep: {
        available: Boolean(latest.sleep),
        quality_band: percentageBand(sleep.performance_pct),
        state: stringOrUnknown(sleep.score_state)
      },
      cycle: {
        available: Boolean(latest.cycle),
        load_band: loadBand(cycle.strain),
        state: stringOrUnknown(cycle.score_state)
      },
      workout: {
        available: Boolean(latest.workout),
        sport_present: typeof workout.sport === "string" && workout.sport.length > 0,
        intensity_band: loadBand(workout.strain),
        state: stringOrUnknown(workout.score_state)
      }
    },
    diagnostic: {
      primary_signal: `Latest recovery is ${stringOrUnknown(recovery.band)}.`,
      action_themes: actionThemes(diagnostic.action_candidates),
      disclaimer: diagnostic.disclaimer
    }
  };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringOrUnknown(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "unknown";
}

function bucketCount(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "none";
  if (value === 1) return "single";
  if (value < 7) return "some";
  return "many";
}

function percentageBand(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  if (value >= 85) return "strong";
  if (value >= 70) return "mixed";
  return "needs_attention";
}

function loadBand(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  if (value >= 14) return "high";
  if (value >= 8) return "moderate";
  return "low";
}

function actionThemes(value: unknown): string[] {
  const actions = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const themes = new Set<string>();
  for (const action of actions) {
    const lower = action.toLowerCase();
    if (lower.includes("training") || lower.includes("zone") || lower.includes("load")) themes.add("scale training load to readiness");
    if (lower.includes("sleep") || lower.includes("caffeine") || lower.includes("wind-down")) themes.add("protect sleep window");
    if (lower.includes("hydrate") || lower.includes("breathwork") || lower.includes("recovery")) themes.add("reduce recovery debt");
    if (lower.includes("cognition") || lower.includes("deep work")) themes.add("schedule cognitive load around readiness");
  }
  return themes.size ? [...themes] : ["review recovery before choosing intensity"];
}

function buildAgentResponse(daily: JsonRecord): string[] {
  const latest = asRecord(daily.latest);
  const recovery = asRecord(latest.recovery);
  const sleep = asRecord(latest.sleep);
  const cycle = asRecord(latest.cycle);
  const diagnostic = asRecord(daily.diagnostic);
  const themes = Array.isArray(diagnostic.action_themes) ? diagnostic.action_themes : [];
  const recoveryBand = stringOrUnknown(recovery.band);
  const sleepBand = stringOrUnknown(sleep.quality_band);
  const loadBandValue = stringOrUnknown(cycle.load_band);
  const dayType = recoveryBand === "green" ? "push" : recoveryBand === "red" ? "recovery" : "maintain";
  const action = typeof themes[0] === "string" ? themes[0] : "review recovery before choosing intensity";

  return [
    `Today reads as a ${dayType} day from the sanitized WHOOP summary.`,
    `Recovery band is ${recoveryBand}; sleep quality is ${sleepBand}; load is ${loadBandValue}.`,
    `Most important action: ${action}.`,
    "This is performance coaching only, not medical advice."
  ];
}

function assertSanitized(transcript: SanitizedDemoTranscript): { passed: boolean; failures: string[] } {
  const text = JSON.stringify(transcript);
  const failures = FORBIDDEN_PATTERNS
    .map((pattern, index) => pattern.test(text) ? FORBIDDEN_PATTERN_LABELS[index] : undefined)
    .filter((value): value is string => Boolean(value));
  return { passed: failures.length === 0, failures };
}

function renderMarkdown(transcript: SanitizedDemoTranscript): string {
  const status = transcript.connection_status;
  const daily = transcript.daily_summary;
  const latest = asRecord(daily.latest);
  const recovery = asRecord(latest.recovery);
  const sleep = asRecord(latest.sleep);
  const cycle = asRecord(latest.cycle);
  const diagnostic = asRecord(daily.diagnostic);
  const themes = Array.isArray(diagnostic.action_themes) ? diagnostic.action_themes : [];

  return `# WHOOP Recovery Demo Capture

This is a privacy-sanitized transcript generated by \`whoop-mcp-server demo-capture\`.

- Source: ${transcript.source}
- Captured at: ${transcript.captured_at}
- Ready for WHOOP API: ${String(status.ready_for_whoop_api)}
- Privacy mode: ${String(status.privacy_mode)}
- Recovery band: ${stringOrUnknown(recovery.band)}
- Sleep quality band: ${stringOrUnknown(sleep.quality_band)}
- Load band: ${stringOrUnknown(cycle.load_band)}
- Data confidence: ${String(asRecord(daily.data_quality).confidence ?? "unknown")}

## Commands

${transcript.commands.map((command) => `- \`${command}\``).join("\n")}

## Sanitized Agent Response

${transcript.recovery_aware_prompt.sanitized_agent_response.map((line) => `- ${line}`).join("\n")}

## Action Themes

${themes.map((theme) => `- ${String(theme)}`).join("\n")}

## Privacy Contract

- OAuth secrets included: no
- Raw payloads included: no
- Exact recovery numbers included: no
- Exact sleep details included: no
- Local token paths included: no
- Sanitization checks passed: ${String(transcript.privacy_checks.passed)}
`;
}

function fixtureDailySummary(): JsonRecord {
  return {
    kind: "daily_summary",
    generated_at: "2026-06-27T00:00:00.000Z",
    lookback_days: 14,
    data_quality: {
      confidence: "high",
      counts: { recoveries: 12, sleeps: 11, cycles: 14, workouts: 4 }
    },
    latest: {
      recovery: {
        date: "2026-06-27, 07:00",
        score: 71,
        band: "green",
        hrv_rmssd_milli: 62,
        resting_heart_rate: 49,
        score_state: "SCORED"
      },
      sleep: {
        start: "2026-06-27, 00:12",
        performance_pct: 86,
        actual_sleep_hours: 7.4,
        sleep_need_hours: 7.9,
        score_state: "SCORED"
      },
      cycle: {
        start: "2026-06-27, 07:00",
        strain: 9.8,
        score_state: "SCORED"
      },
      workout: {
        start: "2026-06-26, 18:00",
        sport: "running",
        strain: 8.4,
        score_state: "SCORED"
      }
    },
    diagnostic: {
      action_candidates: [
        "Training: good window for progressive load if sleep, soreness and schedule are aligned.",
        "Cognition: schedule deep work during the most stable energy window; use shorter analytical blocks if readiness is low."
      ],
      disclaimer: "Performance coaching only; not medical advice."
    }
  };
}
