import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const expectedTools = [
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
  'whoop://capabilities',
  'whoop://latest/cycle',
  'whoop://latest/recovery',
  'whoop://latest/sleep',
  'whoop://summary/daily',
  'whoop://summary/weekly'
];

const expectedPrompts = [
  'daily_performance_coach',
  'sleep_recovery_investigator',
  'weekly_training_review'
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

  const prompt = await client.getPrompt({ name: 'daily_performance_coach', arguments: { timezone: 'UTC' } });
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

  const statusResult = await client.callTool({
    name: 'whoop_connection_status',
    arguments: { response_format: 'json' }
  });
  assert.equal(statusResult.structuredContent?.ok, false);
  assert.ok(statusResult.structuredContent?.missing_env?.includes('WHOOP_CLIENT_ID'));
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
