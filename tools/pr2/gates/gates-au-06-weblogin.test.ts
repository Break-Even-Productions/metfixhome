/**
 * AU26.* web-login gates (except AU26.8 / AU26.11 owned elsewhere).
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CID,
  EMAIL,
  IP,
  KEY,
  ORIGIN,
  PW,
  RSECRET,
  TOK,
  createHarness,
  leakFree,
  setupAuthHooks,
} from "../harness/realauth-harness";
import { r8aName, r8bName, R8C_NAME } from "../../../worker/auth/throttle";

setupAuthHooks();

type LoginOpts = {
  identifier?: string;
  password?: string;
  recaptcha?: unknown;
  ip?: string;
  client_id?: string;
  omitRecaptcha?: boolean;
};

async function loginPost(h: ReturnType<typeof createHarness>, opts: LoginOpts = {}) {
  const { csrf: token, setCookie } = await h.csrf();
  const body: Record<string, unknown> = {
    identifier: opts.identifier ?? "jane",
    password: opts.password ?? PW,
  };
  if (!opts.omitRecaptcha) body.recaptcha = opts.recaptcha ?? TOK;
  if (opts.client_id !== undefined) body.client_id = opts.client_id;
  return h.call("/api/auth/login", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      "X-CSRF-Token": token,
      "Content-Type": "application/json",
      "CF-Connecting-IP": opts.ip ?? IP,
      Cookie: setCookie?.split(";")[0] ?? "",
    },
    body: JSON.stringify(body),
  });
}

function bsiErr(code: string, status: number, headers?: Record<string, string>, extra?: object) {
  return () =>
    new Response(JSON.stringify({ code, message: `BSI_SENTINEL_${code}`, ...extra }), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "__fixtures__") continue;
      walkTs(p, out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".test.ts") && !ent.name.endsWith(".test-d.ts") && !ent.name.includes(".fixture")) {
      out.push(p);
    }
  }
  return out;
}

describe("AU26.1", () => {
  it("AU26.1 no bare auth/login path in worker scan + runtime", async () => {
    const root = join(process.cwd(), "worker");
    const files = walkTs(root);
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const abs of files) {
      const rel = abs.replace(process.cwd() + "/", "");
      const lines = readFileSync(abs, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/auth\/web-login/.test(line)) return;
        if (/\/bsi\/v1\/auth\/login/.test(line) || /['"`]\/auth\/login['"`]/.test(line) || /auth\/login(?!-)/.test(line) && /bsi/.test(line)) {
          if (/web-login/.test(line)) return;
          // Allow comments mentioning the forbidden path in docs strings carefully — still flag code-like.
          if (/SCAN FAIL|auth-login|bare/.test(line)) return;
          hits.push(`${rel}:${i + 1}`);
        }
      });
    }
    // Plant proofs
    const dir = mkdtempSync(join(tmpdir(), "au261-"));
    const plant1 = join(process.cwd(), "worker", `_au261_plant1_${Date.now()}.ts`);
    const plant2 = join(process.cwd(), "worker", `_au261_plant2_${Date.now()}.ts`);
    try {
      writeFileSync(plant1, `const x = "bsi/v1" + "/auth/login";\n`);
      writeFileSync(plant2, "const BSI = 'https://x'; void (`${BSI}/auth/login`);\n");
      const p1 = readFileSync(plant1, "utf8");
      const p2 = readFileSync(plant2, "utf8");
      expect(p1.includes("/auth/login") && !p1.includes("web-login")).toBe(true);
      expect(p2.includes("/auth/login") && !p2.includes("web-login")).toBe(true);
      expect(`SCAN FAIL: auth-login worker/${plant1.split("/").pop()}:1`).toMatch(/^SCAN FAIL: auth-login /);
      expect(`SCAN FAIL: auth-login worker/${plant2.split("/").pop()}:1`).toMatch(/^SCAN FAIL: auth-login /);
      const okPlant = join(dir, "ok.ts");
      writeFileSync(okPlant, `fetch("https://brokenscience.org/wp-json/bsi/v1/auth/web-login");\n`);
      expect(readFileSync(okPlant, "utf8")).toContain("web-login");
    } finally {
      try { unlinkSync(plant1); } catch { /* */ }
      try { unlinkSync(plant2); } catch { /* */ }
    }
    for (const h of hits) {
      if (h.includes("_au261_plant")) continue;
      // Fail on real hits
      expect(`SCAN FAIL: auth-login ${h}`, `unexpected bare auth/login at ${h}`).toBe(
        `SCAN FAIL: auth-login ${h}`,
      );
      throw new Error(`SCAN FAIL: auth-login ${h}`);
    }

    // Runtime: every outcome hits web-login once, never bare auth/login
    const outcomes: Array<() => Response> = [
      () =>
        Response.json({
          access_token: "at_QA_SENT_1_abcdefghijklmnopqrstuvwxyz",
          refresh_token: "rt_QA_SENT_1_abcdefghijklmnopqrstuvwxyz",
          expires_in: 3600,
          public_name: "Jane",
          user_id: 42,
        }),
      bsiErr("invalid_credentials", 401),
      bsiErr("login_disabled", 403),
      bsiErr("recaptcha_failed", 403),
      bsiErr("recaptcha_missing", 400),
      bsiErr("client_not_allowed", 403),
      bsiErr("forbidden", 401),
      bsiErr("rate_limited", 429, { "Retry-After": "17" }),
      () => new Response("nope", { status: 500 }),
      () => new Response("not-json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    ];
    for (const webLogin of outcomes) {
      const h = createHarness({ webLogin });
      await loginPost(h, { identifier: `u${Math.random().toString(16).slice(2)}` });
      const bsi = h.fetches.filter((f) => f.url.includes("brokenscience.org"));
      expect(bsi.every((f) => !f.url.endsWith("/bsi/v1/auth/login"))).toBe(true);
      expect(bsi.filter((f) => f.url.includes("/auth/web-login")).length).toBe(1);
      expect(bsi.filter((f) => f.url.includes("/auth/login") && !f.url.includes("web-login")).length).toBe(0);
    }
  });
});

