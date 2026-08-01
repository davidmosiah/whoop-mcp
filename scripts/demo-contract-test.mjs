/**
 * Contract gate for `whoop_demo`.
 *
 * The demo tool exists so agents can see the payload shape before spending an
 * OAuth round-trip. A hand-written example nobody compares against reality
 * drifts silently, and an agent that trusts it writes a parser for fields that
 * never arrive.
 *
 * This gate registers the REAL tools on a real MCP server, points the WHOOP
 * HTTP client at a synthetic WHOOP API, calls the three tools the demo claims
 * to exemplify, and compares key sets against the demo payload. It fails in
 * three ways:
 *
 *   - a key in the demo the real tool never returns  -> invented contract
 *   - a key the real tool returns the demo omits     -> incomplete contract
 *   - a shared key whose leaf type disagrees         -> field read wrong
 *
 * The type check matters as much as the key check: `records[].score` is a
 * NUMBER in a naive example and an OBJECT in the real structured payload, and a
 * key-name-only comparison would call that a match.
 *
 * Arrays are compared as the union of their elements' key paths, because a real
 * collection contains both fully scored and partially scored records and either
 * alone under-describes the shape.
 *
 * All data here is synthetic. No real WHOOP account, token or health data.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'whoop-mcp-demo-contract-'));
const tokenPath = join(dir, 'tokens.json');
writeFileSync(
  tokenPath,
  JSON.stringify({ access_token: 'synthetic-token', expires_at: Date.now() + 3_600_000 }),
  { mode: 0o600 },
);

process.env.HOME = dir;
process.env.WHOOP_CLIENT_ID = 'synthetic-client';
process.env.WHOOP_CLIENT_SECRET = 'synthetic-secret';
process.env.WHOOP_REDIRECT_URI = 'http://127.0.0.1/callback';
process.env.WHOOP_TOKEN_PATH = tokenPath;
process.env.WHOOP_CACHE = 'false';
process.env.WHOOP_CACHE_PATH = join(dir, 'cache.sqlite');
process.env.WHOOP_NO_CACHE = 'true';
delete process.env.WHOOP_PRIVACY_MODE; // exercise the documented default

const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
const { registerWhoopTools } = await import('../dist/tools/whoop-tools.js');

/* ------------------------------------------------------------------ *
 * Synthetic WHOOP API. Values are invented; the SHAPE mirrors WHOOP   *
 * v2 so the privacy normalizer runs its real code path.               *
 * ------------------------------------------------------------------ */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse('2026-05-01T09:20:00.000Z');
const isoDaysAgo = (days) => new Date(NOW - days * 24 * HOUR).toISOString();
const NEXT_TOKEN = 'synthetic-demo-page-2';

const recoveries = Array.from({ length: 8 }, (_, i) => ({
  cycle_id: 93_100 + i,
  sleep_id: `1a2b3c4d-0000-4000-8000-00000000000${i}`,
  user_id: 10_000_001,
  created_at: isoDaysAgo(i),
  updated_at: isoDaysAgo(i),
  score_state: 'SCORED',
  score: {
    user_calibrating: false,
    recovery_score: i === 0 ? 67 : 70 - i,
    hrv_rmssd_milli: i === 0 ? 58 : 60 - i,
    resting_heart_rate: i === 0 ? 52 : 51 + i,
    spo2_percentage: 96.1,
    skin_temp_celsius: 33.7,
  },
}));

const sleeps = Array.from({ length: 8 }, (_, i) => ({
  id: `9f8e7d6c-0000-4000-8000-00000000000${i}`,
  cycle_id: 93_100 + i,
  user_id: 10_000_001,
  created_at: isoDaysAgo(i),
  updated_at: isoDaysAgo(i),
  start: new Date(NOW - i * 24 * HOUR - 10 * HOUR).toISOString(),
  end: new Date(NOW - i * 24 * HOUR - 2 * HOUR).toISOString(),
  timezone_offset: '-03:00',
  nap: false,
  score_state: 'SCORED',
  score: {
    stage_summary: {
      total_in_bed_time_milli: 8 * HOUR,
      total_awake_time_milli: 26 * MINUTE,
      total_light_sleep_time_milli: 4 * HOUR,
      total_slow_wave_sleep_time_milli: 90 * MINUTE,
      total_rem_sleep_time_milli: 2 * HOUR,
      sleep_cycle_count: 5,
      disturbance_count: 5,
    },
    sleep_needed: {
      baseline_milli: 8 * HOUR,
      need_from_sleep_debt_milli: 24 * MINUTE,
      need_from_recent_strain_milli: 0,
      need_from_recent_nap_milli: 0,
    },
    respiratory_rate: 14.2,
    sleep_performance_percentage: i === 0 ? 88 : 82,
    sleep_consistency_percentage: 74,
    sleep_efficiency_percentage: 91,
  },
}));

