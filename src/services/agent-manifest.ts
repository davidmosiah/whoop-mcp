import { DEFAULT_SCOPES, NPM_PACKAGE_NAME, PINNED_NPM_PACKAGE, SERVER_VERSION } from "../constants.js";

export const AGENT_CLIENTS = ["generic", "claude", "cursor", "windsurf", "hermes", "openclaw"] as const;
export type AgentClientName = typeof AGENT_CLIENTS[number];

export const HERMES_DIRECT_TOOLS = [
  "mcp_whoop_whoop_agent_manifest",
  "mcp_whoop_whoop_connection_status",
  "mcp_whoop_whoop_daily_summary",
  "mcp_whoop_whoop_weekly_summary",
  "mcp_whoop_whoop_list_recoveries",
  "mcp_whoop_whoop_list_sleeps",
  "mcp_whoop_whoop_list_cycles"
];

const STANDARD_TOOLS = [
  "whoop_agent_manifest",
  "whoop_capabilities",
  "whoop_connection_status",
  "whoop_get_auth_url",
  "whoop_exchange_code",
  "whoop_get_profile",
  "whoop_get_body_measurements",
  "whoop_list_cycles",
  "whoop_list_recoveries",
  "whoop_list_sleeps",
  "whoop_list_workouts",
  "whoop_get_cycle",
  "whoop_get_sleep",
  "whoop_get_workout",
  "whoop_get_cycle_sleep",
  "whoop_get_cycle_recovery",
  "whoop_daily_summary",
  "whoop_weekly_summary",
  "whoop_privacy_audit",
  "whoop_cache_status",
  "whoop_revoke_access"
];

const RESOURCES = [
  "whoop://agent-manifest",
  "whoop://capabilities",
  "whoop://latest/recovery",
  "whoop://latest/sleep",
  "whoop://latest/cycle",
  "whoop://summary/daily",
  "whoop://summary/weekly"
];

export function parseAgentClientName(value: string): AgentClientName {
  return AGENT_CLIENTS.includes(value as AgentClientName) ? value as AgentClientName : "generic";
}

export function buildAgentManifest(client: AgentClientName = "generic") {
  return {
    project: "whoop-mcp-unofficial",
    mcp_name: "io.github.davidmosiah/whoop-mcp",
    client,
    unofficial: true,
    package: {
      name: NPM_PACKAGE_NAME,
      version: SERVER_VERSION,
      install_command: `npx -y ${NPM_PACKAGE_NAME}`,
      pinned_install_command: `npx -y ${PINNED_NPM_PACKAGE}`,
      binary: "whoop-mcp-server"
    },
    oauth: {
      provider: "WHOOP Developer API",
      redirect_uri: "http://127.0.0.1:3000/callback",
      scopes: DEFAULT_SCOPES,
      token_storage: "~/.whoop-mcp/tokens.json with 0600 permissions",
      secret_storage: "~/.whoop-mcp/config.json or WHOOP_* environment variables; never print secrets"
    },
    recommended_first_calls: ["whoop_connection_status", "whoop_daily_summary", "whoop_weekly_summary"],
    standard_tools: STANDARD_TOOLS,
    resources: RESOURCES,
    hermes: {
      config_path: "~/.hermes/config.yaml",
      skill_path: "~/.hermes/skills/whoop-mcp/SKILL.md",
      tool_name_prefix: "mcp_whoop_",
      common_tool_names: HERMES_DIRECT_TOOLS,
      recommended_config: hermesConfigSnippet(),
      use_direct_tools: true,
      avoid_terminal_workarounds: true,
      no_gateway_restart_for_data_access: true,
      reload_after_config_change: "/reload-mcp or hermes mcp test whoop",
      doctor_command: "npx -y whoop-mcp-unofficial doctor --client hermes --json"
    },
    agent_rules: [
      "Call whoop_connection_status before WHOOP data tools.",
      "If setup is incomplete, guide the user through setup, auth and doctor instead of guessing token state.",
      "Treat WHOOP health data as sensitive. Do not expose raw payloads unless the user asks for raw mode.",
      "Raw mode means upstream WHOOP API JSON, not continuous sensor streams or Bluetooth data.",
      "For Hermes, do not restart the gateway for normal WHOOP data access; reload MCP instead.",
      "Do not provide medical diagnosis or treatment instructions. Frame outputs as recovery, sleep and training context."
    ],
    troubleshooting: [
      { symptom: "missing WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET / WHOOP_REDIRECT_URI", action: "Run `whoop-mcp-server setup` or set WHOOP_* env vars." },
      { symptom: "401 or expired token", action: "Run `whoop-mcp-server auth` again; tokens refresh automatically when refresh_token is present." },
      { symptom: "WHOOP endpoint forbidden", action: "Re-authorize with the default read scopes and confirm the WHOOP Developer app redirect URI." },
      { symptom: "agent asks for continuous sensor samples", action: "Explain that the official WHOOP API does not expose high-frequency device streams." },
      { symptom: "Hermes configured but tools unavailable", action: "Run `/reload-mcp` or `hermes mcp test whoop`; do not restart gateway for normal reload." }
    ],
    links: {
      github: "https://github.com/davidmosiah/whoop-mcp",
      docs: "https://whoopmcp.vercel.app/",
      npm: "https://www.npmjs.com/package/whoop-mcp-unofficial",
      whoop_api_docs: "https://developer.whoop.com/api/"
    }
  };
}

export function formatAgentManifestMarkdown(manifest: ReturnType<typeof buildAgentManifest>): string {
  return `# WHOOP MCP Agent Manifest

Unofficial: ${manifest.unofficial}
Package: \`${manifest.package.name}\` v${manifest.package.version}
Install: \`${manifest.package.install_command}\`
Pinned install: \`${manifest.package.pinned_install_command}\`

## OAuth
Provider: ${manifest.oauth.provider}
Redirect URI: \`${manifest.oauth.redirect_uri}\`
Scopes: \`${manifest.oauth.scopes.join(" ")}\`
Tokens: ${manifest.oauth.token_storage}

## First Calls
${manifest.recommended_first_calls.map((tool) => `- \`${tool}\``).join("\n")}

## Hermes
Config: \`${manifest.hermes.config_path}\`
Skill: \`${manifest.hermes.skill_path}\`
Reload: \`${manifest.hermes.reload_after_config_change}\`
Direct tools:
${manifest.hermes.common_tool_names.map((tool) => `- \`${tool}\``).join("\n")}

## Agent Rules
${manifest.agent_rules.map((rule) => `- ${rule}`).join("\n")}
`;
}

export function hermesConfigSnippet(): string {
  return `mcp_servers:\n  whoop:\n    command: npx\n    args:\n      - -y\n      - ${PINNED_NPM_PACKAGE}`;
}

export function hermesSkillMarkdown(): string {
  return `# WHOOP MCP Skill

Use this skill whenever a user asks Hermes to inspect WHOOP recovery, sleep, strain, workout, daily summary or weekly summary data through the WHOOP MCP.

## Rules
- Start with \`mcp_whoop_whoop_connection_status\`.
- Prefer \`mcp_whoop_whoop_daily_summary\` and \`mcp_whoop_whoop_weekly_summary\` before low-level endpoint calls.
- Treat WHOOP data as sensitive. Do not request raw payloads unless the user explicitly asks.
- Raw WHOOP data means official API JSON, not continuous sensor streams or Bluetooth collection.
- Do not diagnose or treat medical conditions.
- Reload MCP with \`/reload-mcp\` or \`hermes mcp test whoop\`; do not restart the gateway for normal data access.
`;
}
