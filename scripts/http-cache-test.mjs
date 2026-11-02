// Smoke test for the HTTP cache middleware. Mocks the inner fetch to exercise:
//   1. GET hits cache on second call within TTL
//   2. POST never cached
//   3. TTL expiration triggers re-fetch
//   4. Cache key sensitivity to query param order (must normalize)
//   5. 4xx response not cached
//   6. env-var bypass works
//   7. per-call cache_ttl: 0 bypasses
//   8. getCacheStats() returns expected fields with correct hit_rate math
import assert from 'node:assert/strict';
import { fetchWithCache, getCacheStats, clearCache } from '../dist/services/http-cache.js';

const okResponse = (body = '{"ok":true}') => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
const notFound = () => new Response('{"error":"nope"}', { status: 404, headers: { 'content-type': 'application/json' } });

// Reset for a clean slate
clearCache();

// Case 1: GET hits cache on second call within TTL.
{
  let calls = 0;
  const inner = async () => { calls += 1; return okResponse(); };
  const opts = { innerFetch: inner, defaultTtlSeconds: 10 };

  const r1 = await fetchWithCache('https://api.example/v1/me', { method: 'GET' }, opts);
  const r2 = await fetchWithCache('https://api.example/v1/me', { method: 'GET' }, opts);
  assert.equal(r1.status, 200, 'first GET should be 200');
  assert.equal(r2.status, 200, 'cached GET should be 200');
  assert.equal(calls, 1, 'second GET within TTL must hit cache, not network');
  assert.equal(await r2.text(), '{"ok":true}', 'cached body matches original');
}

// Case 2: POST never cached.
clearCache();
{
  let calls = 0;
  const inner = async () => { calls += 1; return okResponse(); };
  const opts = { innerFetch: inner, defaultTtlSeconds: 10 };
  await fetchWithCache('https://api.example/v1/post', { method: 'POST', body: '{}' }, opts);
  await fetchWithCache('https://api.example/v1/post', { method: 'POST', body: '{}' }, opts);
  assert.equal(calls, 2, 'POST must always reach network');
  const stats = getCacheStats();
  assert.equal(stats.size, 0, 'POST must not populate cache');
}

// Case 3: TTL expiration triggers re-fetch.
clearCache();
{
  let calls = 0;
  let now = 1_000_000;
  const inner = async () => { calls += 1; return okResponse(); };
  const opts = { innerFetch: inner, defaultTtlSeconds: 5, now: () => now };

  await fetchWithCache('https://api.example/v1/ttl', { method: 'GET' }, opts);
  now += 4_000; // still within 5s
  await fetchWithCache('https://api.example/v1/ttl', { method: 'GET' }, opts);
  assert.equal(calls, 1, '4s within 5s TTL must hit cache');

  now += 2_000; // total 6s -> expired
  await fetchWithCache('https://api.example/v1/ttl', { method: 'GET' }, opts);
  assert.equal(calls, 2, '6s exceeds 5s TTL — should refetch');
}

// Case 4: Cache key sensitivity to query param order (must normalize).
clearCache();
{
  let calls = 0;
  const inner = async () => { calls += 1; return okResponse(); };
  const opts = { innerFetch: inner, defaultTtlSeconds: 30 };

  await fetchWithCache('https://api.example/v1/q?start=2026-05-01&end=2026-05-19&limit=10', { method: 'GET' }, opts);
  await fetchWithCache('https://api.example/v1/q?limit=10&end=2026-05-19&start=2026-05-01', { method: 'GET' }, opts);
  await fetchWithCache('https://api.example/v1/q?end=2026-05-19&start=2026-05-01&limit=10', { method: 'GET' }, opts);
  assert.equal(calls, 1, 'permutations of the same params must share a cache entry');
}

// Case 5: 4xx response not cached.
clearCache();
{
  let calls = 0;
  const inner = async () => { calls += 1; return notFound(); };
  const opts = { innerFetch: inner, defaultTtlSeconds: 10 };

  const r1 = await fetchWithCache('https://api.example/v1/missing', { method: 'GET' }, opts);
  const r2 = await fetchWithCache('https://api.example/v1/missing', { method: 'GET' }, opts);
  assert.equal(r1.status, 404);
  assert.equal(r2.status, 404);
  assert.equal(calls, 2, '404 responses must not be cached');
  const stats = getCacheStats();
  assert.equal(stats.size, 0);
}

// Case 6: env-var bypass works.
clearCache();
process.env.WHOOP_NO_CACHE = 'true';
{
  let calls = 0;
  const inner = async () => { calls += 1; return okResponse(); };
  const opts = { innerFetch: inner, defaultTtlSeconds: 10, envVarBypass: 'WHOOP_NO_CACHE' };

  await fetchWithCache('https://api.example/v1/bypass', { method: 'GET' }, opts);
  await fetchWithCache('https://api.example/v1/bypass', { method: 'GET' }, opts);
  assert.equal(calls, 2, 'WHOOP_NO_CACHE=true must skip cache reads AND writes');
  const stats = getCacheStats();
  assert.equal(stats.size, 0, 'env bypass must not populate cache');
}
delete process.env.WHOOP_NO_CACHE;

