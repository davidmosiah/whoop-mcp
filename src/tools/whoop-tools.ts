import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  AuthUrlInputSchema,
  AuthUrlOutputSchema,
  CacheStatusOutputSchema,
  CollectionInputSchema,
  CollectionOutputSchema,
  ConnectionStatusOutputSchema,
  DailySummaryInputSchema,
  EndpointDataOutputSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeOutputSchema,
  IdInputSchema,
  PrivacyAuditOutputSchema,
  RevokeAccessOutputSchema,
  ResponseOnlyInputSchema,
  SimpleReadInputSchema,
  SummaryOutputSchema,
  WeeklySummaryInputSchema
} from "../schemas/common.js";
import { buildPrivacyAudit } from "../services/audit.js";
import { buildConnectionStatus } from "../services/connection-status.js";
import { getConfig } from "../services/config.js";
import { bulletList, formatCollection, makeError, makeResponse } from "../services/format.js";
import { applyPrivacy, resolvePrivacyMode } from "../services/privacy.js";
import { buildDailySummary, buildWeeklySummary, formatSummaryMarkdown } from "../services/summary.js";
import { WhoopClient } from "../services/whoop-client.js";

function client(): WhoopClient {
  return new WhoopClient(getConfig());
}

function registerCollectionTool(server: McpServer, name: string, title: string, endpoint: string, description: string): void {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema: CollectionInputSchema.shape,
      outputSchema: CollectionOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const config = getConfig();
        const privacyMode = resolvePrivacyMode(config, params.privacy_mode);
        const result = await new WhoopClient(config).list(endpoint, params);
        const records = applyPrivacy(endpoint, { records: result.records }, privacyMode) as { records: unknown[] };
        const output = {
          endpoint,
          privacy_mode: privacyMode,
          count: records.records.length,
          records: records.records,
          next_token: result.next_token,
          has_more: Boolean(result.next_token),
          pages_fetched: result.pages_fetched
        };
        return makeResponse(
          output,
          params.response_format,
          formatCollection(title, records.records, {
            endpoint,
            privacy_mode: privacyMode,
            count: records.records.length,
            has_more: Boolean(result.next_token),
            next_token: result.next_token ?? "none",
            pages_fetched: result.pages_fetched
          })
        );
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );
}

function registerGetByIdTool(server: McpServer, name: string, title: string, endpointBuilder: (id: string | number) => string, description: string): void {
  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema: IdInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const config = getConfig();
        const privacyMode = resolvePrivacyMode(config, params.privacy_mode);
        const endpoint = endpointBuilder(params.id);
        const data = applyPrivacy(endpoint, await new WhoopClient(config).get(endpoint), privacyMode);
        return makeResponse(
          { endpoint, privacy_mode: privacyMode, data },
          params.response_format,
          bulletList(title, { endpoint, privacy_mode: privacyMode, data: JSON.stringify(data) })
        );
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );
}

