import { buildConnectionStatus } from "../services/connection-status.js";
import { SERVER_VERSION } from "../constants.js";
import { runAuthCommand } from "./auth.js";

export async function runCliCommand(args: string[]): Promise<number | undefined> {
  const [command, ...rest] = args;
  if (!command || command === "--http") return undefined;
  if (command === "doctor" || command === "status") return runDoctor(rest);
  if (command === "auth") return runAuthCommand(rest);
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(SERVER_VERSION);
    return 0;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }
  if (!command.startsWith("--")) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }
  return undefined;
}

async function runDoctor(args: string[]): Promise<number> {
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const status = await buildConnectionStatus();
  if (json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    printDoctor(status);
  }
  return strict && !status.ok ? 1 : 0;
}

function printDoctor(status: Awaited<ReturnType<typeof buildConnectionStatus>>): void {
  console.log("WHOOP MCP Doctor");
  console.log(`Status: ${status.ok ? "ready" : "needs setup"}`);
  console.log("");
  console.log("Checks:");
  console.log(`- Node.js >=20: ${status.node.supported ? "ok" : `needs update (${status.node.version})`}`);
  console.log(`- WHOOP env vars: ${status.missing_env.length === 0 ? "ok" : `missing ${status.missing_env.join(", ")}`}`);
  console.log(`- Automatic auth redirect: ${status.automatic_auth_supported ? "ok" : "not configured for local callback"}`);
  console.log(`- Token file: ${status.token.exists ? status.token.path : "missing"}`);
  if (status.token.exists) {
    console.log(`- Token permissions: ${status.token.secure_permissions === false ? "insecure" : "ok"}`);
    console.log(`- Refresh token: ${status.token.has_refresh_token ? "present" : "missing"}`);
  }
  console.log(`- Privacy mode: ${status.privacy_mode}`);
  console.log(`- Cache: ${status.cache.enabled ? `enabled at ${status.cache.path}` : "disabled"}`);
  console.log("");
  console.log("Next steps:");
  status.next_steps.forEach((step, index) => console.log(`${index + 1}. ${step}`));
}

function printHelp(): void {
  console.log(`WHOOP MCP Server

Usage:
  whoop-mcp-server                 Start MCP stdio server
  whoop-mcp-server --http          Start local HTTP MCP server
  whoop-mcp-server doctor          Check setup and next steps
  whoop-mcp-server doctor --json   Print setup status as JSON
  whoop-mcp-server auth            Authorize WHOOP with local browser callback
  whoop-mcp-server auth --no-open  Print auth URL without opening browser

Required env:
  WHOOP_CLIENT_ID
  WHOOP_CLIENT_SECRET
  WHOOP_REDIRECT_URI=http://127.0.0.1:3000/callback
`);
}
