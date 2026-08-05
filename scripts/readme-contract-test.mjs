/**
 * Contract gate for the README's `whoop_demo` examples.
 *
 * `scripts/demo-contract-test.mjs` proves the demo payload matches the real
 * tools. It says nothing about the README — and the README is the surface a
 * human reads first, on a public repo, before installing anything.
 *
 * That gap was real: until 0.6.1 the README advertised
 * `whoop_daily_summary.recovery.hrv_ms`, `sleep.duration_min`,
 * `wellness_context.recovery_band` and `list_recoveries.records[].score: 67`.
 * The server returns `latest.recovery.hrv_rmssd_milli`,
 * `latest.sleep.actual_sleep_hours`, a `band` under `latest.recovery`, and a
 * `score` that is an OBJECT. A parser written from that README does not crash —
 * it reads `undefined` and keeps going, which is the worst failure mode
 * available.
 *
 * This gate extracts the examples FROM THE README ITSELF (never a copy pasted
 * into this file — a copy would just move the drift one layer up) and compares
 * them with what the real `whoop_demo` tool returns. It fails in both
 * directions:
 *
 *   - a key path the README shows that the tool never returns -> invented
 *   - a key path the tool returns that the README omits       -> incomplete
 *   - a shared path whose leaf type disagrees                 -> read wrong
 *   - a scalar value that disagrees                           -> stale example
 *
 * Arrays may be TRUNCATED in the README (a 3-record list shown as 1), so they
 * are compared as a prefix: every element shown must deep-equal the real
 * element at the same index, and key paths are unioned across elements.
 *
 * All data here is synthetic. No real WHOOP account, token or health data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerWhoopTools } from '../dist/tools/whoop-tools.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const README = path.join(here, '..', 'README.md');
const readme = readFileSync(README, 'utf8');

/* ------------------------------------------------------------------ *
 * Extract the published examples from the README                      *
 * ------------------------------------------------------------------ */

/** Content of the single fenced block between <!-- marker:start/end -->. */
function readFencedBlock(marker, lang) {
  const pattern = new RegExp(
    `<!--\\s*${marker}:start\\s*-->\\s*\`\`\`${lang}\\n([\\s\\S]*?)\\n\`\`\`\\s*<!--\\s*${marker}:end\\s*-->`,
  );
  const match = readme.match(pattern);
  assert.ok(
    match,
    `README.md: missing the "${marker}" block (a \`\`\`${lang} fence between ` +
      `<!-- ${marker}:start --> and <!-- ${marker}:end -->). The published example must stay ` +
      `inside the markers so this gate can compare it with the real tool — deleting the block ` +
      `is not a way to pass.`,
  );
  return match[1];
}

const readmeJsonText = readFencedBlock('whoop-demo-json', 'json');
let readmeJson;
try {
  readmeJson = JSON.parse(readmeJsonText);
} catch (error) {
  assert.fail(
    `README.md: the whoop-demo-json block is not valid JSON (${error.message}). ` +
      `An example an agent cannot parse teaches nothing.`,
  );
}
const readmeMarkdown = readFencedBlock('whoop-demo-markdown', 'text').trimEnd();

/* ------------------------------------------------------------------ *
 * Key-path extraction and comparison                                  *
 * ------------------------------------------------------------------ */

function leafType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Recursive key paths plus the observed leaf type(s). Arrays union under `[]`. */
function keyPaths(value, prefix = '', out = new Map()) {
  if (Array.isArray(value)) {
    for (const item of value) keyPaths(item, `${prefix}[]`, out);
    return out;
  }
  if (value === null || typeof value !== 'object') return out;
  for (const key of Object.keys(value)) {
    const p = prefix ? `${prefix}.${key}` : key;
    const types = out.get(p) ?? new Set();
    types.add(leafType(value[key]));
    out.set(p, types);
    keyPaths(value[key], p, out);
  }
  return out;
}

/**
 * Value drift, walked in parallel over both payloads.
 *
 * Arrays: the README may show fewer elements than the tool returns, but every
 * element it does show must be the real one at that index. Showing MORE than
 * the tool returns is invention and fails.
 */
