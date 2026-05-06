import { buildCapabilities } from "./capabilities.js";

type SupportedDataCategory = {
  name: string;
  examples?: string[];
  tools?: string[];
};

type PrivacyModeDescription = {
  mode?: string;
  use_when?: string;
};

type CapabilityInventory = {
  project: string;
  mcp_name: string;
  unofficial?: boolean;
  api_boundary?: {
    source?: string;
    raw_definition?: string;
    does_not_include?: string[];
  };
  auth_model?: {
    type?: string;
    token_storage?: string;
    recommended_redirect_uri?: string;
    default_scopes?: string[];
  };
  auth?: {
    provider?: string;
    mode?: string;
    token_storage?: string;
    secret_storage?: string;
    caveat?: string;
  };
  privacy_modes?: PrivacyModeDescription[];
  supported_data?: SupportedDataCategory[];
  recommended_agent_flow?: string[];
  links?: Record<string, string>;
};

export function buildDataInventory() {
  const capabilities = buildCapabilities() as CapabilityInventory;
  const categories = (capabilities.supported_data ?? []).map((category) => ({
    name: category.name,
    examples: category.examples ?? [],
    tools: category.tools ?? []
  }));
  const tools = [...new Set(categories.flatMap((category) => category.tools))].sort();
  const scopes = capabilities.auth_model?.default_scopes ?? [];

  return {
    kind: "data_inventory",
    source: capabilities.project,
    mcp_name: capabilities.mcp_name,
    generated_at: new Date().toISOString(),
    unofficial: Boolean(capabilities.unofficial),
    data_access_model: capabilities.auth_model ? "oauth_api" : "local_or_unofficial_api",
    auth: capabilities.auth_model ?? capabilities.auth,
    scopes,
    api_boundary: capabilities.api_boundary,
    privacy_modes: capabilities.privacy_modes ?? [],
    categories,
    totals: {
      categories: categories.length,
      listed_tools: tools.length,
      scopes: scopes.length
    },
    first_tools: [
      ...new Set([
        tools.find((tool) => tool.endsWith("connection_status")),
        tools.find((tool) => tool.endsWith("daily_summary")),
        tools.find((tool) => tool.endsWith("weekly_summary")),
        ...tools.filter((tool) => tool.includes("context")).slice(0, 1)
      ].filter((tool): tool is string => Boolean(tool)))
    ],
    recommended_agent_flow: capabilities.recommended_agent_flow ?? [],
    links: capabilities.links ?? {},
    notes: [
      "This inventory is static MCP metadata and does not call WHOOP APIs.",
      "Call the connection status tool before live data tools to verify credentials and local token readiness.",
      "Use raw privacy mode only when the user explicitly requests upstream payloads."
    ]
  };
}

export function formatInventoryMarkdown(inventory: ReturnType<typeof buildDataInventory>): string {
  const categoryLines = inventory.categories.map((category) => "- **" + category.name + "**: " + (category.tools.join(", ") || "no direct tool listed"));
  return [
    "# WHOOP Data Inventory",
    "",
    "- **source**: " + inventory.source,
    "- **categories**: " + inventory.totals.categories,
    "- **listed_tools**: " + inventory.totals.listed_tools,
    "- **scopes**: " + (inventory.scopes.length ? inventory.scopes.join(", ") : "n/a"),
    "",
    "## Categories",
    ...categoryLines
  ].join("\n");
}