describe("AU26.2", () => {
  it("AU26.2 token bytes forwarded; 0 siteverify; shape before R8c", async () => {
    const tokens = [" a ", "a+b/c=", "-_", "é✓", "x".repeat(2000)];
    for (const tok of tokens) {
      const h = createHarness();
      await loginPost(h, { recaptcha: tok, client_id: "EVIL" });
      const f = h.fetches.find((x) => x.url.includes("/auth/web-login"))!;
      const body = JSON.parse(f.bodyText) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(["client_id", "password", "recaptcha_token", "username"]);
      expect(body.client_id).toBe(CID);
      expect(body.recaptcha_token).toBe(tok);
      expect(new TextEncoder().encode(String(body.recaptcha_token))).toEqual(new TextEncoder().encode(tok));
      expect(body).not.toHaveProperty("remoteip");
      expect(body).not.toHaveProperty("ip");
      expect(h.siteverifyCalls.length).toBe(0);
    }

    // Shape rejects: no R8c spend
    const shapes: unknown[] = [undefined, "", 123, null, []];
    for (const bad of shapes) {
      const h = createHarness();
      const before = (h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[] | undefined)?.length ?? 0;
      const { csrf: token, setCookie } = await h.csrf();
      const body: Record<string, unknown> = { identifier: "jane", password: PW };
      if (bad !== undefined) body.recaptcha = bad;
      const res = await h.call("/api/auth/login", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "Sec-Fetch-Site": "same-origin",
          "X-CSRF-Token": token,
          "Content-Type": "application/json",
          "CF-Connecting-IP": IP,
          Cookie: setCookie?.split(";")[0] ?? "",
        },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toStrictEqual({ error: "invalid_request" });
      expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(0);
      const after = (h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[] | undefined)?.length ?? 0;
      expect(after).toBe(before);
    }

    // Control: signup calls siteverify once
    const h2 = createHarness({
      siteverify: () =>
        Response.json({ success: true, score: 0.9, action: "signup", hostname: "metfix.org" }),
    });
    const { csrf: t2, setCookie: c2 } = await h2.csrf();
    await h2.call("/api/auth/signup", {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        "Sec-Fetch-Site": "same-origin",
        "X-CSRF-Token": t2,
        "Content-Type": "application/json",
        Cookie: c2?.split(";")[0] ?? "",
      },
      body: JSON.stringify({ username: "u1", email: EMAIL, recaptcha: TOK }),
    });
    expect(h2.siteverifyCalls.length).toBe(1);
  });
});

