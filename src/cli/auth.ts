import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { getConfig } from "../services/config.js";
import { WhoopClient } from "../services/whoop-client.js";

export interface LocalRedirectPlan {
  host: string;
  port: number;
  path: string;
}

export function parseLocalRedirectUri(value: string): LocalRedirectPlan {
  const url = new URL(value);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (url.protocol !== "http:" || !localHosts.has(url.hostname) || !url.port) {
    throw new Error("Automatic auth requires a local redirect URI such as http://127.0.0.1:3000/callback.");
  }
  return {
    host: url.hostname === "localhost" ? "127.0.0.1" : url.hostname.replace(/^\[(.*)\]$/, "$1"),
    port: Number(url.port),
    path: url.pathname || "/callback"
  };
}

export async function runAuthCommand(args: string[]): Promise<number> {
  const noOpen = args.includes("--no-open");
  const json = args.includes("--json");
  const config = getConfig();
  const redirect = parseLocalRedirectUri(config.redirectUri);
  const state = randomBytes(4).toString("hex");
  const client = new WhoopClient(config);
  const authUrl = client.authUrl(state);
  const timeoutMs = Number(process.env.WHOOP_AUTH_TIMEOUT_MS ?? 300_000);

  const result = await waitForOAuthCode(redirect, state, timeoutMs, async (url) => {
    if (!json) {
      console.log("WHOOP authorization");
      console.log(`1. Opening: ${url}`);
      console.log("2. Approve access in the browser.");
      console.log("3. This command will save tokens locally and will not print them.");
      if (noOpen) console.log(`Open this URL manually: ${url}`);
    }
    if (!noOpen) openBrowser(url);
  }, authUrl);

  const exchange = await client.exchangeCode(result.code);
  const output = {
    ok: true,
    token_path: exchange.token_path,
    expires_at: exchange.expires_at,
    scope: exchange.scope,
    next_step: "Run `whoop-mcp-server doctor`, then add the MCP server to your agent."
  };
  if (json) console.log(JSON.stringify(output, null, 2));
  else {
    console.log("WHOOP connected successfully.");
    console.log(`Token file: ${output.token_path}`);
    console.log(output.next_step);
  }
  return 0;
}

function waitForOAuthCode(
  redirect: LocalRedirectPlan,
  expectedState: string,
  timeoutMs: number,
  onReady: (authUrl: string) => Promise<void> | void,
  authUrl: string
): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for WHOOP OAuth callback."));
    }, timeoutMs);

    const server = createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", `http://${redirect.host}:${redirect.port}`);
        if (requestUrl.pathname !== redirect.path) {
          res.writeHead(404).end("Not found");
          return;
        }
        const error = requestUrl.searchParams.get("error");
        const code = requestUrl.searchParams.get("code");
        const state = requestUrl.searchParams.get("state");
        if (error) throw new Error(`WHOOP authorization failed: ${error}`);
        if (!code) throw new Error("WHOOP callback did not include a code.");
        if (state !== expectedState) throw new Error("WHOOP callback state mismatch.");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(successHtml());
        clearTimeout(timeout);
        server.close();
        resolve({ code });
      } catch (error) {
        clearTimeout(timeout);
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end((error as Error).message);
        server.close();
        reject(error);
      }
    });

    server.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.listen(redirect.port, redirect.host, async () => {
      try {
        await onReady(authUrl);
      } catch (error) {
        clearTimeout(timeout);
        server.close();
        reject(error);
      }
    });
  });
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function successHtml(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>WHOOP connected</title></head>
<body style="font-family: system-ui; max-width: 640px; margin: 48px auto; line-height: 1.5;">
  <h1>WHOOP connected</h1>
  <p>You can close this tab and return to your terminal.</p>
</body>
</html>`;
}