const cycles = Array.from({ length: 8 }, (_, i) => ({
  id: 93_100 + i,
  user_id: 10_000_001,
  created_at: isoDaysAgo(i),
  updated_at: isoDaysAgo(i),
  start: new Date(NOW - i * 24 * HOUR - 4 * HOUR).toISOString(),
  end: new Date(NOW - i * 24 * HOUR).toISOString(),
  timezone_offset: '-03:00',
  score_state: 'SCORED',
  score: {
    strain: i === 0 ? 11.2 : 12 + (i % 3),
    kilojoule: 8_500,
    average_heart_rate: 65,
    max_heart_rate: 150,
  },
}));

const workouts = Array.from({ length: 3 }, (_, i) => ({
  id: `4c3b2a19-0000-4000-8000-00000000000${i}`,
  user_id: 10_000_001,
  created_at: isoDaysAgo(i),
  updated_at: isoDaysAgo(i),
  start: new Date(NOW - i * 24 * HOUR - 3 * HOUR).toISOString(),
  end: new Date(NOW - i * 24 * HOUR - 2 * HOUR).toISOString(),
  timezone_offset: '-03:00',
  sport_name: 'running',
  score_state: 'SCORED',
  score: {
    strain: 8.2,
    average_heart_rate: 123,
    max_heart_rate: 146,
    kilojoule: 1_800,
    percent_recorded: 100,
    distance_meter: 7_200,
    altitude_gain_meter: 40,
    altitude_change_meter: 5,
    zone_durations: {
      zone_zero_milli: 5 * MINUTE,
      zone_one_milli: 10 * MINUTE,
      zone_two_milli: 30 * MINUTE,
      zone_three_milli: 20 * MINUTE,
      zone_four_milli: 10 * MINUTE,
      zone_five_milli: 5 * MINUTE,
    },
  },
}));

const RECORDS_BY_PATH = {
  '/v2/recovery': recoveries,
  '/v2/activity/sleep': sleeps,
  '/v2/cycle': cycles,
  '/v2/activity/workout': workouts,
};

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  const path = Object.keys(RECORDS_BY_PATH).find((p) => url.pathname.endsWith(p));
  if (!path) return Response.json({ records: [] });
  // Page 2 exists but is empty: enough to make `next_token` / `has_more` part of
  // the real contract without duplicating records for the paging builders.
  if (url.searchParams.get('nextToken') === NEXT_TOKEN) return Response.json({ records: [] });
  return Response.json({ records: RECORDS_BY_PATH[path], next_token: NEXT_TOKEN });
};

/* ------------------------------------------------------------------ *
 * Key-path extraction and comparison                                  *
 * ------------------------------------------------------------------ */

/**
 * Keys the real tools only emit for certain accounts, scopes or privacy modes.
 * The demo may show them because agents will encounter them; the synthetic API
 * may not produce them. Each entry needs a reason.
 *
 * Deliberately narrow. Adding a key here to silence the gate defeats the gate.
 */
const OPTIONAL_IN_REAL = new Map([
  // No allowances needed today: the synthetic API exercises every documented
  // field. Kept as the explicit, reviewable place to record one if that changes.
]);

function leafType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Recursive key paths plus the observed leaf type(s) per path.
 * Arrays contribute the UNION of their elements' paths under a `[]` segment.
 */
