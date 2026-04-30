import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PrivacyMode, WhoopTokenSet } from "../types.js";

type Env = Record<string, string | undefined>;

export interface ConnectionStatusOptions {
  env?: Env;
  homeDir?: string;
  nowMs?: number;
}

export interface ConnectionStatus extends Record<string, unknown> {
  ok: boolean;
  ready_for_whoop_api: boolean;
  node: {
    version: string;
    supported: boolean;
  };
  privacy_mode: PrivacyMode;
  required_env: Record<string, boolean>;
  missing_env: string[];
  redirect_uri?: string;
  automatic_auth_supported: boolean;
  token: {
    path: string;
    exists: boolean;
    readable: boolean;
    permissions?: string;
    secure_permissions?: boolean;
    expires_at?: number;
    expired?: boolean;
    has_refresh_token?: boolean;
    error?: string;
  };
  cache: {
    enabled: boolean;
    path: string;
  };
  next_steps: string[];
}

const REQUIRED_ENV = ["WHOOP_CLIENT_ID", "WHOOP_CLIENT_SECRET", "WHOOP_REDIRECT_URI"];

export async function buildConnectionStatus(options: ConnectionStatusOptions = {}): Promise<ConnectionStatus> {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? homedir();
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const tokenPath = cleanEnv(env, "WHOOP_TOKEN_PATH") ?? join(homeDir, ".whoop-mcp", "tokens.json");
  const cachePath = cleanEnv(env, "WHOOP_CACHE_PATH") ?? join(homeDir, ".whoop-mcp", "cache.sqlite");
  const redirectUri = cleanEnv(env, "WHOOP_REDIRECT_URI");
  const requiredEnv = Object.fromEntries(REQUIRED_ENV.map((name) => [name, Boolean(cleanEnv(env, name))]));
  const missingEnv = REQUIRED_ENV.filter((name) => !requiredEnv[name]);
  const token = await inspectToken(tokenPath, nowSeconds);
  const nodeSupported = Number(process.versions.node.split(".")[0] ?? 0) >= 20;
  const automaticAuthSupported = Boolean(redirectUri && isLocalHttpRedirect(redirectUri));
  const tokenUsable = token.exists && token.readable && token.secure_permissions !== false && (token.expired !== true || token.has_refresh_token === true);
  const ready = missingEnv.length === 0 && tokenUsable;
  const ok = ready && nodeSupported;

  return {
    ok,
    ready_for_whoop_api: ready,
    node: {
      version: process.versions.node,
      supported: nodeSupported
    },
    privacy_mode: parsePrivacyMode(cleanEnv(env, "WHOOP_PRIVACY_MODE")),
    required_env: requiredEnv,
    missing_env: missingEnv,
    redirect_uri: redirectUri,
    automatic_auth_supported: automaticAuthSupported,
    token,
    cache: {
      enabled: parseBool(cleanEnv(env, "WHOOP_CACHE")),
      path: cachePath
    },
    next_steps: buildNextSteps({ missingEnv, token, nodeSupported, automaticAuthSupported, redirectUri })
  };
}

function cleanEnv(env: Env, name: string): string | undefined {
  const value = env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function parsePrivacyMode(value: string | undefined): PrivacyMode {
  if (value === "summary" || value === "structured" || value === "raw") return value;
  return "structured";
}

function parseBool(value: string | undefined): boolean {
  return Boolean(value && ["1", "true", "yes", "on", "sqlite"].includes(value.toLowerCase()));
}

function isLocalHttpRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname) && Boolean(url.port);
  } catch {
    return false;
  }
}

async function inspectToken(path: string, nowSeconds: number): Promise<ConnectionStatus["token"]> {
  try {
    const [stat, text] = await Promise.all([fs.stat(path), fs.readFile(path, "utf8")]);
    const permissions = (stat.mode & 0o777).toString(8).padStart(3, "0");
    const securePermissions = process.platform === "win32" ? true : (stat.mode & 0o077) === 0;
    const token = JSON.parse(text) as Partial<WhoopTokenSet>;
    const expiresAt = typeof token.expires_at === "number" ? token.expires_at : undefined;
    return {
      path,
      exists: true,
      readable: true,
      permissions,
      secure_permissions: securePermissions,
      expires_at: expiresAt,
      expired: expiresAt ? expiresAt <= nowSeconds : undefined,
      has_refresh_token: typeof token.refresh_token === "string" && token.refresh_token.length > 0
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { path, exists: false, readable: false };
    return { path, exists: true, readable: false, error: (error as Error).message };
  }
}

function buildNextSteps(input: {
  missingEnv: string[];
  token: ConnectionStatus["token"];
  nodeSupported: boolean;
  automaticAuthSupported: boolean;
  redirectUri?: string;
}): string[] {
  const steps: string[] = [];
  if (!input.nodeSupported) steps.push("Install Node.js 20 or newer.");
  for (const name of input.missingEnv) {
    steps.push(`Set ${name}. Create a WHOOP OAuth app in the WHOOP Developer Dashboard if needed.`);
  }
  if (input.redirectUri && !input.automaticAuthSupported) {
    steps.push("For one-command auth, set WHOOP_REDIRECT_URI to a local callback such as http://127.0.0.1:3000/callback.");
  }
  if (!input.token.exists) {
    steps.push("Run `whoop-mcp-server auth` to authorize WHOOP and save local tokens.");
  } else if (!input.token.readable) {
    steps.push(`Fix token file readability at ${input.token.path}.`);
  } else if (input.token.secure_permissions === false) {
    steps.push(`Restrict token file permissions with: chmod 600 ${input.token.path}`);
  } else if (input.token.expired && !input.token.has_refresh_token) {
    steps.push("Re-authorize with `whoop-mcp-server auth`; the current token is expired and has no refresh token.");
  }
  if (steps.length === 0) steps.push("Ready. Add this MCP server to your agent and start with whoop_daily_summary.");
  return steps;
}
