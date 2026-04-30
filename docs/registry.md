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

Publishing requires npm and MCP Registry authentication:

```bash
npm login
npm publish --access public

mcp-publisher login github
mcp-publisher publish
```

The MCP Registry currently hosts metadata only; the npm package must be published first.
