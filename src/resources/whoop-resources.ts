import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildAgentManifest, formatAgentManifestMarkdown } from "../services/agent-manifest.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildDataInventory } from "../services/inventory.js";
import { getConfig } from "../services/config.js";
import { applyPrivacy, resolvePrivacyMode } from "../services/privacy.js";
import { buildDailySummary, buildWeeklySummary } from "../services/summary.js";
import { WhoopClient } from "../services/whoop-client.js";

function jsonResource(uri: URL, data: unknown) {
  return {
    contents: [{
      uri: uri.toString(),
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2)
    }]
  };
}

function textResource(uri: URL, text: string) {
  return {
    contents: [{
      uri: uri.toString(),
      mimeType: "text/markdown",
      text
    }]
  };
}

async function latestCollectionResource(uri: URL, endpoint: string) {
  const config = getConfig();
  const privacyMode = resolvePrivacyMode(config);
  const result = await new WhoopClient(config).list(endpoint, { limit: 1 });
  const data = applyPrivacy(endpoint, { records: result.records }, privacyMode) as Record<string, unknown>;
  return jsonResource(uri, { endpoint, privacy_mode: privacyMode, ...data });
}

export function registerWhoopResources(server: McpServer): void {
  server.registerResource("whoop_data_inventory", "whoop://inventory", { title: "WHOOP Data Inventory", description: "Static inventory of supported WHOOP data domains, privacy modes and recommended first calls.", mimeType: "application/json" }, async (uri) => jsonResource(uri, buildDataInventory()));
  server.registerResource(
    "whoop_agent_manifest",
    "whoop://agent-manifest",
    {
      title: "WHOOP Agent Manifest",
      description: "Machine-readable install and operating instructions for AI agents.",
      mimeType: "text/markdown"
    },
    async (uri) => textResource(uri, formatAgentManifestMarkdown(buildAgentManifest("generic")))
  );

  server.registerResource(
    "whoop_capabilities_resource",
    "whoop://capabilities",
    {
      title: "WHOOP MCP Capabilities",
      description: "Static capabilities, data boundary, privacy modes and recommended agent workflow.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, buildCapabilities())
  );

  server.registerResource(
    "whoop_latest_recovery",
    "whoop://latest/recovery",
    {
      title: "Latest WHOOP Recovery",
      description: "Latest recovery record using the configured privacy mode.",
      mimeType: "application/json"
    },
    async (uri) => latestCollectionResource(uri, "/v2/recovery")
  );

  server.registerResource(
    "whoop_latest_sleep",
    "whoop://latest/sleep",
    {
      title: "Latest WHOOP Sleep",
      description: "Latest sleep record using the configured privacy mode.",
      mimeType: "application/json"
    },
    async (uri) => latestCollectionResource(uri, "/v2/activity/sleep")
  );

  server.registerResource(
    "whoop_latest_cycle",
    "whoop://latest/cycle",
    {
      title: "Latest WHOOP Cycle",
      description: "Latest physiological cycle using the configured privacy mode.",
      mimeType: "application/json"
    },
    async (uri) => latestCollectionResource(uri, "/v2/cycle")
  );

  server.registerResource(
    "whoop_daily_summary_resource",
    "whoop://summary/daily",
    {
      title: "WHOOP Daily Summary",
      description: "Daily recovery, sleep, load and action-candidate summary.",
      mimeType: "application/json"
    },
    async (uri) => {
      const summary = await buildDailySummary(new WhoopClient(getConfig()), { days: 10, timezone: "UTC" });
      return jsonResource(uri, summary);
    }
  );

  server.registerResource(
    "whoop_weekly_summary_resource",
    "whoop://summary/weekly",
    {
      title: "WHOOP Weekly Summary",
      description: "Weekly scorecard, bottlenecks and next-week success metrics.",
      mimeType: "application/json"
    },
    async (uri) => {
      const summary = await buildWeeklySummary(new WhoopClient(getConfig()), { days: 7, compare_days: 7, timezone: "UTC" });
      return jsonResource(uri, summary);
    }
  );
}
