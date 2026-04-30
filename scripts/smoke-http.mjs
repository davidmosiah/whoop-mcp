import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = String(3900 + Math.floor(Math.random() * 500));
const child = spawn(process.execPath, ['dist/index.js', '--http'], {
  env: { ...process.env, WHOOP_MCP_PORT: port, WHOOP_MCP_HOST: '127.0.0.1' },
  stdio: ['ignore', 'ignore', 'pipe']
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

try {
  let ok = false;
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const data = await response.json();
      assert.equal(data.ok, true);
      ok = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  if (!ok) throw new Error(`HTTP server did not become healthy. stderr=${stderr}`);
  console.log(JSON.stringify({ ok: true, transport: 'http', port: Number(port) }, null, 2));
} finally {
  child.kill('SIGTERM');
}