export function registerWhoopTools(server: McpServer): void {
  server.registerTool(
    "whoop_get_auth_url",
    {
      title: "Get WHOOP OAuth URL",
      description: "Generate a WHOOP OAuth authorization URL. This does not read or modify WHOOP data. Use this first when no local token exists.",
      inputSchema: AuthUrlInputSchema.shape,
      outputSchema: AuthUrlOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params) => {
      try {
        const config = getConfig();
        const url = new WhoopClient(config).authUrl(params.state, params.scopes);
        const output = {
          auth_url: url,
          redirect_uri: config.redirectUri,
          scopes: params.scopes?.length ? params.scopes : config.scopes,
          next_step: "Open auth_url, approve access, then pass the returned code or full redirect URL to whoop_exchange_code."
        };
        return makeResponse(output, params.response_format, bulletList("WHOOP OAuth URL", output));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "whoop_exchange_code",
    {
      title: "Exchange WHOOP OAuth Code",
      description: "Exchange a WHOOP OAuth authorization code for local tokens. Tokens are stored locally with 0600 permissions and are never returned by this tool.",
      inputSchema: ExchangeCodeInputSchema.shape,
      outputSchema: ExchangeCodeOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    async (params) => {
      try {
        const result = await client().exchangeCode(params.code);
        const output = {
          ok: result.ok,
          token_path: result.token_path,
          scope: result.scope,
          expires_at: result.expires_at,
          note: "Token values were stored locally and intentionally omitted from this response."
        };
        return makeResponse(output, params.response_format, bulletList("WHOOP OAuth Exchange", output));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "whoop_get_profile",
    {
      title: "Get WHOOP Profile",
      description: "Get the authenticated user's basic WHOOP profile. Requires read:profile scope.",
      inputSchema: SimpleReadInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ response_format, privacy_mode }) => {
      try {
        const config = getConfig();
        const endpoint = "/v2/user/profile/basic";
        const privacyMode = resolvePrivacyMode(config, privacy_mode);
        const data = applyPrivacy(endpoint, await new WhoopClient(config).get(endpoint), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("WHOOP Profile", data as Record<string, unknown>));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "whoop_get_body_measurements",
    {
      title: "Get WHOOP Body Measurements",
      description: "Get the authenticated user's WHOOP body measurements. Requires read:body_measurement scope.",
      inputSchema: SimpleReadInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ response_format, privacy_mode }) => {
      try {
        const config = getConfig();
        const endpoint = "/v2/user/measurement/body";
        const privacyMode = resolvePrivacyMode(config, privacy_mode);
        const data = applyPrivacy(endpoint, await new WhoopClient(config).get(endpoint), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("WHOOP Body Measurements", data as Record<string, unknown>));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  registerCollectionTool(server, "whoop_list_cycles", "WHOOP Cycles", "/v2/cycle", "List WHOOP physiological cycles. Supports start/end filters and WHOOP pagination. Requires read:cycles scope.");
  registerCollectionTool(server, "whoop_list_recoveries", "WHOOP Recoveries", "/v2/recovery", "List WHOOP recoveries sorted by related sleep start time descending. Requires read:recovery scope.");
  registerCollectionTool(server, "whoop_list_sleeps", "WHOOP Sleeps", "/v2/activity/sleep", "List WHOOP sleep activities. Supports start/end filters and WHOOP pagination. Requires read:sleep scope.");
  registerCollectionTool(server, "whoop_list_workouts", "WHOOP Workouts", "/v2/activity/workout", "List WHOOP workouts. Supports start/end filters and WHOOP pagination. Requires read:workout scope.");

  server.registerTool(
    "whoop_connection_status",
    {
      title: "WHOOP Connection Status",
      description: "Check whether local WHOOP env vars, token file, Node version, privacy mode and cache are ready. Does not call WHOOP or expose secrets.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: ConnectionStatusOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ response_format }) => {
      const status = await buildConnectionStatus();
      return makeResponse(status, response_format, bulletList("WHOOP Connection Status", {
        ok: status.ok,
        ready_for_whoop_api: status.ready_for_whoop_api,
        missing_env: status.missing_env.join(", ") || "none",
        token_path: status.token.path,
        token_exists: status.token.exists,
        privacy_mode: status.privacy_mode,
        next_steps: status.next_steps.join(" | ")
      }));
    }
  );

  server.registerTool(
    "whoop_cache_status",
    {
      title: "WHOOP Cache Status",
      description: "Show optional local SQLite cache status. Enable with WHOOP_CACHE=sqlite or WHOOP_CACHE=true.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: CacheStatusOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ response_format }) => {
      try {
        const status = client().cacheStatus();
        return makeResponse(status, response_format, bulletList("WHOOP Cache Status", status));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "whoop_privacy_audit",
    {
      title: "WHOOP Privacy Audit",
      description: "Return the local privacy, cache, token-path, env-presence and redaction posture without revealing secret values.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: PrivacyAuditOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ response_format }) => {
      const audit = buildPrivacyAudit();
      return makeResponse(audit, response_format, bulletList("WHOOP Privacy Audit", audit));
    }
  );

  server.registerTool(
    "whoop_revoke_access",
    {
      title: "Revoke WHOOP OAuth Access",
      description: "Revoke the current WHOOP OAuth access grant and delete the local token file. Use only when the user explicitly wants to disconnect WHOOP.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: RevokeAccessOutputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
    },
    async ({ response_format }) => {
      try {
        const result = await client().revokeAccess();
        const output = {
          ...result,
          note: "WHOOP access was revoked and local tokens were removed. Re-authorize with whoop_get_auth_url before future API calls."
        };
        return makeResponse(output, response_format, bulletList("WHOOP Access Revoked", output));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "whoop_daily_summary",
    {
      title: "WHOOP Daily Summary",
      description: `Build a privacy-conscious daily performance summary from WHOOP recovery, sleep, cycle and workout data.

This workflow tool fetches recent WHOOP v2 records, computes a defensive baseline, and returns readiness, sleep, load, diagnostic signals and concrete action candidates. It does not provide medical advice and does not store data locally.`,
      inputSchema: DailySummaryInputSchema.shape,
      outputSchema: SummaryOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params) => {
      try {
        const summary = await buildDailySummary(client(), params);
        return makeResponse(summary, params.response_format, formatSummaryMarkdown(summary));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "whoop_weekly_summary",
    {
      title: "WHOOP Weekly Summary",
      description: `Build a weekly WHOOP operating review with recovery, sleep, strain, workouts, bottlenecks, action candidates and next-week success metrics.

This workflow tool compares a recent window against a prior window when available. It is intended for coaching and agent workflows, not medical diagnosis.`,
      inputSchema: WeeklySummaryInputSchema.shape,
      outputSchema: SummaryOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params) => {
      try {
        const summary = await buildWeeklySummary(client(), params);
        return makeResponse(summary, params.response_format, formatSummaryMarkdown(summary));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  registerGetByIdTool(server, "whoop_get_cycle", "WHOOP Cycle", (id) => `/v2/cycle/${id}`, "Get one WHOOP cycle by numeric cycle id. Requires read:cycles scope.");
  registerGetByIdTool(server, "whoop_get_sleep", "WHOOP Sleep", (id) => `/v2/activity/sleep/${id}`, "Get one WHOOP sleep activity by UUID. Requires read:sleep scope.");
  registerGetByIdTool(server, "whoop_get_workout", "WHOOP Workout", (id) => `/v2/activity/workout/${id}`, "Get one WHOOP workout by UUID. Requires read:workout scope.");
  registerGetByIdTool(server, "whoop_get_cycle_sleep", "WHOOP Cycle Sleep", (id) => `/v2/cycle/${id}/sleep`, "Get the sleep associated with a WHOOP cycle. Requires read:sleep scope.");
  registerGetByIdTool(server, "whoop_get_cycle_recovery", "WHOOP Cycle Recovery", (id) => `/v2/cycle/${id}/recovery`, "Get the recovery associated with a WHOOP cycle. Requires read:recovery scope.");
}
