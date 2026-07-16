import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WhoopClient } from '../dist/services/whoop-client.js';

const dir = mkdtempSync(join(tmpdir(), 'whoop-mcp-endpoint-contract-'));
const tokenPath = join(dir, 'tokens.json');
writeFileSync(tokenPath, JSON.stringify({ access_token: 'synthetic-token' }), { mode: 0o600 });

const client = new WhoopClient({
  clientId: 'synthetic-client',
  clientSecret: 'synthetic-secret',
  redirectUri: 'http://127.0.0.1/callback',
  scopes: [],
  tokenPath,
  privacyMode: 'structured',
  cacheEnabled: false,
  cachePath: join(dir, 'cache.sqlite'),
});

const originalFetch = globalThis.fetch;
const originalNoCache = process.env.WHOOP_NO_CACHE;
const requestedUrls = [];
process.env.WHOOP_NO_CACHE = 'true';

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  requestedUrls.push(url);
  if (url.searchParams.get('nextToken') === 'page-2') {
    return Response.json({ records: [{ id: 'record-2' }] });
  }
  return Response.json({ records: [{ id: 'record-1' }], next_token: 'page-2' });
};

try {
  const start = '2026-07-08T23:00:00-03:00';
  const end = '2026-07-15T23:00:00-03:00';
  const result = await client.list('/v2/activity/sleep', {
    start,
    end,
    all_pages: true,
    max_pages: 2,
  });

  assert.equal(requestedUrls.length, 2);
  assert.equal(requestedUrls[0].searchParams.get('start'), start);
  assert.equal(requestedUrls[0].searchParams.get('end'), end);
  assert.equal(requestedUrls[0].searchParams.get('nextToken'), null);
  assert.equal(requestedUrls[1].searchParams.get('nextToken'), 'page-2');
  assert.deepEqual(result.records.map((record) => record.id), ['record-1', 'record-2']);
  assert.equal(result.pages_fetched, 2);

  const fetchCountBeforeInvalid = requestedUrls.length;
  await assert.rejects(
    client.list('/v2/activity/sleep', { start: 'not-a-date' }),
    /Invalid WHOOP start date-time/,
  );
  await assert.rejects(
    client.list('/v2/activity/sleep', { start: end, end: start }),
    /WHOOP start must not be later than end/,
  );
  assert.equal(requestedUrls.length, fetchCountBeforeInvalid, 'invalid ranges must fail before HTTP');

  console.log(JSON.stringify({ ok: true, suite: 'endpoint-contracts', requests: requestedUrls.length }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  if (originalNoCache === undefined) delete process.env.WHOOP_NO_CACHE;
  else process.env.WHOOP_NO_CACHE = originalNoCache;
  rmSync(dir, { recursive: true, force: true });
}
