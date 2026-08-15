import { constants, promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes, createHash } from "node:crypto";

export interface PkceSession {
  code_verifier: string;
  code_challenge: string;
  state: string;
  created_at: number;
}

const SESSION_TTL_MS = 600_000;

export class PkceStore {
  constructor(private readonly storePath: string) {}

  private sessionPath(state: string): string {
    return join(this.storePath, `pkce-${state}.json`);
  }

  async createSession(state: string): Promise<PkceSession> {
    const code_verifier = generateCodeVerifier();
    const code_challenge = computeCodeChallenge(code_verifier);
    const session: PkceSession = {
      code_verifier,
      code_challenge,
      state,
      created_at: Date.now()
    };

    await fs.mkdir(this.storePath, { recursive: true, mode: 0o700 });
    const sessionPath = this.sessionPath(state);
    const tmp = `${sessionPath}.tmp-${process.pid}`;
    await fs.writeFile(tmp, JSON.stringify(session, null, 2), { mode: 0o600 });
    await fs.rename(tmp, sessionPath);
    await fs.chmod(sessionPath, 0o600).catch(() => undefined);

    return session;
  }

  async getSession(state: string): Promise<PkceSession | null> {
    try {
      const sessionPath = this.sessionPath(state);
      const text = await fs.readFile(sessionPath, "utf8");
      const session = JSON.parse(text) as PkceSession;
      
      if (Date.now() - session.created_at > SESSION_TTL_MS) {
        await this.deleteSession(state);
        return null;
      }
      
      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async deleteSession(state: string): Promise<void> {
    const sessionPath = this.sessionPath(state);
    await fs.unlink(sessionPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async cleanup(): Promise<void> {
    try {
      const entries = await fs.readdir(this.storePath);
      const now = Date.now();
      
      for (const entry of entries) {
        if (!entry.startsWith("pkce-") || !entry.endsWith(".json")) continue;
        
        const path = join(this.storePath, entry);
        try {
          const text = await fs.readFile(path, "utf8");
          const session = JSON.parse(text) as PkceSession;
          if (now - session.created_at > SESSION_TTL_MS) {
            await fs.unlink(path).catch(() => undefined);
          }
        } catch {
          await fs.unlink(path).catch(() => undefined);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

function computeCodeChallenge(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