function keyPaths(value, prefix = '', out = new Map()) {
  if (Array.isArray(value)) {
    for (const item of value) keyPaths(item, `${prefix}[]`, out);
    return out;
  }
  if (value === null || typeof value !== 'object') return out;
  for (const key of Object.keys(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const types = out.get(path) ?? new Set();
    types.add(leafType(value[key]));
    out.set(path, types);
    keyPaths(value[key], path, out);
  }
  return out;
}

function diff(demoPaths, realPaths) {
  const invented = [...demoPaths.keys()].filter((k) => !realPaths.has(k)).sort();
  const missing = [...realPaths.keys()]
    .filter((k) => !demoPaths.has(k) && !OPTIONAL_IN_REAL.has(k))
    .sort();
  const mistyped = [];
  for (const [path, demoTypes] of demoPaths) {
    const realTypes = realPaths.get(path);
    if (!realTypes) continue;
    // Only flag when the real side is unambiguous and the demo agrees with none
    // of it — a union on the real side means the field is genuinely polymorphic.
    if (realTypes.size !== 1) continue;
    if ([...demoTypes].some((t) => realTypes.has(t))) continue;
    mistyped.push(`${path}: demo is ${[...demoTypes].join('|')}, real is ${[...realTypes][0]}`);
  }
  return { invented, missing, mistyped: mistyped.sort() };
}

function report(name, { invented, missing, mistyped }) {
  const lines = [];
  if (invented.length > 0) {
    lines.push(
      `\n  ${name}: ${invented.length} key(s) in the demo the real tool NEVER returns.`,
      '  An agent trusting these writes a parser for data that never arrives:',
      ...invented.map((k) => `    - ${k}`),
    );
  }
  if (missing.length > 0) {
    lines.push(
      `\n  ${name}: ${missing.length} key(s) the real tool returns but the demo omits.`,
      '  Agents reading the demo will not know these exist:',
      ...missing.map((k) => `    + ${k}`),
    );
  }
  if (mistyped.length > 0) {
    lines.push(
      `\n  ${name}: ${mistyped.length} key(s) present in both but with a different type.`,
      '  The field is "found" and still read wrong:',
      ...mistyped.map((k) => `    ~ ${k}`),
    );
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Drive the real tools                                                *
 * ------------------------------------------------------------------ */
const server = new McpServer({ name: 'whoop-demo-contract', version: '0.0.0' });
registerWhoopTools(server);
const client = new Client({ name: 'whoop-demo-contract-client', version: '0.0.0' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
await client.connect(clientTransport);

async function callTool(name, args = {}) {
  const result = await client.callTool({ name, arguments: { response_format: 'json', ...args } });
  assert.ok(!result.isError, `${name} failed: ${result.content?.[0]?.text}`);
  assert.ok(result.structuredContent, `${name} returned no structuredContent`);
  return result.structuredContent;
}

let failures = [];
let checked = 0;

try {
  const demo = await callTool('whoop_demo');

  const real = {
    whoop_daily_summary: await callTool('whoop_daily_summary', { days: 10, timezone: 'UTC' }),
    whoop_wellness_context: await callTool('whoop_wellness_context', { days: 10, timezone: 'UTC' }),
    whoop_list_recoveries: await callTool('whoop_list_recoveries', { limit: 3 }),
  };

  for (const [name, realPayload] of Object.entries(real)) {
    assert.ok(demo.sample?.[name], `demo payload is missing the ${name} sample entirely`);
    const demoPaths = keyPaths(demo.sample[name]);
    const realPaths = keyPaths(realPayload);
    const result = diff(demoPaths, realPaths);
    checked += demoPaths.size;
    if (result.invented.length || result.missing.length || result.mistyped.length) {
      failures.push(report(name, result));
    } else {
      console.log(`PASS ${name} — ${demoPaths.size} key paths match the real tool`);
    }
  }

  // The demo must stay honest about being synthetic, whatever the shape says.
  assert.equal(demo.is_demo, true, 'demo payload must be tagged is_demo=true');
  assert.equal(demo.ok, true, 'demo payload must be tagged ok=true');
  assert.ok(Array.isArray(demo.notes) && demo.notes.length > 0, 'demo payload must carry notes');
  console.log('PASS demo payload is tagged synthetic');

  // A demo that leaks positional or device-identifier keys would teach agents a
  // contract the privacy normalizer deliberately does not emit.
  const encoded = JSON.stringify(demo).toLowerCase();
  for (const needle of ['latitude', 'longitude', 'latlng', 'polyline', 'access_token', 'refresh_token']) {
    assert.ok(!encoded.includes(needle), `demo payload must not contain "${needle}"`);
  }
  console.log('PASS demo payload carries no positional, route or credential keys');
} finally {
  await client.close();
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('\nFAIL demo contract drifted from the real tools:');
  console.error(failures.join('\n'));
  console.error(
    '\nFix src/services/demo.ts so the examples match what the tools return.' +
      '\nDo not widen OPTIONAL_IN_REAL to silence this — that is how the drift got here.\n',
  );
  process.exit(1);
}

console.log(`\ndemo-contract: ${checked} key paths verified against the real tools`);
console.log(JSON.stringify({ ok: true, suite: 'demo-contract', samples: 3 }));
