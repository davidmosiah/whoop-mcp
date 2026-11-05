# WHOOP — Agent Plugins package

Portable [Agent Plugins](https://agent-plugins.org/) v1 package for
[Hermes Agent](https://github.com/NousResearch/hermes-agent) and other Agent Plugins clients:
the `whoop` MCP server (`whoop-mcp-unofficial@0.7.0` over stdio) plus the `whoop-mcp` workflow skill.

## Install (Hermes Agent)

```bash
hermes plugins install davidmosiah/whoop-mcp/agent-plugin --no-enable
hermes plugins enable whoop-mcp
```

Requires Node.js 20+ (`npx` on PATH). The skill loads as `whoop-mcp:whoop-mcp`.

## Connector setup

```bash
npx -y whoop-mcp-unofficial@0.7.0 setup --client generic
npx -y whoop-mcp-unofficial@0.7.0 auth
npx -y whoop-mcp-unofficial@0.7.0 doctor
```

`setup` asks for the WHOOP developer app client ID and secret and saves them locally (`--client generic` because this plugin already registers the server with Hermes); `auth` opens the WHOOP consent page in the browser and stores the OAuth tokens under `~/.whoop-mcp/` with 0600 permissions; `doctor` confirms readiness.

## Disclosure

Runs the `whoop-mcp-unofficial@0.7.0` npm package locally over stdio through `npx` (Node.js 20+ required); the package is downloaded from npm on first start. Data source: the official WHOOP OAuth API (v2). Credentials and OAuth tokens are created by the connector's own `setup`/`auth` commands in the user's terminal and stay on the machine (`~/.whoop-mcp/`); the plugin declares no environment variables and reads no Hermes credentials. Tools that change state: whoop_profile_update (local profile only); whoop_exchange_code (stores OAuth tokens locally); whoop_revoke_access (revokes the WHOOP grant and deletes local tokens). The tool set comes from the pinned npm version, not from this repository's source tree.