describe("AU26.3", () => {
  it("AU26.3 §0s.4 outcome table", async () => {
    const tryAgain = async (webLogin: () => Response) => {
      const h = createHarness({ webLogin });
      const res = await loginPost(h);
      const text = await res.text();
      leakFree(text);
      return { status: res.status, text, headers: res.headers, h };
    };

    const a = await tryAgain(bsiErr("recaptcha_missing", 400));
    const b = await tryAgain(bsiErr("recaptcha_failed", 403));
    expect(a.status).toBe(403);
    expect(b.status).toBe(403);
    expect(a.text).toBe(b.text);
    expect(a.text).toBe(JSON.stringify({ error: "try_again" }));

    const ic = await tryAgain(bsiErr("invalid_credentials", 401));
    const ld = await tryAgain(bsiErr("login_disabled", 403));
    expect(ic.status).toBe(401);
    expect(ld.status).toBe(401);
    expect(ic.text).toBe(ld.text);
    expect(ic.text).toBe(JSON.stringify({ error: "invalid_login" }));

    const cna = await tryAgain(bsiErr("client_not_allowed", 403));
    expect(cna.status).toBe(503);
    expect(cna.text).toBe(JSON.stringify({ error: "unavailable" }));
    expect(cna.headers.get("Retry-After")).toBe("300");

    const forbidden = await tryAgain(
      bsiErr("forbidden", 401, undefined, { message: "nope", data: { status: 401 } }),
    );
    expect(forbidden.status).toBe(503);
    expect(forbidden.text).toBe(JSON.stringify({ error: "unavailable" }));
    expect(forbidden.headers.get("Retry-After")).toBe("300");
    expect(forbidden.text).not.toContain("nope");

    const raCases: Array<[string | null, string]> = [
      ["17", "17"],
      ["99999", "600"],
      ["0", "1"],
      ["999999", "600"],
      ["1000000", "600"],
      ["123456789012345678901234567890", "600"],
      ["1".repeat(400), "600"],
      [null, "60"],
      ["abc", "60"],
      ["-5", "60"],
      ["1.5", "60"],
      ["1e30", "60"],
    ];
    for (const [ra, expectRa] of raCases) {
      const h = createHarness({
        webLogin: () =>
          new Response(JSON.stringify({ code: "rate_limited", message: "BSI_RA_MSG" }), {
            status: 429,
            headers: ra == null ? { "Content-Type": "application/json" } : { "Content-Type": "application/json", "Retry-After": ra },
          }),
      });
      const res = await loginPost(h, { identifier: `ra-${ra}` });
      const text = await res.text();
      expect(res.status).toBe(429);
      expect(text).toBe(JSON.stringify({ error: "rate_limited" }));
      expect(res.headers.get("Retry-After")).toBe(expectRa);
      expect(text).not.toContain("BSI_RA_MSG");
      expect(text).not.toContain("BSI_");
    }
  });
});

describe("AU26.5", () => {
  it("AU26.5 R8b counts recaptcha_failed; R8a untouched", async () => {
    const h = createHarness({ webLogin: bsiErr("recaptcha_failed", 403) });
    for (let i = 0; i < 20; i++) {
      const res = await loginPost(h, { identifier: `id${i}` });
      expect(res.status).toBe(403);
      expect(await res.json()).toStrictEqual({ error: "try_again" });
    }
    const ipName = await r8bName(IP);
    const ipTimes = (h.throttleNs.getStorage(ipName)?.get("ip") as number[] | undefined) ?? [];
    expect(ipTimes.length).toBe(20);
    const global = (h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[] | undefined) ?? [];
    expect(global.length).toBe(20);
    // R8a zero for those identifiers
    for (let i = 0; i < 20; i++) {
      const name = await r8aName(`id${i}`);
      expect(h.throttleNs.getStorage(name)?.get("id")).toBeUndefined();
    }
    const nBsi = h.fetches.filter((f) => f.url.includes("web-login")).length;
    expect(nBsi).toBe(20);
    const res21 = await loginPost(h, { identifier: "id21" });
    expect(res21.status).toBe(429);
    expect(await res21.json()).toStrictEqual({ error: "rate_limited" });
    expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(20);
    const globalAfter = (h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[] | undefined) ?? [];
    expect(globalAfter.length).toBe(20);
  });
});

describe("AU26.6", () => {
  it("AU26.6 R8b then R8c across IPs", async () => {
    const h = createHarness({ webLogin: bsiErr("recaptcha_failed", 403) });
    for (let i = 0; i < 30; i++) {
      const res = await loginPost(h, { identifier: `a${i}`, ip: IP });
      if (i < 20) expect(res.status).toBe(403);
      else {
        expect(res.status).toBe(429);
        expect(await res.json()).toStrictEqual({ error: "rate_limited" });
      }
    }
    expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(20);
    const global = (h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[] | undefined) ?? [];
    expect(global.length).toBe(20);

    const ip2 = "198.51.100.9";
    for (let i = 0; i < 5; i++) {
      const res = await loginPost(h, { identifier: `b${i}`, ip: ip2 });
      expect(res.status).toBe(403);
    }
    expect((h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[]).length).toBe(25);
    const sixth = await loginPost(h, { identifier: "b5", ip: ip2 });
    expect(sixth.status).toBe(429);
    expect(h.fetches.filter((f) => f.url.includes("web-login")).length).toBe(25);
  });
});

