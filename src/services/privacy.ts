import type { PrivacyMode, WhoopConfig } from "../types.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nested(record: unknown, path: string[]): unknown {
  let current: unknown = record;
  for (const part of path) {
    if (!isObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function first(record: unknown, paths: string[][]): unknown {
  for (const path of paths) {
    const value = nested(record, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function pickDefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null));
}

export function resolvePrivacyMode(config: WhoopConfig, override?: PrivacyMode): PrivacyMode {
  return override ?? config.privacyMode;
}

export function applyPrivacy(endpoint: string, payload: unknown, mode: PrivacyMode): unknown {
  if (mode === "raw") return payload;
  if (isObject(payload) && Array.isArray(payload.records)) {
    return {
      ...payload,
      privacy_mode: mode,
      records: payload.records.map((record) => normalizeRecord(endpoint, record, mode))
    };
  }
  return normalizeRecord(endpoint, payload, mode);
}

export function normalizeRecord(endpoint: string, record: unknown, mode: PrivacyMode): unknown {
  if (!isObject(record)) return record;
  if (endpoint.includes("/profile/basic")) return normalizeProfile(record, mode);
  if (endpoint.includes("/measurement/body")) return normalizeBody(record, mode);
  if (endpoint.includes("/recovery")) return normalizeRecovery(record, mode);
  if (endpoint.includes("/activity/sleep") || endpoint.includes("/sleep")) return normalizeSleep(record, mode);
  if (endpoint.includes("/activity/workout")) return normalizeWorkout(record, mode);
  if (endpoint.includes("/cycle")) return normalizeCycle(record, mode);
  return mode === "summary" ? pickDefined({ id: record.id, score_state: record.score_state }) : record;
}

function normalizeProfile(record: Record<string, unknown>, mode: PrivacyMode): Record<string, unknown> {
  if (mode === "summary") {
    return pickDefined({ user_id: record.user_id, first_name: record.first_name });
  }
  return pickDefined({
    user_id: record.user_id,
    email: record.email,
    first_name: record.first_name,
    last_name: record.last_name
  });
}

function normalizeBody(record: Record<string, unknown>, mode: PrivacyMode): Record<string, unknown> {
  if (mode === "summary") {
    return pickDefined({ max_heart_rate: record.max_heart_rate });
  }
  return pickDefined({
    height_meter: record.height_meter,
    weight_kilogram: record.weight_kilogram,
    max_heart_rate: record.max_heart_rate
  });
}

function normalizeCycle(record: Record<string, unknown>, mode: PrivacyMode): Record<string, unknown> {
  const base = pickDefined({
    id: record.id,
    start: record.start,
    end: record.end,
    timezone_offset: record.timezone_offset,
    score_state: record.score_state,
    strain: first(record, [["score", "strain"], ["strain"]]),
    average_heart_rate: first(record, [["score", "average_heart_rate"], ["average_heart_rate"]]),
    max_heart_rate: first(record, [["score", "max_heart_rate"], ["max_heart_rate"]])
  });
  if (mode === "summary") return base;
  return pickDefined({
    ...base,
    user_id: record.user_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    kilojoule: first(record, [["score", "kilojoule"], ["kilojoule"]])
  });
}

function normalizeRecovery(record: Record<string, unknown>, mode: PrivacyMode): Record<string, unknown> {
  const base = pickDefined({
    cycle_id: record.cycle_id,
    sleep_id: record.sleep_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    score_state: record.score_state,
    recovery_score: first(record, [["score", "recovery_score"], ["recovery_score"]]),
    resting_heart_rate: first(record, [["score", "resting_heart_rate"], ["resting_heart_rate"]]),
    hrv_rmssd_milli: first(record, [["score", "hrv_rmssd_milli"], ["hrv_rmssd_milli"]])
  });
  if (mode === "summary") return base;
  return pickDefined({
    ...base,
    user_id: record.user_id,
    user_calibrating: first(record, [["score", "user_calibrating"], ["user_calibrating"]]),
    spo2_percentage: first(record, [["score", "spo2_percentage"], ["spo2_percentage"]]),
    skin_temp_celsius: first(record, [["score", "skin_temp_celsius"], ["skin_temp_celsius"]])
  });
}

function normalizeSleep(record: Record<string, unknown>, mode: PrivacyMode): Record<string, unknown> {
  const base = pickDefined({
    id: record.id,
    cycle_id: record.cycle_id,
    start: record.start,
    end: record.end,
    timezone_offset: record.timezone_offset,
    nap: record.nap,
    score_state: record.score_state,
    sleep_performance_percentage: first(record, [["score", "sleep_performance_percentage"], ["sleep_performance_pct"]]),
    sleep_consistency_percentage: first(record, [["score", "sleep_consistency_percentage"], ["sleep_consistency_pct"]]),
    sleep_efficiency_percentage: first(record, [["score", "sleep_efficiency_percentage"], ["sleep_efficiency_pct"]])
  });
  if (mode === "summary") return base;
  return pickDefined({
    ...base,
    user_id: record.user_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    respiratory_rate: first(record, [["score", "respiratory_rate"], ["respiratory_rate"]]),
    total_in_bed_time_milli: first(record, [["score", "stage_summary", "total_in_bed_time_milli"], ["in_bed_milli"]]),
    total_awake_time_milli: first(record, [["score", "stage_summary", "total_awake_time_milli"], ["awake_milli"]]),
    total_light_sleep_time_milli: first(record, [["score", "stage_summary", "total_light_sleep_time_milli"], ["light_milli"]]),
    total_slow_wave_sleep_time_milli: first(record, [["score", "stage_summary", "total_slow_wave_sleep_time_milli"], ["slow_wave_milli"]]),
    total_rem_sleep_time_milli: first(record, [["score", "stage_summary", "total_rem_sleep_time_milli"], ["rem_milli"]]),
    disturbance_count: first(record, [["score", "stage_summary", "disturbance_count"], ["disturbance_count"]]),
    sleep_needed_baseline_milli: first(record, [["score", "sleep_needed", "baseline_milli"], ["sleep_needed_baseline_milli"]]),
    sleep_needed_debt_milli: first(record, [["score", "sleep_needed", "need_from_sleep_debt_milli"], ["sleep_needed_debt_milli"]]),
    sleep_needed_strain_milli: first(record, [["score", "sleep_needed", "need_from_recent_strain_milli"], ["sleep_needed_strain_milli"]]),
    sleep_needed_nap_milli: first(record, [["score", "sleep_needed", "need_from_recent_nap_milli"], ["sleep_needed_nap_milli"]])
  });
}

function normalizeWorkout(record: Record<string, unknown>, mode: PrivacyMode): Record<string, unknown> {
  const base = pickDefined({
    id: record.id,
    start: record.start,
    end: record.end,
    timezone_offset: record.timezone_offset,
    sport_name: record.sport_name,
    score_state: record.score_state,
    strain: first(record, [["score", "strain"], ["strain"]]),
    average_heart_rate: first(record, [["score", "average_heart_rate"], ["average_heart_rate"]]),
    max_heart_rate: first(record, [["score", "max_heart_rate"], ["max_heart_rate"]])
  });
  if (mode === "summary") return base;
  return pickDefined({
    ...base,
    user_id: record.user_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    kilojoule: first(record, [["score", "kilojoule"], ["kilojoule"]]),
    percent_recorded: first(record, [["score", "percent_recorded"], ["percent_recorded"]]),
    distance_meter: first(record, [["score", "distance_meter"], ["distance_meter"]]),
    altitude_gain_meter: first(record, [["score", "altitude_gain_meter"], ["altitude_gain_meter"]]),
    zone_zero_milli: first(record, [["score", "zone_durations", "zone_zero_milli"], ["zone_zero_milli"]]),
    zone_one_milli: first(record, [["score", "zone_durations", "zone_one_milli"], ["zone_one_milli"]]),
    zone_two_milli: first(record, [["score", "zone_durations", "zone_two_milli"], ["zone_two_milli"]]),
    zone_three_milli: first(record, [["score", "zone_durations", "zone_three_milli"], ["zone_three_milli"]]),
    zone_four_milli: first(record, [["score", "zone_durations", "zone_four_milli"], ["zone_four_milli"]]),
    zone_five_milli: first(record, [["score", "zone_durations", "zone_five_milli"], ["zone_five_milli"]])
  });
}
