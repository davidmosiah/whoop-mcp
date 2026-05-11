import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  AgentManifestInputSchema,
  AgentManifestOutputSchema,
  AuthUrlInputSchema,
  AuthUrlOutputSchema,
  CacheStatusOutputSchema,
  CapabilitiesOutputSchema,
  CollectionInputSchema,
  CollectionOutputSchema,
  ConnectionStatusInputSchema,
  ConnectionStatusOutputSchema,
  DailySummaryInputSchema,
  DataInventoryOutputSchema,
  EndpointDataOutputSchema,
  ExchangeCodeInputSchema,
  ExchangeCodeOutputSchema,
  IdInputSchema,
  PrivacyAuditOutputSchema,
  ResponseFormatSchema,
  ResponseOnlyInputSchema,
  RevokeAccessOutputSchema,
  SimpleReadInputSchema,
  SummaryOutputSchema,
  WeeklySummaryInputSchema,
  WellnessContextInputSchema,
  WellnessContextOutputSchema
} from "../schemas/common.js";
import { buildAgentManifest, formatAgentManifestMarkdown } from "../services/agent-manifest.js";
import { buildPrivacyAudit } from "../services/audit.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildDataInventory, formatInventoryMarkdown } from "../services/inventory.js";
import { buildConnectionStatus } from "../services/connection-status.js";
import { getConfig } from "../services/config.js";
import { bulletList, formatCollection, makeError, makeResponse } from "../services/format.js";
import { applyPrivacy, resolvePrivacyMode } from "../services/privacy.js";
import { buildDailySummary, buildWeeklySummary, formatSummaryMarkdown } from "../services/summary.js";
import { buildWellnessContext, formatWellnessContextMarkdown } from "../services/context.js";
import {
  buildProfileSummary,
  getOnboardingFlow,
  getProfile,
  getProfilePath,
  missingCriticalFields,
  updateProfile,
  type WellnessProfileDocument
} from "../services/profile-store.js";
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
  server.registerTool("whoop_data_inventory", {
    title: "WHOOP Data Inventory",
    description: "Inventory supported WHOOP data domains, auth scope requirements, privacy boundary and recommended first calls. Does not call WHOOP APIs or expose user data.",
    inputSchema: ResponseOnlyInputSchema.shape,
    outputSchema: DataInventoryOutputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }, async ({ response_format }) => {
    const inventory = buildDataInventory();
    return makeResponse(inventory, response_format, formatInventoryMarkdown(inventory));
  });
  server.registerTool(
    "whoop_capabilities",
    {
      title: "WHOOP MCP Capabilities",
      description: "Explain supported WHOOP data, unavailable raw sensor streams, privacy modes, recommended agent workflow, and project links. Does not read WHOOP or expose secrets.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: CapabilitiesOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ response_format }) => {
      const capabilities = buildCapabilities();
      return makeResponse(capabilities, response_format, bulletList("WHOOP MCP Capabilities", {
        project: capabilities.project,
        unofficial: capabilities.unofficial,
        api_boundary: capabilities.api_boundary.source,
        raw_definition: capabilities.api_boundary.raw_definition,
        unsupported: capabilities.api_boundary.does_not_include.join(", "),
        recommended_first_tools: "whoop_connection_status, whoop_daily_summary, whoop_weekly_summary",
        docs: capabilities.links.docs
      }));
    }
  );

  server.registerTool(
    "whoop_agent_manifest",
    {
      title: "WHOOP Agent Manifest",
      description: "Machine-readable install, runtime and client guidance for AI agents operating the WHOOP MCP. Does not read WHOOP or expose secrets.",
      inputSchema: AgentManifestInputSchema.shape,
      outputSchema: AgentManifestOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ client: targetClient, response_format }) => {
      const manifest = buildAgentManifest(targetClient);
      return makeResponse(manifest, response_format, formatAgentManifestMarkdown(manifest));
    }
  );

  server.registerTool(
    "whoop_quickstart",
    {
      title: "WHOOP Quickstart",
      description:
        "Personalized 3-step setup walkthrough for the human user. Adapts to current state (env vars set? token present? what's next?). Call this first when the user asks 'how do I connect WHOOP?'",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ response_format }) => {
      const status = await buildConnectionStatus();
      const hasEnv = status.missing_env.length === 0;
      const hasToken = status.ready_for_whoop_api;
      const steps = [
        {
          step: 1,
          title: hasEnv ? "(done) WHOOP Developer credentials configured" : "Sign up at https://developer.whoop.com",
          action: hasEnv
            ? "WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, WHOOP_REDIRECT_URI are all set."
            : `Create a WHOOP Developer app, register a redirect URI (use ${status.redirect_uri ?? "http://127.0.0.1:3000/callback"}), then set: ${status.missing_env.join(", ")}.`,
          done: hasEnv,
        },
        {
          step: 2,
          title: hasToken ? "(done) Local token present — ready to read WHOOP data" : "Run the OAuth dance",
          action: hasToken
            ? "Tokens stored under ~/.whoop-mcp/tokens.json. The connector will refresh automatically when needed."
            : "Run `whoop-mcp-server auth` (or call whoop_get_auth_url + whoop_exchange_code from the agent). Open the URL, grant access, paste the code.",
          done: hasToken,
        },
        {
          step: 3,
          title: "Verify with the agent",
          action: "Call whoop_connection_status, then whoop_daily_summary or whoop_wellness_context. Pair with wellness-nourish for recovery-aware meal coaching.",
          example: hasToken
            ? "whoop_wellness_context() → recovery score + sleep + cycle handoff for nourish/cycle-coach."
            : "Until step 2 is done, the data tools will surface a clear 'auth required' message.",
          done: false,
        },
      ];
      const payload = {
        ok: true,
        ready: hasEnv && hasToken,
        steps,
        next: steps.find((s) => !s.done) ?? steps[steps.length - 1],
        cross_connector_hints: [
          "Pair WHOOP recovery with wellness-nourish for recovery-aware meal coaching.",
          "Pair WHOOP cycle with wellness-cycle-coach for late-luteal load adjustments.",
          "Pair WHOOP recovery + wellness-cgm-mcp glucose for metabolic-stress signals.",
        ],
      };
      const markdown = bulletList("WHOOP Quickstart", {
        ready: payload.ready,
        next: payload.next.title,
      });
      return makeResponse(payload, response_format, markdown);
    }
  );

  server.registerTool(
    "whoop_demo",
    {
      title: "WHOOP Demo",
      description:
        "Returns realistic example payloads of whoop_daily_summary, whoop_wellness_context, and whoop_list_recoveries so agents see the contract before calling real WHOOP APIs.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ response_format }) => {
      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        ok: true,
        is_demo: true,
        sample: {
          whoop_daily_summary: {
            date: today,
            recovery: { score: 67, hrv_ms: 58, resting_heart_rate: 52 },
            sleep: { performance: 88, duration_min: 462, efficiency: 91, stages: { rem_min: 96, deep_min: 78 } },
            strain: { day_strain: 11.2, max_heart_rate: 162 },
            workouts: 1,
          },
          whoop_wellness_context: {
            window: "last_24h",
            recovery_score: 67,
            recovery_band: "moderate",
            sleep_performance: 88,
            day_strain: 11.2,
            hrv_ms: 58,
            resting_heart_rate: 52,
            recommendation: "Moderate recovery + adequate sleep — green light for moderate intensity training. Consider a magnesium-rich meal to keep HRV trending up.",
          },
          whoop_list_recoveries: {
            count: 3,
            records: [
              { date: today, score: 67, hrv_ms: 58 },
              { date: yesterdayISO(), score: 72, hrv_ms: 61 },
              { date: dayBeforeISO(), score: 54, hrv_ms: 49 },
            ],
          },
        },
        notes: [
          "All sample data is synthetic; tagged with is_demo=true.",
          "Real calls return live data from the WHOOP Developer API after OAuth setup.",
        ],
      };
      const markdown = bulletList("WHOOP Demo", {
        is_demo: true,
        recovery_score: 67,
        sleep_performance: 88,
        recommendation: payload.sample.whoop_wellness_context.recommendation,
      });
      return makeResponse(payload, response_format, markdown);
    }
  );

  server.registerTool(
    "whoop_profile_get",
    {
      title: "WHOOP Profile Get (shared wellness profile)",
      description:
        "Read the shared Delx wellness profile (~/.delx-wellness/profile.json). Returns the user's preferred name, body basics, goals, devices, training context, nutrition context, agent preferences, and missing critical fields. Cross-connector — the same profile is also available from other Delx Wellness MCPs (Oura, Garmin, Nourish, Fitbit, etc). Read-only.",
      inputSchema: ResponseOnlyInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ response_format }) => {
      try {
        const profile = await getProfile();
        const payload = {
          ok: true,
          profile,
          summary: buildProfileSummary(profile),
          missing_critical: missingCriticalFields(profile),
          storage_path: getProfilePath()
        };
        return makeResponse(
          payload,
          response_format,
          bulletList("WHOOP Profile Get", {
            summary: payload.summary,
            missing_critical: payload.missing_critical.join(", ") || "none",
            storage_path: payload.storage_path
          })
        );
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  const ProfileUpdateInputSchema = z.object({
    patch: z.record(z.string(), z.unknown())
      .describe("Partial WellnessProfileDocument patch. Top-level keys may be: profile, goals, devices, training, nutrition, preferences, safety, notes."),
    explicit_user_intent: z.boolean().optional()
      .describe("Must be true. Set this AFTER the user has explicitly confirmed they want to save these changes to the shared wellness profile."),
    response_format: ResponseFormatSchema
  }).strict();

  server.registerTool(
    "whoop_profile_update",
    {
      title: "WHOOP Profile Update (shared wellness profile)",
      description:
        "Persist a partial patch to the shared Delx wellness profile (~/.delx-wellness/profile.json). REQUIRES explicit_user_intent=true. Top-level fields stored: profile (preferred_name, language, timezone, units, age_or_birth_year, height, weight, sex_or_gender_context), goals, devices, training, nutrition, preferences, safety, notes. NEVER stores OAuth tokens, API keys, refresh tokens, cookies, or any secret-shaped field — writes will be rejected at validation time. Cross-connector — the same profile is read by other Delx Wellness MCPs.",
      inputSchema: ProfileUpdateInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ patch, explicit_user_intent, response_format }) => {
      if (!explicit_user_intent) {
        return makeResponse(
          {
            ok: false,
            error: "USER_ACTION_REQUIRED",
            hint: "Set explicit_user_intent=true after the user confirms they want to save this."
          },
          response_format,
          bulletList("WHOOP Profile Update", {
            ok: false,
            error: "USER_ACTION_REQUIRED",
            hint: "Set explicit_user_intent=true after the user confirms they want to save this."
          })
        );
      }
      try {
        const updated_fields = Object.keys(patch);
        const profile = await updateProfile(patch as Partial<WellnessProfileDocument>);
        const payload = {
          ok: true,
          profile,
          summary: buildProfileSummary(profile),
          updated_fields
        };
        return makeResponse(
          payload,
          response_format,
          bulletList("WHOOP Profile Update", {
            summary: payload.summary,
            updated_fields: updated_fields.join(", ") || "none"
          })
        );
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  const OnboardingInputSchema = z.object({
    locale: z.enum(["en", "pt-BR"]).optional()
      .describe("Onboarding locale. Defaults to 'en'. Use 'pt-BR' for Portuguese (Brazil)."),
    response_format: ResponseFormatSchema
  }).strict();

  server.registerTool(
    "whoop_onboarding",
    {
      title: "WHOOP Onboarding (shared wellness profile)",
      description:
        "Return the 11-question Delx wellness onboarding flow (in English or pt-BR) plus the current shared profile state and missing critical fields. Read-only. The agent should ask these questions one-by-one, then call whoop_profile_update with explicit_user_intent=true to save. The same profile is reused by every Delx Wellness connector (Oura, Garmin, Nourish, etc.) — agents can call the equivalent {connector}_onboarding tools to cover their respective domains, or rely on this one since all connectors share the same questions.",
      inputSchema: OnboardingInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ locale, response_format }) => {
      try {
        const flow = getOnboardingFlow(locale ?? "en");
        const profile = await getProfile();
        const payload = {
          ok: true,
          flow,
          profile,
          summary: buildProfileSummary(profile),
          missing_critical: missingCriticalFields(profile),
          cross_connector_hint:
            "The Delx wellness profile is shared across all connectors. Other connectors (oura_onboarding, garmin_onboarding, nourish_*, fitbit_*, etc.) read and write the same ~/.delx-wellness/profile.json — ask the user once and reuse everywhere."
        };
        return makeResponse(
          payload,
          response_format,
          bulletList("WHOOP Onboarding", {
            locale: flow.locale,
            questions: flow.questions.length,
            missing_critical: payload.missing_critical.join(", ") || "none",
            storage_path: flow.storage_path
          })
        );
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

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
      description: "Get the authenticated user's WHOOP body measurements (height, weight, max heart rate). Requires read:body_measurement scope. Not medical advice.",
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
  registerCollectionTool(server, "whoop_list_recoveries", "WHOOP Recoveries", "/v2/recovery", "List WHOOP recoveries sorted by related sleep start time descending. Returns recovery score, HRV, RHR, SpO2 and skin temperature when scored. Requires read:recovery scope. Not medical advice.");
  registerCollectionTool(server, "whoop_list_sleeps", "WHOOP Sleeps", "/v2/activity/sleep", "List WHOOP sleep activities. Returns sleep stages, performance, consistency and efficiency when scored. Supports start/end filters and WHOOP pagination. Requires read:sleep scope. Not medical advice.");
  registerCollectionTool(server, "whoop_list_workouts", "WHOOP Workouts", "/v2/activity/workout", "List WHOOP workouts. Supports start/end filters and WHOOP pagination. Requires read:workout scope.");

  server.registerTool(
    "whoop_connection_status",
    {
      title: "WHOOP Connection Status",
      description: "Check whether local WHOOP env vars, token file, Node version, privacy mode and cache are ready. Does not call WHOOP or expose secrets.",
      inputSchema: ConnectionStatusInputSchema.shape,
      outputSchema: ConnectionStatusOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ client: targetClient, response_format }) => {
      const status = await buildConnectionStatus({ client: targetClient });
      return makeResponse(status, response_format, bulletList("WHOOP Connection Status", {
        ok: status.ok,
        ready_for_whoop_api: status.ready_for_whoop_api,
        client: status.client,
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

  server.registerTool(
    "whoop_wellness_context",
    {
      title: "WHOOP Wellness Context",
      description: "Normalize WHOOP recovery, sleep, strain and recent workout load into the shared wellness_context shape for exercise recommendation engines and Telegram agents.",
      inputSchema: WellnessContextInputSchema.shape,
      outputSchema: WellnessContextOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params) => {
      try {
        const context = await buildWellnessContext(client(), params);
        return makeResponse(context, params.response_format, formatWellnessContextMarkdown(context));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  registerGetByIdTool(server, "whoop_get_cycle", "WHOOP Cycle", (id) => `/v2/cycle/${id}`, "Get one WHOOP cycle by numeric cycle id. Requires read:cycles scope.");
  registerGetByIdTool(server, "whoop_get_sleep", "WHOOP Sleep", (id) => `/v2/activity/sleep/${id}`, "Get one WHOOP sleep activity by UUID. Requires read:sleep scope. Not medical advice.");
  registerGetByIdTool(server, "whoop_get_workout", "WHOOP Workout", (id) => `/v2/activity/workout/${id}`, "Get one WHOOP workout by UUID. Requires read:workout scope.");
  registerGetByIdTool(server, "whoop_get_cycle_sleep", "WHOOP Cycle Sleep", (id) => `/v2/cycle/${id}/sleep`, "Get the sleep associated with a WHOOP cycle. Requires read:sleep scope. Not medical advice.");
  registerGetByIdTool(server, "whoop_get_cycle_recovery", "WHOOP Cycle Recovery", (id) => `/v2/cycle/${id}/recovery`, "Get the recovery associated with a WHOOP cycle. Requires read:recovery scope. Not medical advice.");
}

function yesterdayISO(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

function dayBeforeISO(): string {
  return new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
}
