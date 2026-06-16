import type { ResponseFormat, ToolResponse } from "../types.js";
import { redactErrorMessage, redactSensitive } from "./redaction.js";

export function makeResponse<T>(data: T, format: ResponseFormat, markdown: string): ToolResponse<T> {
  const safeData = redactSensitive(data) as T;
  const safeMarkdown = redactErrorMessage(markdown);
  return {
    content: [{ type: "text", text: format === "json" ? JSON.stringify(safeData, null, 2) : safeMarkdown }],
    structuredContent: safeData
  };
}

export function makeError(message: string): ToolResponse<{ error: string }> {
  const safeMessage = redactErrorMessage(message);
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${safeMessage}` }],
    structuredContent: { error: safeMessage }
  };
}

export function bulletList(title: string, fields: Record<string, unknown>): string {
  const lines = [`# ${title}`, ""];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    lines.push(`- **${key}**: ${String(value)}`);
  }
  return lines.join("\n");
}

export function formatCollection(title: string, records: unknown[], meta: Record<string, unknown>): string {
  const lines = [`# ${title}`, ""];
  for (const [key, value] of Object.entries(meta)) {
    if (key === "records" || value === undefined || value === null) continue;
    lines.push(`- **${key}**: ${formatScalar(value)}`);
  }
  lines.push("");
  const preview = records.slice(0, 8);
  for (const [index, record] of preview.entries()) {
    if (record && typeof record === "object") {
      const object = record as Record<string, unknown>;
      const id = object.id ?? object.sleep_id ?? object.cycle_id ?? `item-${index + 1}`;
      const start = object.start ?? object.created_at ?? object.updated_at ?? "n/a";
      const state = object.score_state ?? "n/a";
      lines.push(`## ${String(id)}`);
      lines.push(`- **start/created**: ${String(start)}`);
      lines.push(`- **score_state**: ${String(state)}`);
      if (object.score && typeof object.score === "object") {
        lines.push(`- **score**: ${JSON.stringify(object.score)}`);
      }
      lines.push("");
    } else {
      lines.push(`- ${JSON.stringify(record)}`);
    }
  }
  if (records.length > preview.length) lines.push(`... ${records.length - preview.length} more records omitted from markdown preview.`);
  return lines.join("\n");
}

function formatScalar(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatScalar(item)).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pick(record: Record<string, unknown>, ...paths: Array<string | string[]>): unknown {
  for (const path of paths) {
    const parts = Array.isArray(path) ? path : [path];
    let current: unknown = record;
    let ok = true;
    for (const part of parts) {
      if (!isRecord(current)) { ok = false; break; }
      current = current[part];
    }
    if (ok && current !== undefined && current !== null) return current;
  }
  return undefined;
}

function minutesFromMilli(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value / 60000) : undefined;
}

/**
 * Render a single privacy-normalized WHOOP record as readable prose.
 * Extracts 4-6 key fields per record type (sleep, workout, cycle, recovery)
 * and falls back to a compact JSON bullet for unknown shapes or when privacy
 * mode has stripped the scored fields. `data` is already privacy-normalized.
 */
export function formatRecordMarkdown(endpoint: string, title: string, meta: Record<string, unknown>, data: unknown): string {
  const lines = [`# ${title}`, ""];
  lines.push(`- **endpoint**: ${String(meta.endpoint ?? endpoint)}`);
  if (meta.privacy_mode !== undefined) lines.push(`- **privacy_mode**: ${String(meta.privacy_mode)}`);
  lines.push("");

  if (!isRecord(data)) {
    lines.push(`- **data**: ${formatScalar(data)}`);
    return lines.join("\n");
  }

  const facts = recordFacts(endpoint, data);
  if (facts.length) {
    lines.push("## Key fields");
    for (const fact of facts) lines.push(`- ${fact}`);
  } else {
    // Unknown shape or fields stripped by privacy mode — keep prior behavior.
    lines.push(`- **data**: ${JSON.stringify(data)}`);
  }
  return lines.join("\n");
}

function recordFacts(endpoint: string, record: Record<string, unknown>): string[] {
  // Order matters: /cycle/{id}/recovery and /cycle/{id}/sleep must match before bare /cycle.
  if (endpoint.includes("/recovery")) return recoveryFacts(record);
  if (endpoint.includes("/sleep")) return sleepFacts(record);
  if (endpoint.includes("/activity/workout")) return workoutFacts(record);
  if (endpoint.includes("/cycle")) return cycleFacts(record);
  return [];
}

function withState(record: Record<string, unknown>, facts: string[]): string[] {
  const state = pick(record, "score_state");
  if (state !== undefined) facts.push(`**score_state**: ${String(state)}`);
  return facts.filter((fact) => !/undefined/.test(fact));
}

