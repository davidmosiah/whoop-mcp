import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const expected = [
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
  'whoop_weekly_summary'
];

const client = new Client({ name: 'whoop-mcp-smoke-test', version: '0.0.0' });
const transport = new StdioClientTransport({ command: 'node', args: ['dist/index.js'] });
await client.connect(transport);
try {
  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name).sort();
  const missing = expected.filter((name) => !names.includes(name));
  if (missing.length) {
    throw new Error(`Missing expected tools: ${missing.join(', ')}`);
  }
  console.log(JSON.stringify({ ok: true, count: names.length, names }, null, 2));
} finally {
  await client.close();
}
