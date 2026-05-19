// HTTP retry middleware for the WHOOP client.
//
// Wraps a Response-returning fetch call with bounded exponential backoff,
// jitter, and Retry-After header support. Designed to be drop-in around any
// `fetch(url, init)` call. No new npm dependencies — Node built-ins only.

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export interface RetryOptions {
  vendor: string;                  // e.g. "whoop" — used for stderr log prefix
  envFlag: string;                 // e.g. "WHOOP_NO_RETRY" — env var to disable
  maxAttempts?: number;            // total attempts incl. first try (default 3)
  baseDelayMs?: number;            // first backoff step (default 500ms)
  maxDelayMs?: number;             // cap individual backoff (default 30_000ms)
  jitterRatio?: number;            // +/- jitter fraction (default 0.2)
  logger?: (message: string) => void; // override for tests; defaults to stderr
  sleeper?: (ms: number) => Promise<void>; // override for tests
  now?: () => number;              // override for Retry-After HTTP-date parsing
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export async function fetchWithRetry(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit | undefined,
  options: RetryOptions
): Promise<Response> {
  const max = Math.max(1, options.maxAttempts ?? 3);
  const base = options.baseDelayMs ?? 500;
  const cap = options.maxDelayMs ?? 30_000;
  const jitter = Math.max(0, Math.min(0.95, options.jitterRatio ?? 0.2));
  const log = options.logger ?? ((m) => { process.stderr.write(`${m}\n`); });
  const sleep = options.sleeper ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? (() => Date.now());

  if (process.env[options.envFlag] === "true") {
    return fetchFn(url, init);
  }

  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= max; attempt += 1) {
    let response: Response | undefined;
    let networkError: unknown;
    try {
      response = await fetchFn(url, init);
    } catch (error) {
      networkError = error;
    }

    if (response && !RETRYABLE_STATUS.has(response.status)) {
      return response;
    }

    if (attempt === max) {
      if (response) return response;
      throw networkError ?? new Error("fetchWithRetry: unknown failure");
    }

    const reason = response
      ? `status=${response.status}`
      : `error=${(networkError instanceof Error ? networkError.message : String(networkError))}`;
    const retryAfter = response ? parseRetryAfter(response.headers.get("retry-after"), now()) : undefined;
    const backoff = computeBackoff(attempt, base, cap, jitter, retryAfter);
    log(`[${options.vendor}-mcp] retry ${attempt}/${max} after ${backoff}ms (${reason})`);
    lastResponse = response;
    lastError = networkError;
    await sleep(backoff);
  }

  if (lastResponse) return lastResponse;
  throw lastError ?? new Error("fetchWithRetry: exhausted retries");
}

function computeBackoff(
  attempt: number,
  base: number,
  cap: number,
  jitterRatio: number,
  retryAfterMs: number | undefined
): number {
  if (retryAfterMs !== undefined) {
    return Math.min(Math.max(retryAfterMs, 0), cap);
  }
  // attempt is 1-based; first retry uses base * 2^0 = base
  const raw = base * 2 ** (attempt - 1);
  const bounded = Math.min(raw, cap);
  const jitter = bounded * jitterRatio;
  const delta = (Math.random() * 2 - 1) * jitter;
  return Math.max(0, Math.round(bounded + delta));
}

function parseRetryAfter(value: string | null, nowMs: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const target = Date.parse(value);
  if (!Number.isNaN(target)) {
    return Math.max(0, target - nowMs);
  }
  return undefined;
}
