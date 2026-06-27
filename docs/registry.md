# MCP Registry Publishing

This repository includes `server.json` for the official MCP Registry.

Registry name:

```text
io.github.davidmosiah/whoop-mcp
```

npm package identifier:

```text
whoop-mcp-unofficial
```

Primary website:

```text
https://whoopmcp.vercel.app/
```

Credits:

```text
WHOOP MCP Unofficial builds on prior WHOOP MCP groundwork by Shashank Mishra:
https://github.com/shashankswe2020-ux/whoop-mcp
```

Publishing requires npm and MCP Registry authentication:

```bash
npm login
npm publish --access public

mcp-publisher login github
mcp-publisher publish
```

The MCP Registry currently hosts metadata only; the npm package must be published first.

Public demo hygiene:

```bash
whoop-mcp-server demo-capture --assert-sanitized --markdown whoop-recovery-demo.redacted.md
```

Only publish generated demo captures after confirming the transcript is
sanitized and does not include OAuth secrets, local token paths, raw payloads,
exact recovery numbers or exact sleep details.
