import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PINNED_NPM_PACKAGE } from "../constants.js";
import type { PrivacyMode, WhoopTokenSet } from "../types.js";
import { HERMES_DIRECT_TOOLS, type AgentClientName } from "./agent-manifest.js";
import { loadConfigSources } from "./local-config.js";

type Env = Record<string, string | undefined>;

export interface ConnectionStatusOptions {
  env?: Env;
  homeDir?: string;
  nowMs?: number;
  client?: AgentClientName;
}

export interface ConnectionStatus extends Record<string, unknown> {
  ok: boolean;
  ready_for_whoop_api: boolean;
  client?: AgentClientName;
  node: {
    version: string;
    supported: boolean;
  };
  privacy_mode: PrivacyMode;
  required_env: Record<string, boolean>;
  missing_env: string[];
  redirect_uri?: string;
  automatic_auth_supported: boolean;
  config: {
    source: "env" | "local_config" | "mixed" | "missing";
    path: string;
    exists: boolean;
    secure_permissions?: boolean;
    error?: string;
  };
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
  client_checks?: {
    hermes?: HermesClientCheck;
  };
  next_steps: string[];
}

export interface HermesClientCheck {
  config_path: string;
  config_exists: boolean;
  whoop_server_configured: boolean;
  package_pinned: boolean;
  mcp_reload_confirmation_disabled?: boolean;
  skill_path: string;
  skill_installed: boolean;
  direct_tool_prefix: string;
  expected_direct_tools: string[];
  recommendations: string[];
  error?: string;
}

const REQUIRED_ENV = ["WHOOP_CLIENT_ID", "WHOOP_CLIENT_SECRET", "WHOOP_REDIRECT_URI"];

export async function buildConnectionStatus(options: ConnectionStatusOptions = {}): Promise<ConnectionStatus> {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? homedir();
  const sources = loadConfigSources(env, homeDir);
  const value = (name: keyof typeof sources.values) => sources.values[name];
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const tokenPath = value("WHOOP_TOKEN_PATH") ?? join(homeDir, ".whoop-mcp", "tokens.json");
  const cachePath = value("WHOOP_CACHE_PATH") ?? join(homeDir, ".whoop-mcp", "cache.sqlite");
  const redirectUri = value("WHOOP_REDIRECT_URI");
  const requiredEnv = Object.fromEntries(REQUIRED_ENV.map((name) => [name, Boolean(value(name as keyof typeof sources.values))]));
  const missingEnv = REQUIRED_ENV.filter((name) => !requiredEnv[name]);
  const token = await inspectToken(tokenPath, nowSeconds);
  const nodeSupported = Number(process.versions.node.split(".")[0] ?? 0) >= 20;
  const automaticAuthSupported = Boolean(redirectUri && isLocalHttpRedirect(redirectUri));
  const tokenUsable = token.exists && token.readable && token.secure_permissions !== false && (token.expired !== true || token.has_refresh_token === true);
  const ready = missingEnv.length === 0 && tokenUsable;
  const ok = ready && nodeSupported;
  const clientChecks = options.client === "hermes" ? { hermes: await inspectHermesClient(homeDir) } : undefined;

  return {
    ok,
    ready_for_whoop_api: ready,
    client: options.client,
    node: {
      version: process.versions.node,
      supported: nodeSupported
    },
    privacy_mode: parsePrivacyMode(value("WHOOP_PRIVACY_MODE")),
    required_env: requiredEnv,
    missing_env: missingEnv,
    redirect_uri: redirectUri,
    automatic_auth_supported: automaticAuthSupported,
    config: {
      source: sources.source,
      path: sources.local.path,
      exists: sources.local.exists,
      secure_permissions: sources.local.secure_permissions,
      error: sources.local.error
    },
    token,
    cache: {
      enabled: parseBool(value("WHOOP_CACHE")),
      path: cachePath
    },
    client_checks: clientChecks,
    next_steps: buildNextSteps({ missingEnv, token, nodeSupported, automaticAuthSupported, redirectUri })
  };
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

async function inspectHermesClient(homeDir: string): Promise<HermesClientCheck> {
  const configPath = join(homeDir, ".hermes", "config.yaml");
  const skillPath = join(homeDir, ".hermes", "skills", "whoop-mcp", "SKILL.md");
  const base: Omit<HermesClientCheck, "recommendations"> = {
    config_path: configPath,
    config_exists: false,
    whoop_server_configured: false,
    package_pinned: false,
    skill_path: skillPath,
    skill_installed: false,
    direct_tool_prefix: "mcp_whoop_",
    expected_direct_tools: HERMES_DIRECT_TOOLS
  };

  try {
    const [config, skillExists] = await Promise.all([
      readOptionalText(configPath),
      existsFile(skillPath)
    ]);
    const configText = config.text ?? "";
    const check = {
      ...base,
      config_exists: config.exists,
      whoop_server_configured: /whoop-mcp-unofficial|whoop-mcp-server|whoop-mcp/.test(configText) && /^\s*whoop\s*:/m.test(configText),
      package_pinned: /whoop-mcp-unofficial@\d+\.\d+\.\d+/.test(configText),
      mcp_reload_confirmation_disabled: config.exists ? /mcp_reload_confirm\s*:\s*false/.test(configText) : undefined,
      skill_installed: skillExists
    };
    return { ...check, recommendations: buildHermesRecommendations(check) };
  } catch (error) {
    const check = { ...base, error: (error as Error).message };
    return { ...check, recommendations: buildHermesRecommendations(check) };
  }
}

async function readOptionalText(path: string): Promise<{ exists: boolean; text?: string }> {
  try {
    return { exists: true, text: await fs.readFile(path, "utf8") };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false };
    throw error;
  }
}

async function existsFile(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path);
    return stat.isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function buildHermesRecommendations(check: Omit<HermesClientCheck, "recommendations">): string[] {
  const recommendations: string[] = [];
  if (!check.config_exists) {
    recommendations.push("Run `whoop-mcp-server setup --client hermes --no-auth` to create a Hermes MCP config and local Hermes skill.");
  } else if (!check.whoop_server_configured) {
    recommendations.push("Add a `whoop` MCP server block to `~/.hermes/config.yaml`.");
  }
  if (check.config_exists && check.whoop_server_configured && !check.package_pinned) {
    recommendations.push(`Pin the Hermes MCP command to \`${PINNED_NPM_PACKAGE}\` to avoid stale npx cache surprises.`);
  }
  if (!check.skill_installed) {
    recommendations.push("Install the Hermes skill at `~/.hermes/skills/whoop-mcp/SKILL.md` so agents prefer direct MCP tools over terminal workarounds.");
  }
  if (check.config_exists && check.mcp_reload_confirmation_disabled !== true) {
    recommendations.push("Optional for lower friction: set `approvals.mcp_reload_confirm: false` if your Hermes policy allows MCP reload without confirmation.");
  }
  recommendations.push("After Hermes config changes, use `/reload-mcp` or `hermes mcp test whoop`; do not run `hermes gateway restart` for normal WHOOP data access.");
  return recommendations;
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
