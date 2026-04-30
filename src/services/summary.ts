import type { WhoopClient } from "./whoop-client.js";

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

type UnknownRecord = Record<string, unknown>;

interface CollectionBundle {
  recoveries: UnknownRecord[];
  sleeps: UnknownRecord[];
  cycles: UnknownRecord[];
  workouts: UnknownRecord[];
  pages_fetched: Record<string, number>;
}

export interface SummaryOptions {
  days: number;
  compare_days?: number;
  timezone?: string;
}

function isObject(value: unknown): value is UnknownRecord {
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

function firstNumber(record: unknown, paths: string[][]): number | undefined {
  for (const path of paths) {
    const value = nested(record, path);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function firstString(record: unknown, paths: string[][]): string | undefined {
  for (const path of paths) {
    const value = nested(record, path);
    if (typeof value === "string" && value.trim() !== "") return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function firstDate(record: unknown, paths: string[][]): Date | undefined {
  for (const path of paths) {
    const date = parseDate(nested(record, path));
    if (date) return date;
  }
  return undefined;
}

function avg(values: Array<number | undefined>): number | undefined {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!nums.length) return undefined;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function sum(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0);
}

function delta(current?: number, baseline?: number): number | undefined {
  if (current === undefined || baseline === undefined) return undefined;
  return current - baseline;
}

function percentDelta(current?: number, baseline?: number): number | undefined {
  if (current === undefined || baseline === undefined || baseline === 0) return undefined;
  return ((current - baseline) / baseline) * 100;
}

function round(value?: number, digits = 1): number | undefined {
  if (value === undefined) return undefined;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function hours(ms?: number): number | undefined {
  return ms === undefined ? undefined : round(ms / HOUR_MS, 2);
}

function minutes(ms?: number): number | undefined {
  return ms === undefined ? undefined : round(ms / MIN_MS, 0);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * HOUR_MS).toISOString();
}

function sortDesc(records: UnknownRecord[], paths: string[][]): UnknownRecord[] {
  return [...records].sort((a, b) => {
    const da = firstDate(a, paths)?.getTime() ?? 0;
    const db = firstDate(b, paths)?.getTime() ?? 0;
    return db - da;
  });
}

function scoreState(record: UnknownRecord): string | undefined {
  return firstString(record, [["score_state"]]);
}

function scored(records: UnknownRecord[]): UnknownRecord[] {
  return records.filter((record) => (scoreState(record) ?? "").toUpperCase() === "SCORED");
}

function recoveryScore(record: UnknownRecord): number | undefined {
  return firstNumber(record, [["score", "recovery_score"], ["recovery_score"]]);
}

function hrv(record: UnknownRecord): number | undefined {
  return firstNumber(record, [["score", "hrv_rmssd_milli"], ["hrv_rmssd_milli"]]);
}

function rhr(record: UnknownRecord): number | undefined {
  return firstNumber(record, [["score", "resting_heart_rate"], ["resting_heart_rate"]]);
}

function cycleStrain(record: UnknownRecord): number | undefined {
  return firstNumber(record, [["score", "strain"], ["strain"]]);
}

function workoutStrain(record: UnknownRecord): number | undefined {
  return firstNumber(record, [["score", "strain"], ["strain"]]);
}

function sleepPerformance(record: UnknownRecord): number | undefined {
  return firstNumber(record, [["score", "sleep_performance_percentage"], ["score", "sleep_performance_pct"], ["sleep_performance_pct"]]);
}

function sleepConsistency(record: UnknownRecord): number | undefined {
  return firstNumber(record, [["score", "sleep_consistency_percentage"], ["score", "sleep_consistency_pct"], ["sleep_consistency_pct"]]);
}

function sleepEfficiency(record: UnknownRecord): number | undefined {
  return firstNumber(record, [["score", "sleep_efficiency_percentage"], ["score", "sleep_efficiency_pct"], ["sleep_efficiency_pct"]]);
}

function sleepActualMs(record: UnknownRecord): number | undefined {
  const stageSummary = nested(record, ["score", "stage_summary"]);
  const light = firstNumber(stageSummary, [["total_light_sleep_time_milli"], ["light_milli"]]);
  const slow = firstNumber(stageSummary, [["total_slow_wave_sleep_time_milli"], ["slow_wave_milli"]]);
  const rem = firstNumber(stageSummary, [["total_rem_sleep_time_milli"], ["rem_milli"]]);
  const stageSum = sum([light, slow, rem]);
  if (stageSum > 0) return stageSum;
  const inBed = firstNumber(stageSummary, [["total_in_bed_time_milli"], ["in_bed_milli"]]);
  const awake = firstNumber(stageSummary, [["total_awake_time_milli"], ["awake_milli"]]) ?? 0;
  return inBed === undefined ? undefined : Math.max(0, inBed - awake);
}

function sleepNeedMs(record: UnknownRecord): number | undefined {
  const sleepNeeded = nested(record, ["score", "sleep_needed"]);
  const total = sum([
    firstNumber(sleepNeeded, [["baseline_milli"], ["sleep_needed_baseline_milli"]]),
    firstNumber(sleepNeeded, [["need_from_sleep_debt_milli"], ["sleep_needed_debt_milli"]]),
    firstNumber(sleepNeeded, [["need_from_recent_strain_milli"], ["sleep_needed_strain_milli"]]),
    firstNumber(sleepNeeded, [["need_from_recent_nap_milli"], ["sleep_needed_nap_milli"]])
  ]);
  return total > 0 ? total : undefined;
}

function sleepDebtMs(record: UnknownRecord): number | undefined {
  const sleepNeeded = nested(record, ["score", "sleep_needed"]);
  return firstNumber(sleepNeeded, [["need_from_sleep_debt_milli"], ["sleep_needed_debt_milli"]]);
}

function awakeMs(record: UnknownRecord): number | undefined {
  const stageSummary = nested(record, ["score", "stage_summary"]);
  return firstNumber(stageSummary, [["total_awake_time_milli"], ["awake_milli"]]);
}

function disturbances(record: UnknownRecord): number | undefined {
  const stageSummary = nested(record, ["score", "stage_summary"]);
  return firstNumber(stageSummary, [["disturbance_count"], ["disturbances"]]);
}

function workoutSport(record: UnknownRecord): string | undefined {
  return firstString(record, [["sport_name"], ["sport_id"], ["sport"]]);
}

function workoutHighZoneMinutes(record: UnknownRecord): number | undefined {
  const score = nested(record, ["score"]);
  const z4 = firstNumber(score, [["zone_duration", "zone_four_milli"], ["zone_four_milli"], ["zone_four"]]);
  const z5 = firstNumber(score, [["zone_duration", "zone_five_milli"], ["zone_five_milli"], ["zone_five"]]);
  const total = sum([z4, z5]);
  return total ? total / MIN_MS : undefined;
}

function workoutAerobicMinutes(record: UnknownRecord): number | undefined {
  const score = nested(record, ["score"]);
  const z2 = firstNumber(score, [["zone_duration", "zone_two_milli"], ["zone_two_milli"], ["zone_two"]]);
  const z3 = firstNumber(score, [["zone_duration", "zone_three_milli"], ["zone_three_milli"], ["zone_three"]]);
  const total = sum([z2, z3]);
  return total ? total / MIN_MS : undefined;
}

async function fetchBundle(client: WhoopClient, days: number): Promise<CollectionBundle> {
  const start = isoDaysAgo(days);
  const common = { start, limit: 25, all_pages: true, max_pages: 12 };
  const [recoveries, sleeps, cycles, workouts] = await Promise.all([
    client.list("/v2/recovery", common),
    client.list("/v2/activity/sleep", common),
    client.list("/v2/cycle", common),
    client.list("/v2/activity/workout", common)
  ]);

  return {
    recoveries: recoveries.records.filter(isObject),
    sleeps: sleeps.records.filter(isObject),
    cycles: cycles.records.filter(isObject),
    workouts: workouts.records.filter(isObject),
    pages_fetched: {
      recoveries: recoveries.pages_fetched,
      sleeps: sleeps.pages_fetched,
      cycles: cycles.pages_fetched,
      workouts: workouts.pages_fetched
    }
  };
}

function confidence(counts: Record<string, number>, minimum = 3): "high" | "medium" | "low" {
  const core = Math.min(counts.recoveries ?? 0, counts.sleeps ?? 0, counts.cycles ?? 0);
  if (core >= 7) return "high";
  if (core >= minimum) return "medium";
  return "low";
}

function latest(records: UnknownRecord[], datePaths: string[][]): UnknownRecord | undefined {
  return sortDesc(records, datePaths)[0];
}

function formatDate(record: UnknownRecord | undefined, paths: string[][], timezone?: string): string | undefined {
  if (!record) return undefined;
  const date = firstDate(record, paths);
  if (!date) return undefined;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone || "UTC"
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function recoveryBand(score?: number): string | undefined {
  if (score === undefined) return undefined;
  if (score >= 67) return "green";
  if (score >= 34) return "yellow";
  return "red";
}

function buildDailyActions(params: {
  recovery?: number;
  sleepPerformance?: number;
  sleepDebtHours?: number;
  hrvDeltaPct?: number;
  rhrDelta?: number;
  strain?: number;
  highZoneMinutes?: number;
}): string[] {
  const actions: string[] = [];
  if (params.recovery !== undefined && params.recovery < 34) {
    actions.push("Training: keep intensity low today; prefer walking, mobility, easy zone 2 or technique work.");
  } else if (params.recovery !== undefined && params.recovery < 67) {
    actions.push("Training: use controlled moderate work; stop before the session becomes a recovery debt.");
  } else if (params.recovery !== undefined) {
    actions.push("Training: good window for progressive load if sleep, soreness and schedule are aligned.");
  }

  if ((params.sleepPerformance !== undefined && params.sleepPerformance < 80) || (params.sleepDebtHours !== undefined && params.sleepDebtHours >= 1)) {
    actions.push("Sleep: protect tonight with caffeine cutoff, dim light late, and a 60-90 minute earlier wind-down.");
  }

  if ((params.hrvDeltaPct !== undefined && params.hrvDeltaPct <= -10) || (params.rhrDelta !== undefined && params.rhrDelta >= 5)) {
    actions.push("Recovery: hydrate early, keep meals simple, add 10-20 minutes of breathwork/NSDR, and avoid stacking stimulants.");
  }

  if ((params.highZoneMinutes ?? 0) > 30 && params.recovery !== undefined && params.recovery < 67) {
    actions.push("Load management: avoid a second hard day after substantial zone 4/5 time unless readiness rebounds.");
  }

  actions.push("Cognition: schedule deep work during the most stable energy window; use shorter analytical blocks if readiness is low.");
  return [...new Set(actions)];
}

export async function buildDailySummary(client: WhoopClient, options: SummaryOptions) {
  const days = Math.max(options.days, 7);
  const bundle = await fetchBundle(client, days + 3);
  const recoveries = scored(sortDesc(bundle.recoveries, [["created_at"], ["updated_at"]]));
  const sleeps = scored(sortDesc(bundle.sleeps, [["start"], ["created_at"]]));
  const cycles = sortDesc(bundle.cycles, [["start"], ["created_at"]]);
  const workouts = sortDesc(bundle.workouts, [["start"], ["created_at"]]);

  const latestRecovery = latest(recoveries, [["created_at"], ["updated_at"]]);
  const latestSleep = latest(sleeps, [["start"], ["created_at"]]);
  const latestCycle = latest(cycles, [["start"], ["created_at"]]);
  const latestWorkout = latest(workouts, [["start"], ["created_at"]]);

  const baselineRecoveries = recoveries.filter((record) => record !== latestRecovery).slice(0, 7);
  const baselineSleeps = sleeps.filter((record) => record !== latestSleep).slice(0, 7);
  const baselineCycles = cycles.filter((record) => record !== latestCycle).slice(0, 7);

  const currentRecovery = latestRecovery ? recoveryScore(latestRecovery) : undefined;
  const currentHrv = latestRecovery ? hrv(latestRecovery) : undefined;
  const currentRhr = latestRecovery ? rhr(latestRecovery) : undefined;
  const avgHrv = avg(baselineRecoveries.map(hrv));
  const avgRhr = avg(baselineRecoveries.map(rhr));
  const currentSleepPerformance = latestSleep ? sleepPerformance(latestSleep) : undefined;
  const currentSleepActualMs = latestSleep ? sleepActualMs(latestSleep) : undefined;
  const currentSleepNeedMs = latestSleep ? sleepNeedMs(latestSleep) : undefined;
  const currentSleepDebtMs = latestSleep ? sleepDebtMs(latestSleep) : undefined;
  const currentStrain = latestCycle ? cycleStrain(latestCycle) : undefined;
  const baselineStrain = avg(baselineCycles.map(cycleStrain));
  const highZoneMinutes = sum(workouts.slice(0, 4).map(workoutHighZoneMinutes));

  const hrvDeltaPct = percentDelta(currentHrv, avgHrv);
  const rhrDelta = delta(currentRhr, avgRhr);
  const signals = [
    currentRecovery !== undefined ? `Recovery is ${round(currentRecovery, 0)} (${recoveryBand(currentRecovery)}).` : "No scored recovery available yet.",
    currentHrv !== undefined ? `HRV is ${round(currentHrv, 1)} ms (${round(hrvDeltaPct, 0) ?? "n/a"}% vs recent baseline).` : undefined,
    currentRhr !== undefined ? `Resting HR is ${round(currentRhr, 0)} bpm (${round(rhrDelta, 0) ?? "n/a"} bpm vs recent baseline).` : undefined,
    currentSleepPerformance !== undefined ? `Sleep performance is ${round(currentSleepPerformance, 0)}%; actual sleep ${hours(currentSleepActualMs) ?? "n/a"}h vs need ${hours(currentSleepNeedMs) ?? "n/a"}h.` : undefined,
    currentStrain !== undefined ? `Latest cycle strain is ${round(currentStrain, 1)} vs baseline ${round(baselineStrain, 1) ?? "n/a"}.` : undefined,
    latestWorkout ? `Latest workout: ${workoutSport(latestWorkout) ?? "unknown sport"}, strain ${round(workoutStrain(latestWorkout), 1) ?? "n/a"}.` : undefined
  ].filter((value): value is string => Boolean(value));

  const actions = buildDailyActions({
    recovery: currentRecovery,
    sleepPerformance: currentSleepPerformance,
    sleepDebtHours: hours(currentSleepDebtMs),
    hrvDeltaPct,
    rhrDelta,
    strain: currentStrain,
    highZoneMinutes
  });

  return {
    kind: "daily_summary",
    generated_at: new Date().toISOString(),
    lookback_days: days,
    data_quality: {
      confidence: confidence({ recoveries: recoveries.length, sleeps: sleeps.length, cycles: cycles.length }, 3),
      counts: { recoveries: recoveries.length, sleeps: sleeps.length, cycles: cycles.length, workouts: workouts.length },
      pages_fetched: bundle.pages_fetched
    },
    latest: {
      recovery: latestRecovery ? {
        date: formatDate(latestRecovery, [["created_at"], ["updated_at"]], options.timezone),
        score: round(currentRecovery, 0),
        band: recoveryBand(currentRecovery),
        hrv_rmssd_milli: round(currentHrv, 1),
        hrv_delta_pct: round(hrvDeltaPct, 0),
        resting_heart_rate: round(currentRhr, 0),
        resting_hr_delta_bpm: round(rhrDelta, 0),
        score_state: scoreState(latestRecovery)
      } : undefined,
      sleep: latestSleep ? {
        start: formatDate(latestSleep, [["start"], ["created_at"]], options.timezone),
        performance_pct: round(currentSleepPerformance, 0),
        consistency_pct: round(sleepConsistency(latestSleep), 0),
        efficiency_pct: round(sleepEfficiency(latestSleep), 0),
        actual_sleep_hours: hours(currentSleepActualMs),
        sleep_need_hours: hours(currentSleepNeedMs),
        sleep_debt_hours: hours(currentSleepDebtMs),
        awake_minutes: minutes(awakeMs(latestSleep)),
        disturbances: disturbances(latestSleep),
        score_state: scoreState(latestSleep)
      } : undefined,
      cycle: latestCycle ? {
        start: formatDate(latestCycle, [["start"], ["created_at"]], options.timezone),
        strain: round(currentStrain, 1),
        baseline_strain: round(baselineStrain, 1),
        score_state: scoreState(latestCycle)
      } : undefined,
      workout: latestWorkout ? {
        start: formatDate(latestWorkout, [["start"], ["created_at"]], options.timezone),
        sport: workoutSport(latestWorkout),
        strain: round(workoutStrain(latestWorkout), 1),
        high_zone_minutes: round(workoutHighZoneMinutes(latestWorkout), 0),
        aerobic_minutes: round(workoutAerobicMinutes(latestWorkout), 0),
        score_state: scoreState(latestWorkout)
      } : undefined
    },
    diagnostic: {
      primary_signal: signals[0] ?? "Insufficient data for a strong daily signal.",
      signals,
      action_candidates: actions,
      disclaimer: "Performance coaching only; not medical advice."
    }
  };
}

export async function buildWeeklySummary(client: WhoopClient, options: SummaryOptions) {
  const days = Math.max(options.days, 7);
  const compareDays = Math.max(options.compare_days ?? days, 0);
  const bundle = await fetchBundle(client, days + compareDays + 2);
  const now = Date.now();
  const recentStart = now - days * 24 * HOUR_MS;
  const priorStart = now - (days + compareDays) * 24 * HOUR_MS;

  const inRange = (record: UnknownRecord, paths: string[][], startMs: number, endMs: number) => {
    const time = firstDate(record, paths)?.getTime();
    return time !== undefined && time >= startMs && time < endMs;
  };

  const recoveryDatePaths = [["created_at"], ["updated_at"]];
  const activityDatePaths = [["start"], ["created_at"]];
  const recoveries = scored(bundle.recoveries).filter((record) => inRange(record, recoveryDatePaths, recentStart, now));
  const priorRecoveries = scored(bundle.recoveries).filter((record) => inRange(record, recoveryDatePaths, priorStart, recentStart));
  const sleeps = scored(bundle.sleeps).filter((record) => inRange(record, activityDatePaths, recentStart, now));
  const priorSleeps = scored(bundle.sleeps).filter((record) => inRange(record, activityDatePaths, priorStart, recentStart));
  const cycles = bundle.cycles.filter((record) => inRange(record, activityDatePaths, recentStart, now));
  const priorCycles = bundle.cycles.filter((record) => inRange(record, activityDatePaths, priorStart, recentStart));
  const workouts = bundle.workouts.filter((record) => inRange(record, activityDatePaths, recentStart, now));

  const metrics = {
    avg_recovery: round(avg(recoveries.map(recoveryScore)), 0),
    avg_hrv_rmssd_milli: round(avg(recoveries.map(hrv)), 1),
    avg_resting_heart_rate: round(avg(recoveries.map(rhr)), 0),
    avg_sleep_performance_pct: round(avg(sleeps.map(sleepPerformance)), 0),
    avg_sleep_consistency_pct: round(avg(sleeps.map(sleepConsistency)), 0),
    avg_sleep_efficiency_pct: round(avg(sleeps.map(sleepEfficiency)), 0),
    avg_actual_sleep_hours: hours(avg(sleeps.map(sleepActualMs))),
    avg_sleep_debt_hours: hours(avg(sleeps.map(sleepDebtMs))),
    avg_cycle_strain: round(avg(cycles.map(cycleStrain)), 1),
    high_strain_days: cycles.filter((record) => (cycleStrain(record) ?? 0) >= 14).length,
    workouts: workouts.length,
    total_workout_strain: round(sum(workouts.map(workoutStrain)), 1),
    aerobic_minutes: round(sum(workouts.map(workoutAerobicMinutes)), 0),
    high_zone_minutes: round(sum(workouts.map(workoutHighZoneMinutes)), 0)
  };

  const priorMetrics = {
    avg_recovery: round(avg(priorRecoveries.map(recoveryScore)), 0),
    avg_hrv_rmssd_milli: round(avg(priorRecoveries.map(hrv)), 1),
    avg_resting_heart_rate: round(avg(priorRecoveries.map(rhr)), 0),
    avg_sleep_performance_pct: round(avg(priorSleeps.map(sleepPerformance)), 0),
    avg_sleep_consistency_pct: round(avg(priorSleeps.map(sleepConsistency)), 0),
    avg_cycle_strain: round(avg(priorCycles.map(cycleStrain)), 1)
  };

  const bottlenecks: string[] = [];
  if ((metrics.avg_sleep_consistency_pct ?? 100) < 70) bottlenecks.push("Sleep timing consistency appears to be a high-leverage bottleneck.");
  if ((metrics.avg_sleep_performance_pct ?? 100) < 80) bottlenecks.push("Sleep performance is likely limiting recovery and cognitive output.");
  if ((metrics.avg_recovery ?? 100) < 67 && metrics.high_strain_days >= 2) bottlenecks.push("Training stress may be outrunning recovery; avoid stacking high-strain days.");
  if ((metrics.aerobic_minutes ?? 0) < 120) bottlenecks.push("Aerobic base volume looks low; zone 2/3 volume may be the safest conditioning lever.");
  if (!bottlenecks.length) bottlenecks.push("No dominant bottleneck detected; focus on consistency and controlled overload.");

  const actions = [
    "Use green recovery days for key training sessions; use yellow/red days for zone 2, technique, mobility or recovery.",
    "Avoid two high-strain days in a row unless sleep and HRV are also trending positively.",
    "Target 2-3 zone 2 sessions of 30-45 minutes if aerobic minutes are below target.",
    "Protect sleep timing first: consistent wake time, caffeine cutoff, and low light late evening.",
    "Place deep work after good sleep or green recovery; use shorter execution blocks on low-readiness days."
  ];

  return {
    kind: "weekly_summary",
    generated_at: new Date().toISOString(),
    window: {
      days,
      compare_days: compareDays,
      start: new Date(recentStart).toISOString(),
      end: new Date(now).toISOString(),
      prior_start: compareDays ? new Date(priorStart).toISOString() : undefined,
      prior_end: compareDays ? new Date(recentStart).toISOString() : undefined
    },
    data_quality: {
      confidence: confidence({ recoveries: recoveries.length, sleeps: sleeps.length, cycles: cycles.length }, 3),
      counts: { recoveries: recoveries.length, sleeps: sleeps.length, cycles: cycles.length, workouts: workouts.length },
      prior_counts: { recoveries: priorRecoveries.length, sleeps: priorSleeps.length, cycles: priorCycles.length },
      pages_fetched: bundle.pages_fetched
    },
    scorecard: {
      current: metrics,
      prior: priorMetrics,
      deltas: {
        avg_recovery: round(delta(metrics.avg_recovery, priorMetrics.avg_recovery), 0),
        avg_hrv_pct: round(percentDelta(metrics.avg_hrv_rmssd_milli, priorMetrics.avg_hrv_rmssd_milli), 0),
        avg_resting_hr_bpm: round(delta(metrics.avg_resting_heart_rate, priorMetrics.avg_resting_heart_rate), 0),
        avg_sleep_performance: round(delta(metrics.avg_sleep_performance_pct, priorMetrics.avg_sleep_performance_pct), 0),
        avg_sleep_consistency: round(delta(metrics.avg_sleep_consistency_pct, priorMetrics.avg_sleep_consistency_pct), 0),
        avg_cycle_strain: round(delta(metrics.avg_cycle_strain, priorMetrics.avg_cycle_strain), 1)
      }
    },
    diagnostic: {
      bottlenecks,
      action_candidates: actions,
      success_metrics_next_week: [
        "Average sleep performance above 85%.",
        "Sleep consistency trending upward.",
        "Resting HR stable or lower while HRV is stable or higher.",
        "High-strain days separated by adequate recovery.",
        "At least 120 minutes of zone 2/3 aerobic work if conditioning is the goal."
      ],
      disclaimer: "Performance coaching only; not medical advice."
    }
  };
}

export function formatSummaryMarkdown(summary: Record<string, unknown>): string {
  const kind = summary.kind === "weekly_summary" ? "WHOOP Weekly Summary" : "WHOOP Daily Summary";
  const lines = [`# ${kind}`, ""];
  const dataQuality = summary.data_quality as UnknownRecord | undefined;
  if (dataQuality) {
    lines.push(`- **confidence**: ${String(dataQuality.confidence ?? "unknown")}`);
    lines.push(`- **counts**: ${JSON.stringify(dataQuality.counts ?? {})}`);
    lines.push("");
  }
  const diagnostic = summary.diagnostic as UnknownRecord | undefined;
  if (diagnostic?.primary_signal) {
    lines.push(`## Primary signal\n${String(diagnostic.primary_signal)}\n`);
  }
  const signals = Array.isArray(diagnostic?.signals) ? diagnostic.signals : undefined;
  if (signals?.length) {
    lines.push("## Signals");
    for (const signal of signals) lines.push(`- ${String(signal)}`);
    lines.push("");
  }
  const bottlenecks = Array.isArray(diagnostic?.bottlenecks) ? diagnostic.bottlenecks : undefined;
  if (bottlenecks?.length) {
    lines.push("## Bottlenecks");
    for (const item of bottlenecks) lines.push(`- ${String(item)}`);
    lines.push("");
  }
  const actions = Array.isArray(diagnostic?.action_candidates) ? diagnostic.action_candidates : [];
  if (actions.length) {
    lines.push("## Action candidates");
    actions.forEach((action, index) => lines.push(`${index + 1}. ${String(action)}`));
    lines.push("");
  }
  if (diagnostic?.success_metrics_next_week && Array.isArray(diagnostic.success_metrics_next_week)) {
    lines.push("## Success metrics next week");
    for (const metric of diagnostic.success_metrics_next_week) lines.push(`- ${String(metric)}`);
    lines.push("");
  }
  lines.push(`_Disclaimer: ${String(diagnostic?.disclaimer ?? "Not medical advice.")}_`);
  return lines.join("\n");
}
