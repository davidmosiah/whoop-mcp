import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPrivacyAudit } from '../dist/services/audit.js';
import { WhoopCache } from '../dist/services/cache.js';
import { applyPrivacy } from '../dist/services/privacy.js';
import { redactErrorMessage, redactSensitive } from '../dist/services/redaction.js';

const recovery = {
  cycle_id: 1,
  sleep_id: 'sleep-1',
  user_id: 99,
  created_at: '2026-01-01T00:00:00Z',
  score_state: 'SCORED',
  score: {
    recovery_score: 88,
    resting_heart_rate: 50,
    hrv_rmssd_milli: 60,
    spo2_percentage: 97,
    skin_temp_celsius: 33.5
  }
};

const structured = applyPrivacy('/v2/recovery', recovery, 'structured');
assert.equal(structured.user_id, 99);
assert.equal(structured.recovery_score, 88);
assert.deepEqual(structured.score, recovery.score);

const futureStructured = applyPrivacy('/v2/activity/sleep', {
  id: 'sleep-future',
  score_state: 'SCORED',
  score: {
    sleep_performance_percentage: 88,
    futureStageMetric: 73,
  },
  futureMetrics: { sleepRegularity: 91 },
}, 'structured');
assert.equal(futureStructured.score.futureStageMetric, 73);
assert.deepEqual(futureStructured.futureMetrics, { sleepRegularity: 91 });

const summary = applyPrivacy('/v2/recovery', recovery, 'summary');
assert.equal(summary.recovery_score, 88);
assert.equal(summary.user_id, undefined);
assert.equal(summary.spo2_percentage, undefined);

const raw = applyPrivacy('/v2/recovery', recovery, 'raw');
assert.equal(raw.score.spo2_percentage, 97);

assert.equal(redactSensitive({ access_token: 'abc', nested: { client_secret: 'def' } }).access_token, '[REDACTED]');
assert.match(redactErrorMessage('Authorization: Bearer abc.def.ghi'), /REDACTED/);
assert.equal(buildPrivacyAudit().unofficial, true);

const dir = mkdtempSync(join(tmpdir(), 'whoop-mcp-cache-'));
try {
  const path = join(dir, 'cache.sqlite');
  const cache = new WhoopCache(path);
  cache.set('GET', 'https://example.com/a', { ok: true });
  assert.deepEqual(cache.get('GET', 'https://example.com/a'), { ok: true });
  assert.equal(cache.status().entries, 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(JSON.stringify({ ok: true, privacy: true, cache: true, redaction: true, audit: true }, null, 2));

// Agent raw escalation requires explicit_user_intent
{
  const { resolvePrivacyMode } = await import('../dist/services/privacy.js');
  const cfg = { privacyMode: 'structured' };
  try {
    resolvePrivacyMode(cfg, 'raw', { explicit_user_intent: false });
    assert.fail('raw without intent should throw');
  } catch (e) {
    assert.match(String(e.message || e), /USER_ACTION_REQUIRED|explicit_user_intent/i);
  }
  assert.equal(resolvePrivacyMode(cfg, 'raw', { explicit_user_intent: true }), 'raw');
  assert.equal(resolvePrivacyMode({ privacyMode: 'raw' }), 'raw');
  console.log(JSON.stringify({ ok: true, suite: 'privacy-escalation-gate' }, null, 2));
}
