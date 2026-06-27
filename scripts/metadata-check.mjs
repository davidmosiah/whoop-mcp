import { existsSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const serverJson = JSON.parse(readFileSync('server.json', 'utf8'));
const errors = [];

function requireFile(path) {
  if (!existsSync(path)) errors.push(`Missing required file: ${path}`);
}

requireFile('README.md');
if (packageJson.private !== true && packageJson.license !== 'UNLICENSED') {
  requireFile('LICENSE');
}
requireFile('llms.txt');
requireFile('docs/credits.md');
requireFile('docs/demo/recovery-demo-redaction-contract.md');
requireFile('server.json');

if (serverJson.version !== packageJson.version) {
  errors.push(`server.json version ${serverJson.version} does not match package.json version ${packageJson.version}`);
}

const expectsRegistryPackage = packageJson.private !== true && serverJson.publication?.npm !== false;
const npmPackage = serverJson.packages?.find((pkg) => pkg.registryType === 'npm');
if (expectsRegistryPackage && !npmPackage) {
  errors.push('server.json must declare an npm package.');
}
if (npmPackage) {
  if (npmPackage.identifier !== packageJson.name) {
    errors.push(`server.json package identifier ${npmPackage.identifier} does not match package name ${packageJson.name}`);
  }
  if (npmPackage.version !== packageJson.version) {
    errors.push(`server.json package version ${npmPackage.version} does not match package version ${packageJson.version}`);
  }
}

if (Array.isArray(packageJson.files) && !packageJson.files.includes('llms.txt')) {
  errors.push('package.json files must include llms.txt.');
}

if (!packageJson.scripts?.['demo:capture'] || !packageJson.scripts?.['test:demo-capture']) {
  errors.push('package.json must expose demo:capture and test:demo-capture scripts.');
}

if (!readFileSync('README.md', 'utf8').includes('demo-capture')) {
  errors.push('README.md must document the privacy-sanitized demo-capture command.');
}

const attributionTargets = [
  ['README.md', readFileSync('README.md', 'utf8')],
  ['docs/credits.md', readFileSync('docs/credits.md', 'utf8')],
  ['docs/llms.txt', readFileSync('docs/llms.txt', 'utf8')],
  ['llms.txt', readFileSync('llms.txt', 'utf8')]
];
for (const [path, text] of attributionTargets) {
  if (!text.includes('Shashank')) {
    errors.push(`${path} must credit Shashank's prior WHOOP MCP work.`);
  }
  if (!text.includes('whoop-ai-mcp')) {
    errors.push(`${path} must mention the prior whoop-ai-mcp package.`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, metadata: true, package: packageJson.name, version: packageJson.version }, null, 2));
