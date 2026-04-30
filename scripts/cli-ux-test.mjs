import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseLocalRedirectUri } from '../dist/cli/auth.js';
import { buildConnectionStatus } from '../dist/services/connection-status.js';

const dir = mkdtempSync(join(tmpdir(), 'whoop-mcp-cli-'));

try {
  const missing = await buildConnectionStatus({ env: {}, homeDir: dir, nowMs: 1_000_000 });
  assert.equal(missing.ok, false);
  assert.equal(missing.ready_for_whoop_api, false);
  assert.deepEqual(missing.missing_env, ['WHOOP_CLIENT_ID', 'WHOOP_CLIENT_SECRET', 'WHOOP_REDIRECT_URI']);
  assert.ok(missing.next_steps.some((step) => step.includes('WHOOP_CLIENT_ID')));

  const tokenPath = join(dir, 'tokens.json');
  writeFileSync(tokenPath, JSON.stringify({
    access_token: 'access',
    refresh_token: 'refresh',
    expires_at: 2_000_000
  }), { mode: 0o600 });

  const ready = await buildConnectionStatus({
    env: {
      WHOOP_CLIENT_ID: 'client-id',
      WHOOP_CLIENT_SECRET: 'client-secret',
      WHOOP_REDIRECT_URI: 'http://127.0.0.1:4567/callback',
      WHOOP_TOKEN_PATH: tokenPath,
      WHOOP_PRIVACY_MODE: 'summary',
      WHOOP_CACHE: 'sqlite'
    },
    homeDir: dir,
    nowMs: 1_000_000
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.ready_for_whoop_api, true);
  assert.equal(ready.privacy_mode, 'summary');
  assert.equal(ready.cache.enabled, true);
  assert.equal(ready.token.exists, true);
  assert.equal(ready.token.secure_permissions, true);
  assert.equal(ready.token.has_refresh_token, true);

  assert.deepEqual(parseLocalRedirectUri('http://127.0.0.1:4567/callback'), {
    host: '127.0.0.1',
    port: 4567,
    path: '/callback'
  });
  assert.throws(() => parseLocalRedirectUri('https://example.com/callback'), /local redirect URI/i);

  const doctor = spawnSync(process.execPath, ['dist/index.js', 'doctor', '--json'], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: dir
    }
  });
  assert.equal(doctor.status, 0, doctor.stderr);
  const doctorPayload = JSON.parse(doctor.stdout);
  assert.equal(doctorPayload.ok, false);
  assert.ok(doctorPayload.next_steps.some((step) => step.includes('WHOOP_CLIENT_ID')));

  const typo = spawnSync(process.execPath, ['dist/index.js', 'docter'], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: dir
    }
  });
  assert.equal(typo.status, 1);
  assert.match(typo.stderr, /Unknown command: docter/);

  const authWithoutEnv = spawnSync(process.execPath, ['dist/index.js', 'auth', '--no-open'], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: dir
    }
  });
  assert.equal(authWithoutEnv.status, 1);
  assert.match(authWithoutEnv.stderr, /Missing required WHOOP environment variables/);
  assert.doesNotMatch(authWithoutEnv.stderr, new RegExp('at .*dist/'));

  const setup = spawnSync(process.execPath, [
    'dist/index.js',
    'setup',
    '--client',
    'generic',
    '--client-id',
    'client-id-from-setup',
    '--client-secret',
    'client-secret-from-setup',
    '--redirect-uri',
    'http://127.0.0.1:4567/callback',
    '--privacy-mode',
    'summary',
    '--cache',
    'sqlite',
    '--no-auth',
    '--json'
  ], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: dir
    }
  });
  assert.equal(setup.status, 0, setup.stderr);
  const setupPayload = JSON.parse(setup.stdout);
  assert.equal(setupPayload.ok, true);
  assert.match(setupPayload.config_path, /config\.json$/);
  assert.match(setupPayload.client_config_path, /generic\.json$/);

  const configPath = join(dir, '.whoop-mcp', 'config.json');
  const configMode = (statSync(configPath).mode & 0o777).toString(8);
  assert.equal(configMode, '600');
  const savedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(savedConfig.WHOOP_CLIENT_ID, 'client-id-from-setup');
  assert.equal(savedConfig.WHOOP_CLIENT_SECRET, 'client-secret-from-setup');
  assert.equal(savedConfig.WHOOP_PRIVACY_MODE, 'summary');
  assert.equal(savedConfig.WHOOP_CACHE, 'sqlite');

  const doctorAfterSetup = spawnSync(process.execPath, ['dist/index.js', 'doctor', '--json'], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: dir
    }
  });
  assert.equal(doctorAfterSetup.status, 0, doctorAfterSetup.stderr);
  const doctorAfterSetupPayload = JSON.parse(doctorAfterSetup.stdout);
  assert.deepEqual(doctorAfterSetupPayload.missing_env, []);
  assert.equal(doctorAfterSetupPayload.config.source, 'local_config');
  assert.equal(doctorAfterSetupPayload.automatic_auth_supported, true);
  assert.ok(doctorAfterSetupPayload.next_steps.some((step) => step.includes('auth')));

  console.log(JSON.stringify({ ok: true, cli_ux: true, doctor: true, status: true, auth_plan: true, setup: true }, null, 2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
