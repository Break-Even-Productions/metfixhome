/**
 * OAUTH_STATE Durable Object — single-use OAuth transaction state.
 * Instance: idFromName("oauth:" + sha256hex(state))
 * put on start; take() reads and deletes atomically; 600 s alarm.
 */

export type OauthStateRecord = {
  flow: "google" | "bridge";
  nonce: string;
  verifier: string;
  intent: "login" | "register";
  return: string;
  pre_hash: string;
  created: number;
};

const KEY = "rec";
const TTL_MS = 600_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export class OauthStateDO implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "PUT" && url.pathname === "/put") {
        const rec = (await request.json()) as OauthStateRecord;
        await this.state.storage.put(KEY, rec);
        await this.state.storage.setAlarm(Date.now() + TTL_MS);
        return json({ ok: true });
      }
      if (request.method === "POST" && url.pathname === "/take") {
        const rec = await this.state.storage.get<OauthStateRecord>(KEY);
        await this.state.storage.deleteAll();
        await this.state.storage.deleteAlarm();
        if (!rec) return json({ error: "absent" }, 404);
        if (Date.now() - rec.created > TTL_MS) {
          return json({ error: "expired" }, 404);
        }
        return json({ ok: true, record: rec });
      }
      return json({ error: "not_found" }, 404);
    } catch {
      return json({ error: "unavailable" }, 503);
    }
  }
}
