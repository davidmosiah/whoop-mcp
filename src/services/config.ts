import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SCOPES } from "../constants.js";
import type { PrivacyMode, WhoopConfig } from "../types.js";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function getConfig(): WhoopConfig {
  const clientId = env("WHOOP_CLIENT_ID");
  const clientSecret = env("WHOOP_CLIENT_SECRET");
  const redirectUri = env("WHOOP_REDIRECT_URI");
  const tokenPath = env("WHOOP_TOKEN_PATH") ?? join(homedir(), ".whoop-mcp", "tokens.json");
  const cachePath = env("WHOOP_CACHE_PATH") ?? join(homedir(), ".whoop-mcp", "cache.sqlite");
  const scopes = (env("WHOOP_SCOPES")?.split(/[ ,]+/).filter(Boolean)) ?? DEFAULT_SCOPES;
  const privacyMode = parsePrivacyMode(env("WHOOP_PRIVACY_MODE"));
  const cacheEnabled = parseBool(env("WHOOP_CACHE"), false);

  const missing = [
    ["WHOOP_CLIENT_ID", clientId],
    ["WHOOP_CLIENT_SECRET", clientSecret],
    ["WHOOP_REDIRECT_URI", redirectUri]
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing required WHOOP environment variables: ${missing.join(", ")}. ` +
      "Create an OAuth app in the WHOOP Developer Dashboard and set these variables before using WHOOP tools."
    );
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    scopes,
    tokenPath,
    privacyMode,
    cacheEnabled,
    cachePath
  };
}

function parsePrivacyMode(value: string | undefined): PrivacyMode {
  if (value === "summary" || value === "structured" || value === "raw") return value;
  return "structured";
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "on", "sqlite"].includes(value.toLowerCase());
}
