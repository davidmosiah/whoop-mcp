import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SCOPES } from "../constants.js";
import type { PrivacyMode, WhoopConfig } from "../types.js";
import { loadConfigSources } from "./local-config.js";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function getConfig(): WhoopConfig {
  const sources = loadConfigSources(process.env, homedir());
  const value = (name: keyof typeof sources.values) => env(name) ?? sources.values[name];
  const clientId = value("WHOOP_CLIENT_ID");
  const clientSecret = value("WHOOP_CLIENT_SECRET");
  const redirectUri = value("WHOOP_REDIRECT_URI");
  const tokenPath = value("WHOOP_TOKEN_PATH") ?? join(homedir(), ".whoop-mcp", "tokens.json");
  const cachePath = value("WHOOP_CACHE_PATH") ?? join(homedir(), ".whoop-mcp", "cache.sqlite");
  const scopes = (value("WHOOP_SCOPES")?.split(/[ ,]+/).filter(Boolean)) ?? DEFAULT_SCOPES;
  const privacyMode = parsePrivacyMode(value("WHOOP_PRIVACY_MODE"));
  const cacheEnabled = parseBool(value("WHOOP_CACHE"), false);

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
