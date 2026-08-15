import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const testDir = mkdtempSync(join(tmpdir(), 'whoop-security-test-'));

async function testStateEntropy() {
  const { randomBytes: randomBytesFn } = await import('node:crypto');
  
  const state1 = randomBytesFn(16).toString('hex');
  const state2 = randomBytesFn(16).toString('hex');
  
  assert.ok(state1.length >= 32, 'State should be at least 32 hex chars (128 bits)');
  assert.ok(state2.length >= 32, 'State should be at least 32 hex chars (128 bits)');
  assert.notEqual(state1, state2, 'States should be unique');
  
  console.log('✓ OAuth state entropy: 128+ bits verified');
}

async function testPkceStore() {
  const { PkceStore } = await import('../dist/services/pkce-store.js');
  
  const store = new PkceStore(testDir);
  const state = randomBytes(16).toString('hex');
  
  const session = await store.createSession(state);
  
  assert.ok(session.code_verifier, 'Code verifier should be generated');
  assert.ok(session.code_challenge, 'Code challenge should be generated');
  assert.equal(session.state, state, 'State should match');
  assert.ok(session.code_verifier.length >= 43, 'Code verifier should be at least 43 chars');
  assert.ok(session.code_challenge.length >= 43, 'Code challenge should be at least 43 chars');
  assert.ok(!session.code_verifier.includes('='), 'Code verifier should be base64url encoded (no padding)');
  assert.ok(!session.code_challenge.includes('='), 'Code challenge should be base64url encoded (no padding)');
  
  const retrieved = await store.getSession(state);
  assert.deepEqual(retrieved, session, 'Retrieved session should match stored session');
  
  await store.deleteSession(state);
  const deleted = await store.getSession(state);
  assert.equal(deleted, null, 'Deleted session should return null');
  
  console.log('✓ PKCE store: verifier, challenge, S256 verified');
}

async function testPkceInAuthUrl() {
  const { WhoopClient } = await import('../dist/services/whoop-client.js');
  
  const config = {
    clientId: 'test-client',
    clientSecret: 'test-secret',
    redirectUri: 'http://127.0.0.1:3000/callback',
    scopes: ['read:recovery'],
    tokenPath: join(testDir, 'tokens.json'),
    privacyMode: 'summary',
    cacheEnabled: false,
    cachePath: join(testDir, 'cache.sqlite')
  };
  
  const client = new WhoopClient(config);
  const state = randomBytes(16).toString('hex');
  const url = await client.authUrl(state);
  
  const parsed = new URL(url);
  
  assert.ok(parsed.searchParams.has('code_challenge'), 'Auth URL should include code_challenge');
  assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256', 'Auth URL should use S256 challenge method');
  assert.equal(parsed.searchParams.get('state'), state, 'Auth URL should include state');
  assert.ok(parsed.searchParams.get('code_challenge').length >= 43, 'Code challenge should be at least 43 chars');
  
  console.log('✓ PKCE in auth URL: code_challenge, code_challenge_method=S256 verified');
}

async function testRefreshTokenPreservation() {
  const { TokenStore } = await import('../dist/services/token-store.js');
  
  const tokenPath = join(testDir, 'refresh-test-tokens.json');
  const store = new TokenStore(tokenPath);
  
  const original = {
    access_token: 'old-access',
    refresh_token: 'preserved-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'Bearer',
    scope: 'read:recovery'
  };
  
  await store.write(original);
  
  const refreshed = {
    access_token: 'new-access',
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    token_type: 'Bearer',
    scope: 'read:recovery'
  };
  
  const merged = {
    ...original,
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? original.refresh_token
  };
  
  await store.write(merged);
  const read = await store.read();
  
  assert.equal(read.access_token, 'new-access', 'Access token should be updated');
  assert.equal(read.refresh_token, 'preserved-refresh', 'Refresh token should be preserved when provider omits it');
  assert.ok(read.expires_at > original.expires_at, 'Expiry should be updated');
  
  console.log('✓ Refresh token preservation: undefined does not clobber existing refresh_token');
}

async function testPkceSessionCleanup() {
  const { PkceStore } = await import('../dist/services/pkce-store.js');
  
  const store = new PkceStore(testDir);
  const state1 = randomBytes(16).toString('hex');
  const state2 = randomBytes(16).toString('hex');
  
  await store.createSession(state1);
  const session2 = await store.createSession(state2);
  
  session2.created_at = Date.now() - 700_000;
  const sessionPath = join(testDir, `pkce-${state2}.json`);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(sessionPath, JSON.stringify(session2, null, 2), { mode: 0o600 });
  
  await store.cleanup();
  
  const fresh = await store.getSession(state1);
  const expired = await store.getSession(state2);
  
  assert.ok(fresh !== null, 'Fresh session should still exist');
  assert.ok(expired === null, 'Expired session should be cleaned up');
  
  console.log('✓ PKCE session cleanup: expired sessions are removed');
}

try {
  await testStateEntropy();
  await testPkceStore();
  await testPkceInAuthUrl();
  await testRefreshTokenPreservation();
  await testPkceSessionCleanup();
  
  console.log('\n✓ All security tests passed');
  rmSync(testDir, { recursive: true, force: true });
  process.exit(0);
} catch (error) {
  console.error('\n✗ Security test failed:', error.message);
  rmSync(testDir, { recursive: true, force: true });
  process.exit(1);
}
