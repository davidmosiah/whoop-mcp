import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAgentManifest } from '../dist/services/agent-manifest.js';
import { buildConnectionStatus } from '../dist/services/connection-status.js';
import { formatCollection } from '../dist/services/format.js';

const dir = mkdtempSync(join(tmpdir(), 'whoop-mcp-agent-readiness-'));

try {
  const markdown = formatCollection('WHOOP Workouts', [
    {
      id: 'workout-1',
      start: '2026-05-01T10:00:00Z',
      score_state: 'SCORED',
      score: { strain: 8.2, average_heart_rate: 123 }
    }
  ], {
    endpoint: '/v2/activity/workout',
    privacy_mode: 'structured',
    count: 1,
    records: [{ id: 'workout-1' }],
    pages_fetched: 1
  });

  assert.doesNotMatch(markdown, /\[object Object\]/, 'Markdown previews must not leak JavaScript object stringification.');
  assert.match(markdown, /WHOOP Workouts/);
  assert.match(markdown, /"strain":8\.2/);

  const tokenPath = join(dir, 'whoop_tokens.json');
  writeFileSync(tokenPath, JSON.stringify({
    access_token: 'expired-access-token',
    refresh_token: 'refresh-token',
    expires_at: 10
  }), { mode: 0o600 });

  const status = await buildConnectionStatus({
    env: {
      WHOOP_CLIENT_ID: 'client-id',
      WHOOP_CLIENT_SECRET: 'client-secret',
      WHOOP_REDIRECT_URI: 'http://127.0.0.1:3000/callback',
      WHOOP_TOKEN_PATH: tokenPath
    },
    homeDir: dir,
    nowMs: 20_000,
    client: 'hermes'
  });

  assert.equal(status.ok, true, 'Expired WHOOP access token with refresh_token should still be ready.');
  assert.equal(status.ready_for_whoop_api, true);
  assert.equal(status.token.expired, true);
  assert.equal(status.token.has_refresh_token, true);
  assert.equal(status.client, 'hermes');

  for (const target of ['claude', 'codex', 'cursor', 'hermes', 'openclaw']) {
    const manifest = buildAgentManifest(target);
    assert.equal(manifest.client, target);
    assert.ok(manifest.recommended_first_calls.includes('whoop_connection_status'));
    assert.ok(manifest.recommended_first_calls.includes('whoop_wellness_context'));
  }

  console.log(JSON.stringify({ ok: true, markdown: true, refreshable_token: true, clients: 5 }, null, 2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
