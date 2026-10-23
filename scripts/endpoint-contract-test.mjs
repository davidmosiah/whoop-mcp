import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WhoopClient } from '../dist/services/whoop-client.js';

const dir = mkdtempSync(join(tmpdir(), 'whoop-mcp-endpoint-contract-'));
const tokenPath = join(dir, 'tokens.json');
writeFileSync(tokenPath, JSON.stringify({ access_token: 'synthetic-token' }), { mode: 0o600 });

const config = {
  clientId: 'synthetic-client',
  clientSecret: 'synthetic-secret',
  redirectUri: 'http://127.0.0.1/callback',
  scopes: [],
  tokenPath,
  privacyMode: 'structured',
  cacheEnabled: false,
  cachePath: join(dir, 'cache.sqlite'),
};
const client = new WhoopClient(config);

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

  // Exercise the real authenticated request path; cache operations are a generic
  // method+URL Map double. No SQLite constructor, token refresh or network runs.
  const persistentCases = [
    { name: 'initial success', cacheEnabled: true, outcome: 'success' },
    { name: 'refreshed success', cacheEnabled: true, refresh: true, outcome: 'success' },
    { name: 'initial HTTP error', cacheEnabled: true, outcome: 'http' },
    { name: 'rate limited', cacheEnabled: true, outcome: 'limited' },
    { name: 'refreshed HTTP error', cacheEnabled: true, refresh: true, outcome: 'http' },
    { name: 'same credential HTTP error', cacheEnabled: true, sameCredential: true, outcome: 'http' },
    { name: 'disabled cache HTTP error', cacheEnabled: false, outcome: 'http' },
    { name: 'transport error', cacheEnabled: true, outcome: 'transport' },
    { name: 'response read error', cacheEnabled: true, outcome: 'read' },
  ];
  for (const scenario of persistentCases) {
    const scoped = new WhoopClient({ ...config, cacheEnabled: scenario.cacheEnabled });
    const url = 'https://api.prod.whoop.com/developer/v2/user/profile/basic';
    const key = `GET ${url}`;
    const stale = { marker: 'synthetic-existing-cache-entry' };
    const cached = new Map([[key, stale]]);
    const calls = { opens: 0, gets: 0, sets: 0, refreshes: 0, requests: [] };
    const storage = {
      get(method, requestUrl) { calls.gets++; return cached.get(`${method} ${requestUrl}`); },
      set(method, requestUrl, payload) { calls.sets++; cached.set(`${method} ${requestUrl}`, payload); },
    };
    scoped.getCache = () => { calls.opens++; return storage; };
    let credential = 'synthetic-A';
    scoped.getValidToken = async () => ({ access_token: credential });
    scoped.refreshToken = async () => { calls.refreshes++; return { access_token: 'synthetic-refreshed' }; };
    const error = new Error(`synthetic ${scenario.outcome} failure`);
    let phase = 'first';
    scoped.fetchWithRetry = async (requestUrl, init) => {
      calls.requests.push({ url: requestUrl, authorization: new Headers(init.headers).get('Authorization') });
      if (phase === 'first') return Response.json({ marker: 'synthetic-fresh-A' });
      if (scenario.refresh && calls.refreshes === 0) return new Response('', { status: 401 });
      if (scenario.outcome === 'transport') throw error;
      if (scenario.outcome === 'read') {
        const response = new Response('', { status: 200 });
        response.text = async () => { throw error; };
        return response;
      }
      if (scenario.outcome === 'limited') return new Response('', { status: 429, headers: { 'Retry-After': '17' } });
      if (scenario.outcome === 'http') return Response.json({ message: 'synthetic unavailable' }, { status: 503 });
      return Response.json({ marker: 'synthetic-fresh-B' });
    };
    assert.deepEqual(await scoped.get('/v2/user/profile/basic'), { marker: 'synthetic-fresh-A' }, scenario.name);
    phase = 'second';
    if (!scenario.sameCredential) credential = 'synthetic-B';
    if (scenario.outcome === 'success') {
      assert.deepEqual(await scoped.get('/v2/user/profile/basic'), { marker: 'synthetic-fresh-B' }, scenario.name);
    } else if (scenario.outcome === 'limited') {
      await assert.rejects(() => scoped.get('/v2/user/profile/basic'), error => {
        assert.match(error.message, /WHOOP API HTTP 429.*retry in 17 seconds/);
        assert.doesNotMatch(error.message, /WHOOP_CACHE|enable caching/);
        return true;
      }, scenario.name);
    } else if (scenario.outcome === 'http') {
      await assert.rejects(() => scoped.get('/v2/user/profile/basic'), /WHOOP API HTTP 503/, scenario.name);
    } else {
      await assert.rejects(() => scoped.get('/v2/user/profile/basic'), observed => observed === error, scenario.name);
    }
    assert.equal(calls.opens, 0, `${scenario.name}: authenticated payloads must not open persistent cache`);
    assert.equal(calls.gets, 0, `${scenario.name}: authenticated errors must not read fallback`);
    assert.equal(calls.sets, 0, `${scenario.name}: authenticated successes must not persist payloads`);
    assert.deepEqual([...cached.entries()], [[key, stale]], `${scenario.name}: existing cache entries stay untouched`);
    assert.equal(calls.refreshes, scenario.refresh ? 1 : 0, scenario.name);
    assert.deepEqual(calls.requests.map(r => r.url), Array(scenario.refresh ? 3 : 2).fill(url), scenario.name);
    assert.deepEqual(calls.requests.map(r => r.authorization), [
      'Bearer synthetic-A',
      scenario.sameCredential ? 'Bearer synthetic-A' : 'Bearer synthetic-B',
      ...(scenario.refresh ? ['Bearer synthetic-refreshed'] : []),
    ], scenario.name);
  }
  console.log(JSON.stringify({ ok: true, suite: 'endpoint-contracts', requests: requestedUrls.length, persistent_cases: persistentCases.length }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  if (originalNoCache === undefined) delete process.env.WHOOP_NO_CACHE;
  else process.env.WHOOP_NO_CACHE = originalNoCache;
  rmSync(dir, { recursive: true, force: true });
}