function valueDiff(doc, real, prefix = '', out = []) {
  if (Array.isArray(doc)) {
    if (!Array.isArray(real)) return out;
    if (doc.length > real.length) {
      out.push(
        `${prefix}: README shows ${doc.length} element(s), the tool returns ${real.length}`,
      );
    }
    for (let i = 0; i < Math.min(doc.length, real.length); i += 1) {
      valueDiff(doc[i], real[i], `${prefix}[${i}]`, out);
    }
    return out;
  }
  if (doc !== null && typeof doc === 'object') {
    if (real === null || typeof real !== 'object') return out;
    for (const key of Object.keys(doc)) {
      valueDiff(doc[key], real[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  if (!Object.is(doc, real)) {
    out.push(`${prefix}: README says ${JSON.stringify(doc)}, the tool returns ${JSON.stringify(real)}`);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Drive the real tool                                                 *
 * ------------------------------------------------------------------ */
const server = new McpServer({ name: 'whoop-readme-contract', version: '0.0.0' });
registerWhoopTools(server);
const client = new Client({ name: 'whoop-readme-contract-client', version: '0.0.0' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
await client.connect(clientTransport);

const failures = [];
let checkedPaths = 0;

try {
  const jsonResult = await client.callTool({
    name: 'whoop_demo',
    arguments: { response_format: 'json' },
  });
  assert.ok(!jsonResult.isError, `whoop_demo failed: ${jsonResult.content?.[0]?.text}`);
  const realJson = jsonResult.structuredContent;
  assert.ok(realJson, 'whoop_demo returned no structuredContent');

  const markdownResult = await client.callTool({ name: 'whoop_demo', arguments: {} });
  assert.ok(!markdownResult.isError, `whoop_demo (markdown) failed`);
  const realMarkdown = String(markdownResult.content?.[0]?.text ?? '').trimEnd();

  // --- 1. key paths, both directions, plus leaf types ---------------
  const docPaths = keyPaths(readmeJson);
  const realPaths = keyPaths(realJson);
  checkedPaths = docPaths.size;

  const invented = [...docPaths.keys()].filter((k) => !realPaths.has(k)).sort();
  const missing = [...realPaths.keys()].filter((k) => !docPaths.has(k)).sort();
  const mistyped = [];
  for (const [p, docTypes] of docPaths) {
    const realTypes = realPaths.get(p);
    if (!realTypes || realTypes.size !== 1) continue;
    if ([...docTypes].some((t) => realTypes.has(t))) continue;
    mistyped.push(`${p}: README is ${[...docTypes].join('|')}, the tool returns ${[...realTypes][0]}`);
  }

  if (invented.length > 0) {
    failures.push(
      `\n  README json: ${invented.length} key path(s) the tool NEVER returns.`,
      '  A reader writing a parser from this gets undefined, not an error:',
      ...invented.map((k) => `    - ${k}`),
    );
  }
  if (missing.length > 0) {
    failures.push(
      `\n  README json: ${missing.length} key path(s) the tool returns but the README omits.`,
      '  Readers will not know these exist:',
      ...missing.map((k) => `    + ${k}`),
    );
  }
  if (mistyped.length > 0) {
    failures.push(
      `\n  README json: ${mistyped.length} key path(s) present in both with a different type.`,
      '  The field is "found" and still read wrong:',
      ...mistyped.sort().map((k) => `    ~ ${k}`),
    );
  }

  // --- 2. values ----------------------------------------------------
  const values = valueDiff(readmeJson, realJson);
  if (values.length > 0) {
    failures.push(
      `\n  README json: ${values.length} value(s) disagree with the tool.`,
      '  The shape is right and the numbers are stale:',
      ...values.map((v) => `    ! ${v}`),
    );
  }

  // --- 3. the default (markdown) example ----------------------------
  if (readmeMarkdown !== realMarkdown) {
    failures.push(
      '\n  README markdown: the published default output is not what whoop_demo prints.',
      '  Published:',
      ...readmeMarkdown.split('\n').map((l) => `    - ${l}`),
      '  Actual:',
      ...realMarkdown.split('\n').map((l) => `    + ${l}`),
    );
  } else {
    console.log('PASS README markdown example matches whoop_demo default output');
  }

  if (failures.length === 0) {
    console.log(`PASS README json example — ${checkedPaths} key paths and values match whoop_demo`);
  }
} finally {
  await client.close();
}

if (failures.length > 0) {
  console.error('\nFAIL the README examples drifted from the real whoop_demo output:');
  console.error(failures.join('\n'));
  console.error(
    '\nFix README.md so the published examples match what the tool returns.' +
      '\nDo not edit this gate to accept the README — the README is the thing under test.\n',
  );
  process.exit(1);
}

console.log(`\nreadme-contract: ${checkedPaths} key paths verified against whoop_demo`);
console.log(JSON.stringify({ ok: true, suite: 'readme-contract', blocks: 2 }));