function sleepFacts(record: Record<string, unknown>): string[] {
  const facts: string[] = [];
  const performance = pick(record, ["score", "sleep_performance_percentage"], "sleep_performance_percentage", "sleep_performance_pct");
  const consistency = pick(record, ["score", "sleep_consistency_percentage"], "sleep_consistency_percentage", "sleep_consistency_pct");
  const efficiency = pick(record, ["score", "sleep_efficiency_percentage"], "sleep_efficiency_percentage", "sleep_efficiency_pct");
  const stage = (key: string) => pick(record, ["score", "stage_summary", key], key);
  const remMin = minutesFromMilli(stage("total_rem_sleep_time_milli"));
  const deepMin = minutesFromMilli(stage("total_slow_wave_sleep_time_milli"));
  const lightMin = minutesFromMilli(stage("total_light_sleep_time_milli"));
  const awakeMin = minutesFromMilli(stage("total_awake_time_milli"));
  const isNap = pick(record, "nap");

  if (performance !== undefined) facts.push(`**performance**: ${performance}%`);
  if (efficiency !== undefined) facts.push(`**efficiency**: ${efficiency}%`);
  if (consistency !== undefined) facts.push(`**consistency**: ${consistency}%`);
  const stages: string[] = [];
  if (remMin !== undefined) stages.push(`${remMin}m REM`);
  if (deepMin !== undefined) stages.push(`${deepMin}m deep`);
  if (lightMin !== undefined) stages.push(`${lightMin}m light`);
  if (awakeMin !== undefined) stages.push(`${awakeMin}m awake`);
  if (stages.length) facts.push(`**stages**: ${stages.join(", ")}`);
  if (isNap !== undefined) facts.push(`**nap**: ${String(isNap)}`);
  return withState(record, facts);
}

function workoutFacts(record: Record<string, unknown>): string[] {
  const facts: string[] = [];
  const sport = pick(record, "sport_name", "sport_id", "sport");
  const strain = pick(record, ["score", "strain"], "strain");
  const avgHr = pick(record, ["score", "average_heart_rate"], "average_heart_rate");
  const maxHr = pick(record, ["score", "max_heart_rate"], "max_heart_rate");
  const zone = (key: string) => minutesFromMilli(pick(record, ["score", "zone_durations", key], ["score", "zone_duration", key], key));
  const z4 = zone("zone_four_milli");
  const z5 = zone("zone_five_milli");

  if (sport !== undefined) facts.push(`**sport**: ${String(sport)}`);
  if (strain !== undefined) facts.push(`**strain**: ${strain}`);
  if (avgHr !== undefined || maxHr !== undefined) {
    const hr = [avgHr !== undefined ? `avg ${avgHr}` : undefined, maxHr !== undefined ? `max ${maxHr}` : undefined].filter(Boolean).join(", ");
    facts.push(`**heart_rate**: ${hr} bpm`);
  }
  if (z4 !== undefined || z5 !== undefined) {
    const zones = [z4 !== undefined ? `${z4}m Z4` : undefined, z5 !== undefined ? `${z5}m Z5` : undefined].filter(Boolean).join(", ");
    facts.push(`**high_hr_zones**: ${zones}`);
  }
  return withState(record, facts);
}

function cycleFacts(record: Record<string, unknown>): string[] {
  const facts: string[] = [];
  const strain = pick(record, ["score", "strain"], "strain");
  const avgHr = pick(record, ["score", "average_heart_rate"], "average_heart_rate");
  const maxHr = pick(record, ["score", "max_heart_rate"], "max_heart_rate");
  const start = pick(record, "start");

  if (strain !== undefined) facts.push(`**strain**: ${strain}`);
  if (avgHr !== undefined) facts.push(`**avg_heart_rate**: ${avgHr} bpm`);
  if (maxHr !== undefined) facts.push(`**max_heart_rate**: ${maxHr} bpm`);
  if (start !== undefined) facts.push(`**start**: ${String(start)}`);
  return withState(record, facts);
}

function recoveryFacts(record: Record<string, unknown>): string[] {
  const facts: string[] = [];
  const score = pick(record, ["score", "recovery_score"], "recovery_score");
  const hrv = pick(record, ["score", "hrv_rmssd_milli"], "hrv_rmssd_milli");
  const rhr = pick(record, ["score", "resting_heart_rate"], "resting_heart_rate");

  if (score !== undefined) facts.push(`**recovery_score**: ${score}`);
  if (hrv !== undefined) facts.push(`**hrv_rmssd_milli**: ${hrv} ms`);
  if (rhr !== undefined) facts.push(`**resting_heart_rate**: ${rhr} bpm`);
  return withState(record, facts);
}
