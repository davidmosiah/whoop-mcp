import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// Port 4045 from the old random range is blocked by Fetch. Let the child
// acquire an OS-assigned port and report it only after its listener is ready.
let port;
const healthCheckAttempts = 100;
const healthCheckDelayMs = 200;
const homeDir = mkdtempSync(join(tmpdir(), 'whoop-mcp-http-smoke-'));
const child = spawn(process.execPath, ['--import', new URL('./http-fixture-listener.mjs', import.meta.url).href, 'dist/index.js', '--http'], {
  env: { PATH: process.env.PATH, HOME: homeDir, WHOOP_MCP_PORT: '0', WHOOP_MCP_HOST: '127.0.0.1' },
  stdio: ['ignore', 'ignore', 'pipe', 'ipc']
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
const exited = new Promise((resolve) => child.once('close', resolve));
const listening = new Promise((resolve, reject) => {
  const timer = setTimeout(() => finish(new Error(`HTTP listener readiness timed out. stderr=${stderr}`)), 20_000);
  const onExit = (code, signal) => finish(new Error(`HTTP child exited before listening: ${code ?? signal}. stderr=${stderr}`));
  const onError = (error) => finish(error);
  const onMessage = (message) => {
    if (message?.type !== 'http-fixture-listening') return;
    if (message.address !== '127.0.0.1' || !Number.isInteger(message.port) || message.port < 1 || message.port > 65535) {
      finish(new Error('Invalid loopback listener readiness message.'));
      return;
    }
    finish(null, String(message.port));
  };
  function finish(error, value) {
    clearTimeout(timer);
    child.off('exit', onExit); child.off('error', onError); child.off('message', onMessage);
    if (error) reject(error); else resolve(value);
  }
  child.once('exit', onExit); child.once('error', onError); child.on('message', onMessage);
});

const ajv = new Ajv2020({ strictSchema: true, validateSchema: true, allErrors: true });
addFormats(ajv);
const client = new Client({ name: 'whoop-mcp-http-smoke-test', version: '0.0.0' }, {
  jsonSchemaValidator: new AjvJsonSchemaValidator(ajv)
});

try {
  port = await listening;
  let ok = false;
  for (let i = 0; i < healthCheckAttempts; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_000) });
      const data = await response.json();
      assert.equal(data.ok, true);
      ok = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, healthCheckDelayMs));
    }
  }
  if (!ok) throw new Error(`HTTP server did not become healthy. stderr=${stderr}`);
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  const { tools } = await client.listTools();
  assert.ok(tools.length > 0, 'HTTP tools/list must advertise tools');
  for (const tool of tools) {
    for (const key of ['inputSchema', 'outputSchema']) {
      if (!tool[key]) continue;
      assert.equal(tool[key].$schema, 'https://json-schema.org/draft/2020-12/schema', `${tool.name}.${key}`);
      assert.doesNotThrow(() => ajv.compile(tool[key]), `${tool.name}.${key} must compile with Ajv2020`);
    }
  }
  console.log(JSON.stringify({ ok: true, transport: 'http', port: Number(port) }, null, 2));
} finally {
  try {
    await client.close();
  } finally {
    child.kill('SIGTERM');
    const killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
    await exited;
    clearTimeout(killTimer);
  }
}
