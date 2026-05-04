import type { WhoopClient } from "./whoop-client.js";
import { buildDailySummary, type SummaryOptions } from "./summary.js";

type ContextOptions = SummaryOptions & {
  soreness?: string[];
  injury_flags?: string[];
  notes?: string;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function trainingLoad(strain?: number, highZoneMinutes?: number): "low" | "normal" | "high" | "unknown" {
  if (strain === undefined && highZoneMinutes === undefined) return "unknown";
  if ((strain ?? 0) >= 14 || (highZoneMinutes ?? 0) > 30) return "high";
  if ((strain ?? 0) <= 5 && (highZoneMinutes ?? 0) <= 5) return "low";
  return "normal";
}

export async function buildWellnessContext(client: Pick<WhoopClient, "list">, options: ContextOptions) {
  const summary = await buildDailySummary(client as WhoopClient, options);
  const latest = record(summary.latest);
  const recovery = record(latest.recovery);
  const sleep = record(latest.sleep);
  const cycle = record(latest.cycle);
  const workout = record(latest.workout);
  const recoveryScore = num(recovery.score);
  const sleepScore = num(sleep.performance_pct);
  const strainScore = num(cycle.strain);
  const highZoneMinutes = num(workout.high_zone_minutes);
  const recentTrainingLoad = trainingLoad(strainScore, highZoneMinutes);
  const notes = [
    `WHOOP recovery band: ${String(recovery.band ?? "unknown")}.`,
    workout.sport ? `Latest workout: ${String(workout.sport)}.` : undefined,
    options.notes
  ].filter((note): note is string => Boolean(note));

  return {
    source: "whoop",
    generated_at: summary.generated_at,
    recovery_score: recoveryScore,
    sleep_score: sleepScore,
    strain_score: strainScore,
    recent_training_load: recentTrainingLoad,
    soreness: options.soreness ?? [],
    injury_flags: options.injury_flags ?? [],
    notes,
    data_quality: summary.data_quality,
    telegram_summary: [
      "WHOOP wellness context",
      recoveryScore !== undefined ? `Recovery: ${recoveryScore}` : undefined,
      sleepScore !== undefined ? `Sleep: ${sleepScore}` : undefined,
      strainScore !== undefined ? `Strain: ${strainScore}` : undefined,
      `Load: ${recentTrainingLoad}`
    ].filter(Boolean).join(" | ")
  };
}

export function formatWellnessContextMarkdown(context: Record<string, unknown>): string {
  const lines = ["# WHOOP Wellness Context", ""];
  for (const key of ["recovery_score", "sleep_score", "strain_score", "recent_training_load"]) {
    if (context[key] !== undefined) lines.push(`- **${key}**: ${String(context[key])}`);
  }
  if (Array.isArray(context.notes) && context.notes.length) {
    lines.push("", "## Notes");
    for (const note of context.notes) lines.push(`- ${String(note)}`);
  }
  return lines.join("\n");
}
