import { buildConnectionStatus } from "../services/connection-status.js";
import { SERVER_VERSION } from "../constants.js";
import { parseAgentClientName } from "../services/agent-manifest.js";
import { runAuthCommand } from "./auth.js";
import { runSetupCommand } from "./setup.js";

export async function runCliCommand(args: string[]): Promise<number | undefined> {
  const [command, ...rest] = args;
  if (!command || command === "--http") return undefined;
  if (command === "setup") return runSetupCommand(rest);
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
  const options = parseDoctorOptions(args);
  const status = await buildConnectionStatus({ client: options.client });
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    printDoctor(status);
  }
  return options.strict && !status.ok ? 1 : 0;
}

function parseDoctorOptions(args: string[]) {
  let client: ReturnType<typeof parseAgentClientName> | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--client") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --client.");
      client = parseAgentClientName(value);
      index += 1;
    }
  }
  return {
    json: args.includes("--json"),
    strict: args.includes("--strict"),
    client
  };
}

function printDoctor(status: Awaited<ReturnType<typeof buildConnectionStatus>>): void {
  console.log("WHOOP MCP Doctor");
  console.log(`Status: ${status.ok ? "ready" : "needs setup"}`);
  if (status.client) console.log(`Client: ${status.client}`);
  console.log("");
  console.log("Checks:");
  console.log(`- Node.js >=20: ${status.node.supported ? "ok" : `needs update (${status.node.version})`}`);
  console.log(`- WHOOP env vars: ${status.missing_env.length === 0 ? "ok" : `missing ${status.missing_env.join(", ")}`}`);
  console.log(`- Local config: ${status.config.exists ? `${status.config.source} at ${status.config.path}` : "missing"}`);
  console.log(`- Automatic auth redirect: ${status.automatic_auth_supported ? "ok" : "not configured for local callback"}`);
  console.log(`- Token file: ${status.token.exists ? status.token.path : "missing"}`);
  if (status.token.exists) {
    console.log(`- Token permissions: ${status.token.secure_permissions === false ? "insecure" : "ok"}`);
    console.log(`- Refresh token: ${status.token.has_refresh_token ? "present" : "missing"}`);
  }
  console.log(`- Privacy mode: ${status.privacy_mode}`);
  console.log(`- Cache: ${status.cache.enabled ? `enabled at ${status.cache.path}` : "disabled"}`);
  if (status.client_checks?.hermes) {
    const hermes = status.client_checks.hermes;
    console.log("- Hermes config:");
    console.log(`  path: ${hermes.config_path}`);
    console.log(`  configured: ${hermes.whoop_server_configured ? "ok" : "missing"}`);
    console.log(`  pinned package: ${hermes.package_pinned ? "ok" : "missing"}`);
    console.log(`  skill: ${hermes.skill_installed ? hermes.skill_path : "missing"}`);
    console.log(`  direct tool prefix: ${hermes.direct_tool_prefix}`);
  }
  console.log("");
  console.log("Next steps:");
  status.next_steps.forEach((step, index) => console.log(`${index + 1}. ${step}`));
  if (status.client_checks?.hermes?.recommendations.length) {
    console.log("");
    console.log("Hermes recommendations:");
    status.client_checks.hermes.recommendations.forEach((step, index) => console.log(`${index + 1}. ${step}`));
  }
}

function printHelp(): void {
  console.log(`WHOOP MCP Server

Usage:
  whoop-mcp-server                 Start MCP stdio server
  whoop-mcp-server --http          Start local HTTP MCP server
  whoop-mcp-server setup           Guided setup, local config, and MCP client config
  whoop-mcp-server doctor          Check setup and next steps
  whoop-mcp-server doctor --json   Print setup status as JSON
  whoop-mcp-server doctor --client hermes
  whoop-mcp-server auth            Authorize WHOOP with local browser callback
  whoop-mcp-server auth --no-open  Print auth URL without opening browser

Required env:
  WHOOP_CLIENT_ID
  WHOOP_CLIENT_SECRET
  WHOOP_REDIRECT_URI=http://127.0.0.1:3000/callback
`);
}
