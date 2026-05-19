// Smoke test for HTTP retry middleware. Mocks fetch to exercise:
//   - one transient 503 then success
//   - Retry-After header (seconds)
//   - WHOOP_NO_RETRY=true short-circuit
//   - 401 is not retried (auth, not transient)
//   - max attempts exhausted returns last response
import assert from 'node:assert/strict';
import { fetchWithRetry } from '../dist/services/http-retry.js';

const makeResponse = (status, headers = {}) => new Response(JSON.stringify({ status }), {
  status,
  headers: { 'content-type': 'application/json', ...headers }
});

const captured = [];
const baseOpts = {
  vendor: 'whoop',
  envFlag: 'WHOOP_NO_RETRY',
  baseDelayMs: 10,
  maxDelayMs: 50,
  jitterRatio: 0,
  logger: (m) => captured.push(m),
  sleeper: () => Promise.resolve()
};

// Case 1: 503 then 200 — retried once, returns success.
{
  let calls = 0;
  const fetchMock = async () => {
    calls += 1;
    if (calls === 1) return makeResponse(503);
    return makeResponse(200);
  };
  const res = await fetchWithRetry(fetchMock, 'https://example.test/a', undefined, baseOpts);
  assert.equal(res.status, 200, '503 then 200 should land on 200');
  assert.equal(calls, 2, 'fetch should be called exactly twice');
  const retryLogs = captured.filter((m) => m.startsWith('[whoop-mcp] retry'));
  assert.equal(retryLogs.length, 1, 'one retry log line expected');
  assert.match(retryLogs[0], /status=503/);
}

// Case 2: 429 with Retry-After header.
captured.length = 0;
{
  let calls = 0;
  let observedSleep = -1;
  const fetchMock = async () => {
    calls += 1;
    if (calls === 1) return makeResponse(429, { 'retry-after': '0.05' });
    return makeResponse(200);
  };
  const res = await fetchWithRetry(fetchMock, 'https://example.test/b', undefined, {
    ...baseOpts,
    sleeper: async (ms) => { observedSleep = ms; }
  });
  assert.equal(res.status, 200);
  assert.ok(observedSleep >= 50, `expected sleep >= 50 from Retry-After: got ${observedSleep}`);
}

// Case 3: WHOOP_NO_RETRY=true disables retries (returns the 503 immediately).
captured.length = 0;
process.env.WHOOP_NO_RETRY = 'true';
{
  let calls = 0;
  const fetchMock = async () => {
    calls += 1;
    return makeResponse(503);
  };
  const res = await fetchWithRetry(fetchMock, 'https://example.test/c', undefined, baseOpts);
  assert.equal(res.status, 503);
  assert.equal(calls, 1, 'env flag should short-circuit retries to one call');
  assert.equal(captured.filter((m) => m.includes('retry')).length, 0, 'no retry logs expected');
}
delete process.env.WHOOP_NO_RETRY;

// Case 4: 401 is NOT retried (auth, surface to caller).
captured.length = 0;
{
  let calls = 0;
  const fetchMock = async () => { calls += 1; return makeResponse(401); };
  const res = await fetchWithRetry(fetchMock, 'https://example.test/d', undefined, baseOpts);
  assert.equal(res.status, 401);
  assert.equal(calls, 1, '401 should not retry');
}

// Case 5: max attempts exhausted with persistent 502 returns last response.
captured.length = 0;
{
  let calls = 0;
  const fetchMock = async () => { calls += 1; return makeResponse(502); };
  const res = await fetchWithRetry(fetchMock, 'https://example.test/e', undefined, baseOpts);
  assert.equal(res.status, 502);
  assert.equal(calls, 3, 'should attempt the configured max (3) times');
}

// Case 6: network error retried once then succeeds.
captured.length = 0;
{
  let calls = 0;
  const fetchMock = async () => {
    calls += 1;
    if (calls === 1) throw new Error('ECONNRESET');
    return makeResponse(200);
  };
  const res = await fetchWithRetry(fetchMock, 'https://example.test/f', undefined, baseOpts);
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
  const retryLogs = captured.filter((m) => m.startsWith('[whoop-mcp] retry'));
  assert.equal(retryLogs.length, 1);
  assert.match(retryLogs[0], /error=ECONNRESET/);
}

console.log(JSON.stringify({ ok: true, suite: 'http-retry' }, null, 2));