// Case 7: per-call cache_ttl: 0 bypasses.
clearCache();
{
  let calls = 0;
  const inner = async () => { calls += 1; return okResponse(); };
  const opts = { innerFetch: inner, defaultTtlSeconds: 60 };

  await fetchWithCache('https://api.example/v1/ttl0', { method: 'GET', cache_ttl: 0 }, opts);
  await fetchWithCache('https://api.example/v1/ttl0', { method: 'GET', cache_ttl: 0 }, opts);
  assert.equal(calls, 2, 'cache_ttl=0 must bypass both reads and writes');
  const stats = getCacheStats();
  assert.equal(stats.size, 0);
}

// Case 8: getCacheStats() shape and hit_rate math.
clearCache();
{
  let calls = 0;
  const inner = async () => { calls += 1; return okResponse(); };
  const opts = { innerFetch: inner, defaultTtlSeconds: 60 };

  await fetchWithCache('https://api.example/v1/stats', { method: 'GET' }, opts); // miss
  await fetchWithCache('https://api.example/v1/stats', { method: 'GET' }, opts); // hit
  await fetchWithCache('https://api.example/v1/stats', { method: 'GET' }, opts); // hit
  await fetchWithCache('https://api.example/v1/other', { method: 'GET' }, opts); // miss

  const stats = getCacheStats();
  assert.equal(typeof stats.size, 'number');
  assert.equal(typeof stats.hit_count, 'number');
  assert.equal(typeof stats.miss_count, 'number');
  assert.equal(typeof stats.hit_rate, 'number');
  assert.equal(stats.size, 2, 'two distinct URLs cached');
  assert.equal(stats.hit_count, 2);
  assert.equal(stats.miss_count, 2);
  assert.equal(stats.hit_rate, 0.5, 'hit_rate = hits / (hits + misses)');
}

// Sanity: cleared cache yields zero hit_rate, not NaN.
clearCache();
{
  const stats = getCacheStats();
  assert.equal(stats.hit_rate, 0, 'empty cache must yield hit_rate=0 not NaN');
}

// Owner regression: the URL-only cache otherwise reuses anonymous or another
// account's response. Existing smoke cases never send credentials. Exercise the
// public wrapper with its existing innerFetch seam, without network or tokens.
const headerForms = [
  ['object', (name, value) => ({ [name]: value })],
  ['Headers', (name, value) => new Headers({ [name]: value })],
  ['pairs', (name, value) => [[name, value]]],
];
let authenticatedCases = 0;
for (const headerName of ['aUtHoRiZaTiOn', 'cOoKiE']) {
  for (const [form, makeHeaders] of headerForms) {
    for (const empty of [false, true]) {
      const label = `${headerName}/${form}/${empty ? 'empty' : 'valued'}`;
      const url = 'https://api.example/v1/private';
      const valueA = empty ? '' : 'synthetic-A';
      const valueB = empty ? '' : 'synthetic-B';
      let calls = 0;
      const inner = async (_url, init) => {
        calls += 1;
        const headers = new Headers(init?.headers);
        return okResponse(JSON.stringify({ account: headers.has(headerName) ? headers.get(headerName) : 'anonymous' }));
      };
      const opts = { innerFetch: inner, defaultTtlSeconds: 60 };

      clearCache();
      await fetchWithCache(url, {}, opts);
      for (const value of [valueA, valueB, valueB]) {
        const response = await fetchWithCache(url, { headers: makeHeaders(headerName, value) }, opts);
        assert.equal((await response.json()).account, value, `${label}: authenticated request must not read a cached response`);
      }
      assert.equal(calls, 4, `${label}: even repeated credentials must reach innerFetch`);
      assert.deepEqual(getCacheStats(), { size: 1, hit_count: 0, miss_count: 1, hit_rate: 0 });
      const anonymous = await fetchWithCache(url, {}, opts);
      assert.equal((await anonymous.json()).account, 'anonymous', `${label}: authenticated response must not replace anonymous cache`);
      assert.equal(calls, 4);

      clearCache();
      calls = 0;
      await fetchWithCache(url, { headers: makeHeaders(headerName, valueA) }, opts);
      assert.deepEqual(getCacheStats(), { size: 0, hit_count: 0, miss_count: 0, hit_rate: 0 }, `${label}: authenticated response must not populate cache`);
      const firstAnonymous = await fetchWithCache(url, {}, opts);
      const cachedAnonymous = await fetchWithCache(url, {}, opts);
      assert.equal((await firstAnonymous.json()).account, 'anonymous');
      assert.equal((await cachedAnonymous.json()).account, 'anonymous');
      assert.equal(calls, 2, `${label}: anonymous caching must remain effective`);
      authenticatedCases += 1;
    }
  }
}
clearCache();

console.log(JSON.stringify({ ok: true, suite: 'http-cache', authenticatedCases }, null, 2));
