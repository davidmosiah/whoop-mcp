import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PkceStore } from '../dist/services/pkce-store.js';

// OAuth state is opaque input. It must never select a file outside its PKCE
// session, on either POSIX or Windows, even when callers bypass MCP validation.
const unsafeStates = [
  ['/../tokens', 'POSIX sibling file'],
  ['/../../outside', 'POSIX parent directory'],
  ['\\..\\tokens', 'Windows separators'],
  ['/..\\tokens', 'mixed separators'],
  ['bad\0state', 'null byte'],
];

for (const operation of ['createSession', 'getSession', 'deleteSession']) {
  for (const [state, label] of unsafeStates) {
    test(`${operation} rejects ${label} without changing files`, async (t) => {
      const root = mkdtempSync(join(tmpdir(), 'whoop-pkce-state-'));
      t.after(() => rmSync(root, { recursive: true, force: true }));
      const directory = join(root, 'sessions');
      mkdirSync(directory);
      const tokenPath = join(directory, 'tokens.json');
      const outsidePath = join(root, 'outside.json');
      const contents = JSON.stringify({ access_token: 'synthetic-sentinel', created_at: Date.now() });
      writeFileSync(tokenPath, contents);
      writeFileSync(outsidePath, contents);

      await assert.rejects(new PkceStore(directory)[operation](state), /Invalid OAuth state/);

      assert.equal(readFileSync(tokenPath, 'utf8'), contents, 'Existing tokens must remain unchanged');
      assert.equal(readFileSync(outsidePath, 'utf8'), contents, 'Files outside the store must remain unchanged');
      assert.deepEqual(readdirSync(directory), ['tokens.json'], 'Rejected state must not create session files');
      assert.deepEqual(readdirSync(root).sort(), ['outside.json', 'sessions']);
    });
  }
}

test('invalid state is rejected before creating the storage directory', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'whoop-pkce-state-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, 'new-store');

  await assert.rejects(new PkceStore(directory).createSession('/../tokens'), /Invalid OAuth state/);
  assert.equal(existsSync(directory), false);
  assert.deepEqual(readdirSync(root), []);
});

for (const state of ['a'.repeat(32), 'custom-state_0123', 'opaque.with%20spaces!']) {
  test(`path-free opaque state round-trips: ${state}`, async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'whoop-pkce-state-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const store = new PkceStore(root);

    const session = await store.createSession(state);
    assert.equal(session.state, state);
    assert.deepEqual(await store.getSession(state), session);
    await store.deleteSession(state);
    assert.equal(await store.getSession(state), null);
    assert.deepEqual(readdirSync(root), []);
  });
}