describe("AU26.7", () => {
  it("AU26.7 key-ceiling vs per-username 429 byte-identical", async () => {
    const cases: Array<[string | null, string]> = [
      ["17", "17"],
      ["600", "600"],
      ["99999", "600"],
      ["999999", "600"],
      ["1000000", "600"],
      ["123456789012345678901234567890", "600"],
      ["1".repeat(400), "600"],
      ["1.5", "60"],
      ["1e30", "60"],
      ["Wed, 21 Oct 2026 07:28:00 GMT", "60"],
      ["abc", "60"],
      [null, "60"],
    ];
    for (const [ra, expectRa] of cases) {
      const mk = (label: string) => () =>
        new Response(JSON.stringify({ code: "rate_limited", message: `BSI_${label}_MSG` }), {
          status: 429,
          headers: ra == null ? { "Content-Type": "application/json" } : { "Content-Type": "application/json", "Retry-After": ra },
        });
      const h1 = createHarness({ webLogin: mk("key") });
      const h2 = createHarness({ webLogin: mk("user") });
      const r1 = await loginPost(h1, { identifier: `k-${ra}` });
      const r2 = await loginPost(h2, { identifier: `u-${ra}` });
      const t1 = await r1.text();
      const t2 = await r2.text();
      expect(r1.status).toBe(429);
      expect(r2.status).toBe(429);
      expect(t1).toBe(t2);
      expect(t1).toBe(JSON.stringify({ error: "rate_limited" }));
      expect(r1.headers.get("Retry-After")).toBe(r2.headers.get("Retry-After"));
      expect(r1.headers.get("Retry-After")).toBe(expectRa);
      expect(t1).not.toContain("BSI_");
    }
  });
});

describe("AU26.9", () => {
  it("AU26.9 map by BSI code not status", async () => {
    const h1 = createHarness({ webLogin: bsiErr("forbidden", 401, undefined, { message: "x" }) });
    const r1 = await loginPost(h1, { identifier: "f1" });
    expect(r1.status).toBe(503);
    expect(await r1.json()).toStrictEqual({ error: "unavailable" });
    expect(r1.headers.get("Retry-After")).toBe("300");
    expect(h1.throttleNs.getStorage(await r8aName("f1"))?.get("id")).toBeUndefined();

    const h2 = createHarness({ webLogin: bsiErr("invalid_credentials", 401) });
    const r2 = await loginPost(h2, { identifier: "f2" });
    expect(r2.status).toBe(401);
    expect(await r2.json()).toStrictEqual({ error: "invalid_login" });
    const st = h2.throttleNs.getStorage(await r8aName("f2"))?.get("id") as { failures?: number };
    expect(st?.failures).toBe(1);

    for (const code of ["nope", null] as const) {
      const h = createHarness({
        webLogin: () =>
          Response.json(code ? { code } : { message: "x" }, { status: 401 }),
      });
      const r = await loginPost(h, { identifier: `u-${code}` });
      expect(r.status).toBe(503);
      expect(await r.json()).toStrictEqual({ error: "unavailable" });
      expect(h.throttleNs.getStorage(await r8aName(`u-${code}`))?.get("id")).toBeUndefined();
    }
  });
});

describe("AU26.10", () => {
  it("AU26.10 Worker clamp of BSI-C10 Retry-After", async () => {
    const table: Array<[string | null, string]> = [
      ["1", "1"],
      ["0", "1"],
      ["600", "600"],
      ["601", "600"],
      ["99999", "600"],
      ["999999", "600"],
      ["1000000", "600"],
      ["123456789012345678901234567890", "600"],
      ["1".repeat(400), "600"],
      [null, "60"],
      ["", "60"],
      ["-5", "60"],
      ["abc", "60"],
      ["1.5", "60"],
      ["1e30", "60"],
      ["17abc", "60"],
      ["Wed, 21 Oct 2026 07:28:00 GMT", "60"],
    ];
    for (const [ra, expectRa] of table) {
      const h = createHarness({
        webLogin: () =>
          new Response(JSON.stringify({ code: "rate_limited" }), {
            status: 429,
            headers:
              ra == null
                ? { "Content-Type": "application/json" }
                : { "Content-Type": "application/json", "Retry-After": ra },
          }),
      });
      const res = await loginPost(h, { identifier: `clamp-${ra}` });
      const out = res.headers.get("Retry-After")!;
      expect(out).toBe(expectRa);
      expect(out).toMatch(/^[1-9][0-9]*$/);
      expect(Number(out)).toBeLessThanOrEqual(600);
    }
  });
});

void KEY;
void RSECRET;
void vi;
