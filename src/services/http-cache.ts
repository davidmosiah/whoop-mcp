// HTTP response cache middleware.
//
// In-memory cache for GET responses with a configurable TTL (default 60s).
// Wraps the existing fetchWithRetry layer so cached responses skip both the
// network and the retry middleware. Per-connector singleton — each MCP
// package gets its own module instance and therefore its own cache map.
//
// Bypass conditions (any one short-circuits the cache):
//   1. process.env[envVarBypass] === "true"  (e.g. WHOOP_NO_CACHE=true)
//   2. init.cache_ttl === 0                  (per-call opt-out)
//   3. Non-GET method                         (POST/PUT/DELETE never cached)
//   4. Response status >= 400                 (don't cache errors)
//
// No new npm dependencies — Node built-ins only.

export type CacheOptions = { cache_ttl?: number };

export type FetchLikeFn = (url: string, init?: RequestInit) => Promise<Response>;

interface CacheEntry {
  data: { status: number; statusText: string; headers: Array<[string, string]>; body: string };
  expires: number;
}

const store = new Map<string, CacheEntry>();
let hitCount = 0;
let missCount = 0;

export interface FetchWithCacheOptions {
  defaultTtlSeconds?: number;
  envVarBypass?: string;
  now?: () => number; // override for tests
  innerFetch?: FetchLikeFn; // network/retry-wrapped fetch to call on miss; defaults to global fetch
}

export async function fetchWithCache(
  url: string,
  init: (RequestInit & CacheOptions) | undefined = {},
  options: FetchWithCacheOptions = {}
): Promise<Response> {
  const defaultTtl = Math.max(0, options.defaultTtlSeconds ?? 60);
  const now = options.now ?? (() => Date.now());
  const inner = options.innerFetch ?? ((u, i) => fetch(u, i));
  const { cache_ttl, ...nativeInit } = init ?? {};
  const ttlSeconds = cache_ttl === undefined ? defaultTtl : Math.max(0, cache_ttl);
  const method = (nativeInit.method ?? "GET").toUpperCase();

  const bypassEnv = options.envVarBypass ? process.env[options.envVarBypass] === "true" : false;
  const bypass = bypassEnv || ttlSeconds === 0 || method !== "GET";

  if (!bypass) {
    const key = cacheKey(method, url);
    const entry = store.get(key);
    if (entry && entry.expires > now()) {
      hitCount += 1;
      return responseFromEntry(entry);
    }
  }

  const response = await inner(url, nativeInit);

  if (!bypass && method === "GET" && response.status < 400) {
    missCount += 1;
    const key = cacheKey(method, url);
    const entry = await entryFromResponse(response, now() + ttlSeconds * 1000);
    store.set(key, entry);
    return responseFromEntry(entry);
  }

  return response;
}

export interface CacheStats {
  size: number;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
}

export function getCacheStats(): CacheStats {
  const total = hitCount + missCount;
  const hit_rate = total === 0 ? 0 : Number((hitCount / total).toFixed(4));
  return { size: store.size, hit_count: hitCount, miss_count: missCount, hit_rate };
}

export function clearCache(): void {
  store.clear();
  hitCount = 0;
  missCount = 0;
}

function cacheKey(method: string, url: string): string {
  const idx = url.indexOf("?");
  if (idx === -1) return `${method}:${url}:`;
  const base = url.slice(0, idx);
  const query = url.slice(idx + 1);
  const params = new URLSearchParams(query);
  const sorted = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const normalized = sorted.map(([k, v]) => `${k}=${v}`).join("&");
  return `${method}:${base}:${normalized}`;
}

async function entryFromResponse(response: Response, expires: number): Promise<CacheEntry> {
  const body = await response.text();
  const headers: Array<[string, string]> = [];
  response.headers.forEach((value, key) => { headers.push([key, value]); });
  return {
    data: { status: response.status, statusText: response.statusText, headers, body },
    expires
  };
}

function responseFromEntry(entry: CacheEntry): Response {
  return new Response(entry.data.body, {
    status: entry.data.status,
    statusText: entry.data.statusText,
    headers: entry.data.headers
  });
}
