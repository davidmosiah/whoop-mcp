import { homedir } from "node:os";
import { join } from "node:path";
import { SERVER_NAME } from "../constants.js";
import type { PrivacyMode } from "../types.js";
import { REDACTED_KEY_PATTERNS } from "./redaction.js";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function parsePrivacyMode(value: string | undefined): PrivacyMode {
  if (value === "summary" || value === "structured" || value === "raw") return value;
  return "structured";
}

function parseBool(value: string | undefined): boolean {
  return Boolean(value && ["1", "true", "yes", "on", "sqlite"].includes(value.toLowerCase()));
}

export function buildPrivacyAudit(): Record<string, unknown> {
  const requiredEnv = ["WHOOP_CLIENT_ID", "WHOOP_CLIENT_SECRET", "WHOOP_REDIRECT_URI"];
  return {
    project: SERVER_NAME,
    unofficial: true,
    privacy_mode_default: parsePrivacyMode(env("WHOOP_PRIVACY_MODE")),
    raw_payloads_opt_in: true,
    cache_enabled: parseBool(env("WHOOP_CACHE")),
    cache_path: env("WHOOP_CACHE_PATH") ?? join(homedir(), ".whoop-mcp", "cache.sqlite"),
    token_path: env("WHOOP_TOKEN_PATH") ?? join(homedir(), ".whoop-mcp", "tokens.json"),
    stdout_safe: true,
    secret_env_vars: ["WHOOP_CLIENT_SECRET"],
    required_env_present: Object.fromEntries(requiredEnv.map((name) => [name, Boolean(env(name))])),
    redacted_key_patterns: REDACTED_KEY_PATTERNS,
    notes: [
      "This is an unofficial WHOOP integration.",
      "OAuth tokens are stored locally and are not returned by tools.",
      "Raw WHOOP payloads require WHOOP_PRIVACY_MODE=raw or privacy_mode=raw.",
      "Errors are redacted before returning to MCP clients.",
      "stdio transport logs to stderr to avoid corrupting JSON-RPC."
    ]
  };
}
