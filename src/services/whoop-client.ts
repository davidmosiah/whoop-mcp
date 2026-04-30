import { URL, URLSearchParams } from "node:url";
import { DEFAULT_LIMIT, MAX_WHOOP_LIMIT, WHOOP_API_BASE_URL, WHOOP_AUTH_URL, WHOOP_TOKEN_URL } from "../constants.js";
import type { WhoopCollection, WhoopConfig, WhoopTokenSet } from "../types.js";
import { TokenStore } from "./token-store.js";

export interface ListParams {
  start?: string;
  end?: string;
  limit?: number;
  next_token?: string;
  all_pages?: boolean;
  max_pages?: number;
}

export class WhoopClient {
  private readonly tokenStore: TokenStore;

  constructor(private readonly config: WhoopConfig) {
    this.tokenStore = new TokenStore(config.tokenPath);
  }

  authUrl(state?: string, scopes?: string[]): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: (scopes?.length ? scopes : this.config.scopes).join(" ")
    });
    if (state) params.set("state", state);
    return `${WHOOP_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(input: string): Promise<{ ok: true; token_path: string; scope?: string; expires_at?: number }> {
    const code = this.extractCode(input);
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const tokens = await this.requestTokens(body);
    await this.tokenStore.withLock(async () => this.tokenStore.write(tokens));
    return { ok: true, token_path: this.config.tokenPath, scope: tokens.scope, expires_at: tokens.expires_at };
  }

  async get(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    return this.request("GET", path, undefined, params);
  }

  async list(path: string, params: ListParams = {}): Promise<{ records: unknown[]; next_token?: string; pages_fetched: number }> {
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_WHOOP_LIMIT);
    const maxPages = params.all_pages ? Math.max(1, params.max_pages ?? 1) : 1;
    let nextToken = params.next_token;
    const records: unknown[] = [];
    let pages = 0;

    while (pages < maxPages) {
      const page = await this.get(path, {
        start: params.start,
        end: params.end,
        limit,
        nextToken
      }) as WhoopCollection;
      const pageRecords = Array.isArray(page.records) ? page.records : [];
      records.push(...pageRecords);
      pages += 1;
      nextToken = page.next_token ?? page.nextToken;
      if (!params.all_pages || !nextToken) break;
    }

    return { records, next_token: nextToken, pages_fetched: pages };
  }

  private extractCode(input: string): string {
    try {
      const url = new URL(input);
      const code = url.searchParams.get("code");
      if (code) return code;
    } catch {
      // Not a URL; treat as raw code.
    }
    return input;
  }

  private async request(method: "GET" | "DELETE", path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    const token = await this.getValidToken();
    const response = await this.fetchWithRetry(this.buildUrl(path, params), {
      method,
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: "application/json",
        "User-Agent": "whoop-mcp-server/0.1.0"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 401) {
      const refreshed = await this.refreshToken(true);
      const retry = await this.fetchWithRetry(this.buildUrl(path, params), {
        method,
        headers: {
          Authorization: `Bearer ${refreshed.access_token}`,
          Accept: "application/json",
          "User-Agent": "whoop-mcp-server/0.1.0"
        },
        body: body ? JSON.stringify(body) : undefined
      });
      return this.parseResponse(retry);
    }

    return this.parseResponse(response);
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${WHOOP_API_BASE_URL}${cleanPath}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async getValidToken(): Promise<WhoopTokenSet> {
    const tokens = await this.tokenStore.read();
    if (!tokens?.access_token) {
      throw new Error("WHOOP token not found. Run whoop_get_auth_url, authorize the app, then run whoop_exchange_code.");
    }
    const expiresAt = tokens.expires_at ?? 0;
    const shouldRefresh = Boolean(tokens.refresh_token && expiresAt && expiresAt - Math.floor(Date.now() / 1000) < 120);
    return shouldRefresh ? this.refreshToken(false) : tokens;
  }

  private async refreshToken(force: boolean): Promise<WhoopTokenSet> {
    return this.tokenStore.withLock(async () => {
      const current = await this.tokenStore.read();
      if (!current?.refresh_token) {
        throw new Error("WHOOP refresh token not found. Re-authorize with whoop_get_auth_url and whoop_exchange_code.");
      }
      if (!force && current.expires_at && current.expires_at - Math.floor(Date.now() / 1000) >= 120) {
        return current;
      }

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: current.refresh_token,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });
      const refreshed = await this.requestTokens(body);
      await this.tokenStore.write({ ...current, ...refreshed });
      return { ...current, ...refreshed };
    });
  }

  private async requestTokens(body: URLSearchParams): Promise<WhoopTokenSet> {
    const response = await this.fetchWithRetry(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "whoop-mcp-server/0.1.0"
      },
      body: body.toString()
    });
    const data = await this.parseResponse(response) as Record<string, unknown>;
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : undefined;
    return {
      access_token: String(data.access_token ?? ""),
      refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
      token_type: typeof data.token_type === "string" ? data.token_type : undefined,
      scope: typeof data.scope === "string" ? data.scope : undefined,
      expires_at: expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined
    };
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    const payload = text ? safeJson(text) : null;
    if (!response.ok) {
      const details = payload && typeof payload === "object" ? JSON.stringify(payload) : text;
      throw new Error(`WHOOP API HTTP ${response.status}: ${details || response.statusText}`);
    }
    return payload ?? {};
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, init);
      if (response.status !== 429 && response.status < 500) return response;
      if (attempt === 2) return response;
      const retryAfter = response.headers.get("retry-after") ?? response.headers.get("x-ratelimit-reset");
      const delaySeconds = retryAfter ? Math.min(Math.max(Number(retryAfter), 1), 60) : 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
    throw new Error("Unreachable retry loop state");
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
