/**
 * Synthetic example payloads for `whoop_demo`.
 *
 * The stated purpose of the demo tool is that agents see the contract *before*
 * spending an OAuth round-trip. That only holds if the examples match what the
 * server actually returns — an example advertising a field the server never
 * emits makes an agent write a parser for data that never arrives, which is the
 * exact opposite of the tool's purpose.
 *
 * These shapes are not hand-maintained guesses: `scripts/demo-contract-test.mjs`
 * drives the REAL `whoop_daily_summary`, `whoop_wellness_context` and
 * `whoop_list_recoveries` tools over a synthetic WHOOP API and fails the build
 * when the key sets diverge in either direction (a key the demo invents, or a
 * contract key the demo omits), and when a shared key changes leaf type.
 *
 * If you change a builder or the privacy normalizer, that gate fails and points
 * here. Update this file — do not weaken the gate.
 */

const DEMO_GENERATED_AT = "2026-05-01T09:20:00.000Z";
const DEMO_LOOKBACK_DAYS = 10;

/** Synthetic WHOOP user id. Obviously fake; never a real account. */
const DEMO_USER_ID = 10_000_001;

/** Shared by daily_summary and wellness_context, exactly as the builders do. */
function demoDataQuality() {
  return {
    confidence: "high",
    counts: { recoveries: 8, sleeps: 8, cycles: 8, workouts: 3 },
    pages_fetched: { recoveries: 1, sleeps: 1, cycles: 1, workouts: 1 }
  };
}

/** Matches the shape of `buildDailySummary` (src/services/summary.ts). */
function demoDailySummary() {
  return {
    kind: "daily_summary",
    generated_at: DEMO_GENERATED_AT,
    lookback_days: DEMO_LOOKBACK_DAYS,
    data_quality: demoDataQuality(),
    latest: {
      recovery: {
        date: "2026-05-01, 6:12 a.m.",
        score: 67,
        band: "green",
        hrv_rmssd_milli: 58,
        hrv_delta_pct: -6,
        resting_heart_rate: 52,
        resting_hr_delta_bpm: 2,
        score_state: "SCORED"
      },
      sleep: {
        start: "2026-04-30, 10:48 p.m.",
        performance_pct: 88,
        consistency_pct: 74,
        efficiency_pct: 91,
        actual_sleep_hours: 7.7,
        sleep_need_hours: 8.4,
        sleep_debt_hours: 0.6,
        awake_minutes: 26,
        disturbances: 5,
        score_state: "SCORED"
      },
      cycle: {
        start: "2026-05-01, 5:04 a.m.",
        strain: 11.2,
        baseline_strain: 12.4,
        score_state: "SCORED"
      },
      workout: {
        start: "2026-05-01, 6:35 a.m.",
        sport: "running",
        strain: 8.2,
        high_zone_minutes: 15,
        aerobic_minutes: 50,
        score_state: "SCORED"
      }
    },
    diagnostic: {
      primary_signal: "Recovery is 67 (green).",
      signals: [
        "Recovery is 67 (green).",
        "HRV is 58 ms (-6% vs recent baseline).",
        "Resting HR is 52 bpm (2 bpm vs recent baseline).",
        "Sleep performance is 88%; actual sleep 7.7h vs need 8.4h.",
        "Latest cycle strain is 11.2 vs baseline 12.4.",
        "Latest workout: running, strain 8.2."
      ],
      action_candidates: [
        "Training: good window for progressive load if sleep, soreness and schedule are aligned.",
        "Cognition: schedule deep work during the most stable energy window; use shorter analytical blocks if readiness is low."
      ],
      disclaimer: "Performance coaching only; not medical advice."
    }
  };
}

/** Matches the shape of `buildWellnessContext` (src/services/context.ts). */
function demoWellnessContext() {
  return {
    source: "whoop",
    context_contract_version: "delx-wellness-context/v1",
    context_type: "wellness_context",
    generated_at: DEMO_GENERATED_AT,
    recovery_score: 67,
    sleep_score: 88,
    strain_score: 11.2,
    recent_training_load: "normal",
    soreness: [] as string[],
    injury_flags: [] as string[],
    notes: ["WHOOP recovery band: green.", "Latest workout: running."],
    data_quality: demoDataQuality(),
    recommended_handoff: {
      tool: "exercise_catalog_recommend_session",
      reason: "Use WHOOP recovery, sleep and strain to scale workout intensity and volume."
    },
    telegram_summary: "WHOOP wellness context | Recovery: 67 | Sleep: 88 | Strain: 11.2 | Load: normal"
  };
}

/**
 * Matches a `whoop_list_recoveries` call in the default `structured` privacy
 * mode: normalized top-level fields PLUS the untouched WHOOP `score` object.
 * In `summary` mode the flattened base fields survive and `score` is dropped.
 */
function demoRecoveryRecord(index: number, recoveryScore: number, hrv: number, rhr: number, createdAt: string) {
  return {
    cycle_id: 93_100 + index,
    sleep_id: `1a2b3c4d-0000-4000-8000-00000000000${index}`,
    created_at: createdAt,
    updated_at: createdAt,
    score_state: "SCORED",
    recovery_score: recoveryScore,
    resting_heart_rate: rhr,
    hrv_rmssd_milli: hrv,
    user_id: DEMO_USER_ID,
    user_calibrating: false,
    spo2_percentage: 96.1,
    skin_temp_celsius: 33.7,
    score: {
      user_calibrating: false,
      recovery_score: recoveryScore,
      hrv_rmssd_milli: hrv,
      resting_heart_rate: rhr,
      spo2_percentage: 96.1,
      skin_temp_celsius: 33.7
    }
  };
}

function demoListRecoveries() {
  return {
    endpoint: "/v2/recovery",
    privacy_mode: "structured",
    count: 3,
    records: [
      demoRecoveryRecord(1, 67, 58, 52, "2026-05-01T09:14:00.000Z"),
      demoRecoveryRecord(2, 72, 61, 51, "2026-04-30T09:02:00.000Z"),
      demoRecoveryRecord(3, 54, 49, 56, "2026-04-29T09:11:00.000Z")
    ],
    next_token: "c3ludGhldGljLWRlbW8tcGFnZS0y",
    has_more: true,
    pages_fetched: 1
  };
}

export function buildDemoPayload() {
  return {
    ok: true,
    is_demo: true,
    sample: {
      whoop_daily_summary: demoDailySummary(),
      whoop_wellness_context: demoWellnessContext(),
      whoop_list_recoveries: demoListRecoveries()
    },
    notes: [
      "All sample data is synthetic; tagged with is_demo=true.",
      "Real calls return live data from the WHOOP Developer API after OAuth setup.",
      "Shapes are verified against the real tools by scripts/demo-contract-test.mjs on every build.",
      "whoop_list_recoveries is shown in the default privacy_mode=structured; summary mode drops the nested score object.",
      "Performance coaching only; not medical advice."
    ]
  };
}
