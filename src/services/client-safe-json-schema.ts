import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema, type ListToolsResult, type Tool } from "@modelcontextprotocol/sdk/types.js";

const JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema";
const DRAFT_07_SCHEMA_ID = /^https?:\/\/json-schema\.org\/(?:draft-07|draft\/07)\/schema#?$/;

function clientSchema<T extends Record<string, unknown>>(schema: T): T {
  if (typeof schema.$schema !== "string" || !DRAFT_07_SCHEMA_ID.test(schema.$schema)) {
    return schema;
  }
  return { ...schema, $schema: JSON_SCHEMA_2020_12 };
}

function clientTool(tool: Tool): Tool {
  return {
    ...tool,
    inputSchema: clientSchema(tool.inputSchema),
    ...(tool.outputSchema ? { outputSchema: clientSchema(tool.outputSchema) } : {})
  };
}

/**
 * The SDK emits draft-07 for Zod tool schemas, which 2020-12-only clients
 * reject. Our tool schemas use the common subset of both dialects; the
 * protocol smoke test compiles every advertised schema with Ajv2020.
 * This is not a general draft-07 converter (e.g. tuple items need conversion).
 *
 * Wrap only discovery after registration, retaining SDK metadata and runtime
 * Zod input/output validation. The SDK currently exposes no public hook for
 * its JSON Schema target, so guard this private handler lookup explicitly.
 */
export function installClientSafeToolSchemas(server: McpServer): void {
  const protocol = server.server as unknown as { _requestHandlers?: unknown };
  const handlers = protocol._requestHandlers;
  const original = handlers instanceof Map ? handlers.get("tools/list") : undefined;
  if (typeof original !== "function") {
    throw new Error("tools/list handler missing; install client-safe schemas after tool registration (check SDK compatibility)");
  }

  server.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const result = await original(request, extra) as ListToolsResult;
    return { ...result, tools: result.tools.map(clientTool) };
  });
}
