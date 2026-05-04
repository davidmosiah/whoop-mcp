import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const expectedTools = [
  'whoop_agent_manifest',
  'whoop_cache_status',
  'whoop_capabilities',
  'whoop_connection_status',
  'whoop_daily_summary',
  'whoop_exchange_code',
  'whoop_get_auth_url',
  'whoop_get_body_measurements',
  'whoop_get_cycle',
  'whoop_get_cycle_recovery',
  'whoop_get_cycle_sleep',
  'whoop_get_profile',
  'whoop_get_sleep',
  'whoop_get_workout',
  'whoop_list_cycles',
  'whoop_list_recoveries',
  'whoop_list_sleeps',
  'whoop_list_workouts',
  'whoop_privacy_audit',
  'whoop_revoke_access',
  'whoop_weekly_summary'
];

const expectedResources = [
  'whoop://agent-manifest',
  'whoop://capabilities',
  'whoop://latest/cycle',
  'whoop://latest/recovery',
  'whoop://latest/sleep',
  'whoop://summary/daily',
  'whoop://summary/weekly'
];

const expectedPrompts = [
  'whoop_daily_performance_coach',
  'whoop_sleep_recovery_investigator',
  'whoop_weekly_training_review'
];

const client = new Client({ name: 'whoop-mcp-smoke-test', version: '0.0.0' });
const transport = new StdioClientTransport({ command: 'node', args: ['dist/index.js'] });
await client.connect(transport);
try {
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, expectedTools.sort());

  const resources = await client.listResources();
  const resourceUris = resources.resources.map((resource) => resource.uri).sort();
  assert.deepEqual(resourceUris, expectedResources.sort());

  const prompts = await client.listPrompts();
  const promptNames = prompts.prompts.map((prompt) => prompt.name).sort();
  assert.deepEqual(promptNames, expectedPrompts.sort());

  const prompt = await client.getPrompt({ name: 'whoop_daily_performance_coach', arguments: { timezone: 'UTC' } });
  assert.ok(prompt.messages[0]?.content?.type === 'text');

  const auditResult = await client.callTool({
    name: 'whoop_privacy_audit',
    arguments: { response_format: 'json' }
  });
  assert.equal(auditResult.structuredContent?.unofficial, true);
  assert.ok(['env', 'local_config', 'mixed', 'missing'].includes(auditResult.structuredContent?.config_source));
  assert.ok(auditResult.structuredContent?.secret_env_vars?.includes('WHOOP_CLIENT_SECRET'));
  assert.ok(!auditResult.structuredContent?.secret_env_vars?.includes('WHOOP_CLIENT_ID'));

  const capabilitiesResult = await client.callTool({
    name: 'whoop_capabilities',
    arguments: { response_format: 'json' }
  });
  assert.equal(capabilitiesResult.structuredContent?.unofficial, true);
  assert.ok(capabilitiesResult.structuredContent?.api_boundary?.does_not_include?.includes('continuous heart-rate samples'));
  assert.ok(capabilitiesResult.structuredContent?.recommended_agent_flow?.some((step) => step.includes('whoop_connection_status')));
  assert.ok(capabilitiesResult.structuredContent?.recommended_agent_flow?.some((step) => step.includes('whoop_agent_manifest')));

  const manifestResult = await client.callTool({
    name: 'whoop_agent_manifest',
    arguments: { client: 'hermes', response_format: 'json' }
  });
  assert.equal(manifestResult.structuredContent?.client, 'hermes');
  assert.ok(manifestResult.structuredContent?.hermes?.common_tool_names?.includes('mcp_whoop_whoop_connection_status'));
  assert.equal(manifestResult.structuredContent?.hermes?.no_gateway_restart_for_data_access, true);

  const statusResult = await client.callTool({
    name: 'whoop_connection_status',
    arguments: { client: 'hermes', response_format: 'json' }
  });
  assert.equal(statusResult.structuredContent?.ok, false);
  assert.ok(statusResult.structuredContent?.missing_env?.includes('WHOOP_CLIENT_ID'));
  assert.equal(statusResult.structuredContent?.client, 'hermes');
  assert.ok(statusResult.structuredContent?.client_checks?.hermes?.recommendations?.some((step) => step.includes('/reload-mcp')));
  assert.ok(statusResult.structuredContent?.next_steps?.some((step) => step.includes('WHOOP_CLIENT_ID')));

  console.log(JSON.stringify({
    ok: true,
    tools: toolNames.length,
    resources: resourceUris.length,
    prompts: promptNames.length
  }, null, 2));
} finally {
  await client.close();
}
