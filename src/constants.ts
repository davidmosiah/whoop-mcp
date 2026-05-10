export const SERVER_NAME = "whoop-mcp-server";
export const SERVER_VERSION = "0.3.0";
export const NPM_PACKAGE_NAME = "whoop-mcp-unofficial";
export const PINNED_NPM_PACKAGE = `${NPM_PACKAGE_NAME}@${SERVER_VERSION}`;

export const WHOOP_API_BASE_URL = "https://api.prod.whoop.com/developer";
export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

export const DEFAULT_SCOPES = [
  "read:recovery",
  "read:cycles",
  "read:workout",
  "read:sleep",
  "read:profile",
  "read:body_measurement"
];

export const DEFAULT_LIMIT = 10;
export const MAX_WHOOP_LIMIT = 25;
export const DEFAULT_MAX_PAGES = 1;
export const MAX_PAGES = 20;
