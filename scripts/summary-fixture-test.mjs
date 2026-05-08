import assert from 'node:assert/strict';
import { buildDailySummary, buildWeeklySummary } from '../dist/services/summary.js';
import { buildWellnessContext, formatWellnessContextMarkdown } from '../dist/services/context.js';

const minute = 60 * 1000;
const hour = 60 * minute;
const now = Date.now();
const isoDaysAgo = (days) => new Date(now - days * 24 * hour).toISOString();

const recoveries = Array.from({ length: 8 }, (_, index) => ({
  cycle_id: 1000 + index,
  sleep_id: `sleep-${index}`,
  created_at: isoDaysAgo(index + 1),
  updated_at: isoDaysAgo(index + 1),
  score_state: 'SCORED',
  score: {
    recovery_score: index === 0 ? 82 : 70 - index,
    hrv_rmssd_milli: index === 0 ? 60 : 50 - index,
    resting_heart_rate: index === 0 ? 50 : 55 + index,
    spo2_percentage: 96,
    skin_temp_celsius: 33.7
  }
}));

const sleeps = Array.from({ length: 8 }, (_, index) => ({
  id: `sleep-${index}`,
  cycle_id: 1000 + index,
  start: isoDaysAgo(index + 1),
  end: new Date(now - (index + 1) * 24 * hour + 8 * hour).toISOString(),
  score_state: 'SCORED',
  score: {
    stage_summary: {
      total_in_bed_time_milli: 8 * hour,
      total_awake_time_milli: 30 * minute,
      total_light_sleep_time_milli: 4 * hour,
      total_slow_wave_sleep_time_milli: 90 * minute,
      total_rem_sleep_time_milli: 2 * hour,
      disturbance_count: 4
    },
    sleep_needed: {
      baseline_milli: 8 * hour,
      need_from_sleep_debt_milli: index === 0 ? 30 * minute : 0,
      need_from_recent_strain_milli: 0,
      need_from_recent_nap_milli: 0
    },
    sleep_performance_percentage: index === 0 ? 86 : 82,
    sleep_consistency_percentage: index === 0 ? 74 : 70,
    sleep_efficiency_percentage: 91
  }
}));

const cycles = Array.from({ length: 8 }, (_, index) => ({
  id: 1000 + index,
  start: isoDaysAgo(index + 1),
  score_state: 'SCORED',
  score: {
    strain: index === 0 ? 11.5 : 8 + index,
    average_heart_rate: 65,
    max_heart_rate: 150
  }
}));

const workouts = [{
  id: 'workout-1',
  start: isoDaysAgo(1),
  sport_name: 'running',
  score_state: 'SCORED',
  score: {
    strain: 8.2,
    average_heart_rate: 123,
    max_heart_rate: 146,
    zone_durations: {
      zone_two_milli: 30 * minute,
      zone_three_milli: 20 * minute,
      zone_four_milli: 10 * minute,
      zone_five_milli: 5 * minute
    }
  }
}];

const fakeClient = {
  async list(endpoint) {
    const map = {
      '/v2/recovery': recoveries,
      '/v2/activity/sleep': sleeps,
      '/v2/cycle': cycles,
      '/v2/activity/workout': workouts
    };
    return { records: map[endpoint] ?? [], pages_fetched: 1 };
  }
};

const daily = await buildDailySummary(fakeClient, { days: 10, timezone: 'UTC' });
assert.equal(daily.kind, 'daily_summary');
assert.equal(daily.latest.workout.high_zone_minutes, 15);
assert.equal(daily.latest.workout.aerobic_minutes, 50);
assert.equal(daily.latest.recovery.band, 'green');
assert.equal(daily.data_quality.confidence, 'high');

const weekly = await buildWeeklySummary(fakeClient, { days: 7, compare_days: 7, timezone: 'UTC' });
assert.equal(weekly.kind, 'weekly_summary');
assert.equal(weekly.scorecard.current.high_zone_minutes, 15);
assert.equal(weekly.scorecard.current.aerobic_minutes, 50);
assert.ok(weekly.diagnostic.action_candidates.length >= 3);

const context = await buildWellnessContext(fakeClient, { days: 10, timezone: 'UTC' });
assert.equal(context.source, 'whoop');
assert.equal(context.context_contract_version, 'delx-wellness-context/v1');
assert.equal(context.context_type, 'wellness_context');
assert.equal(context.recommended_handoff.tool, 'exercise_catalog_recommend_session');
assert.equal(context.recovery_score, 82);
assert.equal(context.sleep_score, 86);
assert.equal(context.strain_score, 11.5);
assert.equal(context.recent_training_load, 'normal');
assert.ok(context.telegram_summary.includes('WHOOP'));
const contextMarkdown = formatWellnessContextMarkdown(context);
assert.ok(contextMarkdown.includes('context_type'));
assert.ok(contextMarkdown.includes('exercise_catalog_recommend_session'));

console.log(JSON.stringify({ ok: true, daily: daily.kind, weekly: weekly.kind }, null, 2));
