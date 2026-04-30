#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerWhoopTools } from "./tools/whoop-tools.js";

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION
});

registerWhoopTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
