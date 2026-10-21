/**
 * AU27.* direct-token gates (spec 1.6.8 / QA r1.31).
 */
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { handleRequest } from "../../../worker/index";
import type { FetchImpl } from "../../../worker/upstream";
import { R8C_NAME } from "../../../worker/auth/throttle";
import { sessionAad } from "../../../worker/auth/session";
import {
  ACCESS1,
  ACCESS2,
  BSI_ME_URL,
  CID,
  ENCKEY,
  IP,
  KEY,
  OAUTH_TOKEN_URL,
  ORIGIN,
  PW,
  REFRESH1,
  REFRESH2,
  RSECRET,
  SECRET_CANARY,
  TOK,
  createHarness,
  csrfSid,
  hOk,
  setupAuthHooks,
  sidHex,
} from "../harness/realauth-harness";
import { decryptSessionPayload, encryptSessionPayload } from "../../../worker/auth/crypto";

setupAuthHooks();

type LoginOpts = {
  identifier?: string;
  password?: string;
  recaptcha?: unknown;
  ip?: string;
  client_id?: string;
  client_secret?: string;
  omitRecaptcha?: boolean;
  extra?: Record<string, unknown>;
};

async function loginPost(h: ReturnType<typeof createHarness>, opts: LoginOpts = {}) {
  const { csrf: token, setCookie } = await h.csrf();
  const body: Record<string, unknown> = {
    identifier: opts.identifier ?? "jane",
    password: opts.password ?? PW,
    ...opts.extra,
  };
  if (!opts.omitRecaptcha) body.recaptcha = opts.recaptcha ?? TOK;
  if (opts.client_id !== undefined) body.client_id = opts.client_id;
  if (opts.client_secret !== undefined) body.client_secret = opts.client_secret;
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

function tokenFetches(h: ReturnType<typeof createHarness>) {
  return h.fetches.filter(
    (f) => f.url.includes("/oauth/token") && !f.url.includes("/proxy/oauth/token"),
  );
}

function meFetches(h: ReturnType<typeof createHarness>) {
  return h.fetches.filter((f) => f.url.includes("/wp-json/bsi/v1/me"));
}

function forbiddenIpHeaders(headers: Record<string, string>) {
  for (const k of [
    "authorization",
    "x-api-key",
    "cookie",
    "x-wp-nonce",
    "x-forwarded-for",
    "x-real-ip",
    "true-client-ip",
    "forwarded",
    "cf-connecting-ip",
  ]) {
    expect(headers[k], k).toBeUndefined();
  }
  expect(Object.values(headers).includes(IP)).toBe(false);
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "__fixtures__") continue;
      walkTs(p, out);
    } else if (
      ent.name.endsWith(".ts") &&
      !ent.name.endsWith(".test.ts") &&
      !ent.name.endsWith(".test-d.ts") &&
      !ent.name.includes(".fixture")
    ) {
      out.push(p);
    }
  }
  return out;
}

describe("AU27.1", () => {
  it("AU27.1 password token request shape; client_id from env (CQ D4)", async () => {
    const h = createHarness();
    await loginPost(h, {
      client_id: "EVIL",
      client_secret: "EVIL",
      extra: { scope: "x", remoteip: IP },
    });
    const toks = tokenFetches(h);
    expect(toks.length).toBe(1);
    const f = toks[0]!;
    expect(f.url).toBe(OAUTH_TOKEN_URL);
    expect(f.url.includes("/wp-json")).toBe(false);
    expect(f.url.includes("?")).toBe(false);
    expect(f.method).toBe("POST");
    expect(Object.keys(f.headers).sort()).toStrictEqual([
      "accept",
      "content-type",
      "user-agent",
    ]);
    expect(f.headers.accept).toBe("application/json");
    expect(f.headers["user-agent"]).toBe("metfixhome-worker/1.0");
    expect(f.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    forbiddenIpHeaders(f.headers);

    const form = Object.fromEntries(new URLSearchParams(f.bodyText));
    expect(Object.keys(form).sort()).toEqual([
      "client_id",
      "client_secret",
      "grant_type",
      "password",
      "username",
    ]);
    expect(form).toStrictEqual({
      grant_type: "password",
      username: "jane",
      password: PW,
      client_id: CID,
      client_secret: SECRET_CANARY,
    });
    expect(form.client_id).toBe(h.env.BSI_OAUTH_CLIENT_ID);
    expect(form.client_secret).toBe(h.env.METFIX_ORG_OAUTH_CLIENT_SECRET);
    expect(form).not.toHaveProperty("scope");
    expect(form).not.toHaveProperty("recaptcha_token");
    expect(form).not.toHaveProperty("remoteip");
    expect(h.fetches.filter((x) => x.url.includes("/auth/web-login")).length).toBe(0);
    expect(h.fetches.filter((x) => /\/auth\/login(?:\?|$)/.test(x.url)).length).toBe(0);
  });

  it("AU27.1 upstream 5xx → exactly 1 token request (0 retries)", async () => {
    const h = createHarness({
      oauthToken: () => new Response("boom", { status: 503 }),
    });
    const res = await loginPost(h);
    expect(res.status).toBe(503);
    expect(tokenFetches(h).length).toBe(1);
    expect(meFetches(h).length).toBe(0);
  });
});

describe("AU27.2", () => {
  it("AU27.2 /me headers; session id from /me not token user_id", async () => {
    const h = createHarness({
      oauthToken: () =>
        Response.json({
          access_token: ACCESS1,
          refresh_token: REFRESH1,
          expires_in: 3600,
          user_id: 999,
        }),
      bsiMe: () =>
        Response.json({
          id: 7,
          display_name: "Jane",
          avatar_url: "https://evil.example/a.png",
          can_moderate: true,
        }),
    });
    const { sid, res } = await h.login();
    expect(res.status).toBe(200);
    const meUp = meFetches(h);
    expect(meUp.length).toBe(1);
    expect(meUp[0]!.url).toBe(BSI_ME_URL);
    expect(meUp[0]!.method).toBe("GET");
    expect(Object.keys(meUp[0]!.headers).sort()).toStrictEqual([
      "accept",
      "authorization",
      "user-agent",
      "x-api-key",
    ]);
    expect(meUp[0]!.headers.authorization).toBe(`Bearer ${ACCESS1}`);
    expect(meUp[0]!.headers["x-api-key"]).toBe(KEY);
    expect(meUp[0]!.bodyText).toBe("");
    forbiddenIpHeaders(
      Object.fromEntries(
        Object.entries(meUp[0]!.headers).filter(([k]) => k !== "authorization" && k !== "x-api-key"),
      ),
    );

    const hex = await sidHex(sid);
    const aad = sessionAad(hex);
    const stored = h.sessionNs.getStorage(aad)?.get("rec") as { blob: string };
    const pt = await decryptSessionPayload(stored.blob, aad, ENCKEY);
    const rec = JSON.parse(pt!) as { bsi_user_id?: string; user_public_name?: string };
    expect(rec.bsi_user_id).toBe("7");
    expect(rec.user_public_name).toBe("Jane");
    expect(pt).not.toContain("999");

    const me = await h.call("/api/auth/me", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(sid)}` },
    });
    const meBody = (await me.json()) as Record<string, unknown>;
    expect(meBody.moderator).toBe(true);
    expect(JSON.stringify(meBody)).not.toContain("avatar");
  });

  it("AU27.2 can_moderate coercion and /me failure → 503 no session", async () => {
    for (const bad of ["true", 1, "1", {}, null, undefined] as unknown[]) {
      const h = createHarness({
        bsiMe: () => {
          const body: Record<string, unknown> = { id: 42, display_name: "Jane" };
          if (bad !== undefined) body.can_moderate = bad;
          return Response.json(body);
        },
      });
      const { sid } = await h.login();
      const me = await h.call("/api/auth/me", {
        headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(sid)}` },
      });
      expect((await me.json() as { moderator?: boolean }).moderator).not.toBe(true);
    }

    const hFail = createHarness({
      bsiMe: () => new Response("{}", { status: 401 }),
    });
    const r = await loginPost(hFail);
    expect(r.status).toBe(503);
    expect(await r.json()).toStrictEqual({ error: "unavailable" });
    expect(r.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
    expect(tokenFetches(hFail).length).toBe(1);
    expect(meFetches(hFail).length).toBe(1);
  });
});

describe("AU27.3", () => {
  it("AU27.3 invalid_grant → 401; invalid_client → 503; 429 clamp sample", async () => {
    for (const status of [400, 401]) {
      const h = createHarness({
        oauthToken: () =>
          Response.json(
            { error: "invalid_grant", error_description: `desc-${status}` },
            { status },
          ),
      });
      const res = await loginPost(h, { identifier: `ig-${status}` });
      expect(res.status).toBe(401);
      expect(await res.json()).toStrictEqual({ error: "invalid_login" });
      expect(meFetches(h).length).toBe(0);
    }

    const h2 = createHarness({
      oauthToken: () => Response.json({ error: "invalid_client" }, { status: 401 }),
    });
    const r2 = await loginPost(h2);
    expect(r2.status).toBe(503);
    expect(await r2.json()).toStrictEqual({ error: "unavailable" });
    expect(r2.headers.get("Retry-After")).toBe("60");

    const h3 = createHarness({
      oauthToken: () =>
        new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
          status: 429,
          headers: { "Retry-After": "99999" },
        }),
    });
    const r3 = await loginPost(h3);
    expect(r3.status).toBe(503);
    expect(r3.headers.get("Retry-After")).toBe("600");
  });
});

describe("AU27.4", () => {
  it("AU27.4 siteverify shape + call order config→R8a→R8b→sv→R8c→token→/me", async () => {
    const h = createHarness();
    const order: string[] = [];
    const origId = h.throttleNs.idFromName.bind(h.throttleNs);
    const wrappedId = (name: string) => {
      if (name.startsWith("id:")) order.push("R8a");
      else if (name.startsWith("ip:")) order.push("R8b");
      else if (name === R8C_NAME) {
        // R8c must run after siteverify (M137 takes the slot first).
        expect(h.siteverifyCalls.length).toBeGreaterThanOrEqual(1);
        order.push("R8c");
      }
      return origId(name);
    };
    h.throttleNs.idFromName = wrappedId;
    (h.env.LOGIN_THROTTLE as { idFromName: typeof wrappedId }).idFromName = wrappedId;

    const res = await loginPost(h);
    expect(res.status).toBe(200);

    expect(h.siteverifyCalls.length).toBe(1);
    const sv = h.siteverifyCalls[0]!;
    const svForm = Object.fromEntries(new URLSearchParams(sv.bodyText));
    expect(Object.keys(svForm).sort()).toEqual(["response", "secret"]);
    expect(svForm.secret).toBe(RSECRET);
    expect(svForm.response).toBe(TOK);
    expect(svForm).not.toHaveProperty("remoteip");

    expect(order.filter((x) => x === "R8a").length).toBeGreaterThanOrEqual(1);
    expect(order.filter((x) => x === "R8b").length).toBeGreaterThanOrEqual(1);
    expect(order.filter((x) => x === "R8c").length).toBeGreaterThanOrEqual(1);
    expect(order.indexOf("R8a")).toBeLessThan(order.indexOf("R8b"));
    expect(order.indexOf("R8b")).toBeLessThan(order.indexOf("R8c"));

    const svIdx = h.fetches.findIndex((f) => f.url.includes("siteverify"));
    const tokIdx = h.fetches.findIndex(
      (f) => f.url.includes("/oauth/token") && !f.url.includes("/proxy/"),
    );
    const meIdx = h.fetches.findIndex((f) => f.url.includes("/wp-json/bsi/v1/me"));
    expect(svIdx).toBeGreaterThanOrEqual(0);
    expect(tokIdx).toBeGreaterThan(svIdx);
    expect(meIdx).toBeGreaterThan(tokIdx);

    // Score 0.49 fails; 0.5 proceeds
    const hLow = createHarness({
      siteverify: () =>
        Response.json({ success: true, score: 0.49, action: "login", hostname: "metfix.org" }),
    });
    expect((await loginPost(hLow)).status).toBe(403);
    expect(tokenFetches(hLow).length).toBe(0);

    const hOkScore = createHarness({
      siteverify: () =>
        Response.json({ success: true, score: 0.5, action: "login", hostname: "metfix.org" }),
    });
    expect((await loginPost(hOkScore)).status).toBe(200);
  });

  it("AU27.4 siteverify fail skips token; R8b 20 then R8c", async () => {
    const h = createHarness({
      siteverify: () => Response.json({ success: false }),
    });
    const beforeR8c =
      ((h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[] | undefined) ?? []).length;
    for (let i = 0; i < 5; i++) {
      const res = await loginPost(h, { identifier: `sv${i}` });
      expect(res.status).toBe(403);
      expect(await res.json()).toStrictEqual({ error: "try_again" });
    }
    expect(tokenFetches(h).length).toBe(0);
    const afterR8c =
      ((h.throttleNs.getStorage(R8C_NAME)?.get("global") as number[] | undefined) ?? []).length;
    expect(afterR8c).toBe(beforeR8c);

    const hFlood = createHarness({
      oauthToken: () => Response.json({ error: "invalid_grant" }, { status: 400 }),
    });
    for (let i = 0; i < 20; i++) {
      const res = await loginPost(hFlood, { identifier: `f${i}` });
      expect(res.status).toBe(401);
    }
    expect(hFlood.siteverifyCalls.length).toBe(20);
    expect(tokenFetches(hFlood).length).toBe(20);
    const r21 = await loginPost(hFlood, { identifier: "f20" });
    expect(r21.status).toBe(429);
    expect(tokenFetches(hFlood).length).toBe(20);
    expect(hFlood.siteverifyCalls.length).toBe(20);
  });
});

describe("AU27.5", () => {
  it("AU27.5 missing config → 503 before limiter; auth_config_missing; 0 fetch", async () => {
    const fields: Array<{
      apply: (h: ReturnType<typeof createHarness>) => void;
      name: string;
    }> = [
      {
        name: "BSI_OAUTH_CLIENT_ID",
        apply: (h) => {
          delete h.env.BSI_OAUTH_CLIENT_ID;
        },
      },
      {
        name: "BSI_OAUTH_CLIENT_ID",
        apply: (h) => {
          h.env.BSI_OAUTH_CLIENT_ID = "";
        },
      },
      {
        name: "METFIX_ORG_OAUTH_CLIENT_SECRET",
        apply: (h) => {
          delete h.env.METFIX_ORG_OAUTH_CLIENT_SECRET;
        },
      },
      {
        name: "METFIX_ORG_OAUTH_CLIENT_SECRET",
        apply: (h) => {
          h.env.METFIX_ORG_OAUTH_CLIENT_SECRET = "";
        },
      },
      {
        name: "RECAPTCHA_SECRET",
        apply: (h) => {
          delete h.env.RECAPTCHA_SECRET;
        },
      },
      {
        name: "RECAPTCHA_SECRET",
        apply: (h) => {
          h.env.RECAPTCHA_SECRET = "";
        },
      },
    ];

    for (const field of fields) {
      const h = createHarness();
      field.apply(h);
      const idCalls: string[] = [];
      const orig = h.throttleNs.idFromName.bind(h.throttleNs);
      h.throttleNs.idFromName = (name: string) => {
        idCalls.push(name);
        return orig(name);
      };
      h.env.LOGIN_THROTTLE.idFromName = (name: string) => h.throttleNs.idFromName(name);

      const lines: string[] = [];
      const spy = vi.spyOn(console, "log").mockImplementation((...a) => {
        lines.push(a.map(String).join(" "));
      });
      const nFetch = h.fetches.length;
      try {
        const res = await loginPost(h, { identifier: `cfg-${field.name}` });
        expect(res.status).toBe(503);
        expect(await res.json()).toStrictEqual({ error: "unavailable" });
        expect(res.headers.get("Retry-After")).toBe("60");
        expect(h.fetches.length).toBe(nFetch);
        expect(idCalls.length).toBe(0);
        expect(lines.filter((l) => l.includes("auth_config_missing")).length).toBe(1);
        expect(lines.some((l) => l.includes(field.name))).toBe(true);
        for (const secret of [SECRET_CANARY, CID, PW, RSECRET, KEY]) {
          for (const line of lines) expect(line).not.toContain(secret);
        }
      } finally {
        spy.mockRestore();
      }
    }

    // BSI base URL empty → auth_config_missing BSI_BASE_URL via handleRequest deps
    const hBase = createHarness();
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...a) => {
      lines.push(a.map(String).join(" "));
    });
    const idCalls: string[] = [];
    const orig = hBase.throttleNs.idFromName.bind(hBase.throttleNs);
    hBase.throttleNs.idFromName = (name: string) => {
      idCalls.push(name);
      return orig(name);
    };
    hBase.env.LOGIN_THROTTLE.idFromName = (name: string) => hBase.throttleNs.idFromName(name);
    try {
      const { csrf: token, setCookie } = await hBase.csrf();
      const nFetch = hBase.fetches.length;
      const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
      const res = await handleRequest(
        new Request("https://metfix.org/api/auth/login", {
          method: "POST",
          headers: {
            Origin: ORIGIN,
            "Sec-Fetch-Site": "same-origin",
            "X-CSRF-Token": token,
            "Content-Type": "application/json",
            "CF-Connecting-IP": IP,
            Cookie: setCookie?.split(";")[0] ?? "",
          },
          body: JSON.stringify({ identifier: "jane", password: PW, recaptcha: TOK }),
        }),
        hBase.env,
        ctx,
        {
          fetchImpl: (async (input, init) => {
            // reuse harness fetch by going through recorded path — call login via empty base
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : (input as Request).url;
            hBase.fetches.push({
              url,
              method: (init?.method ?? "GET").toUpperCase(),
              headers: {},
              bodyText: typeof init?.body === "string" ? init.body : "",
            });
            return new Response("{}", { status: 404 });
          }) as FetchImpl,
          cachesDefault: hBase.cache,
          bsiBaseUrl: "",
        },
      );
      expect(res.status).toBe(503);
      expect(await res.json()).toStrictEqual({ error: "unavailable" });
      expect(hBase.fetches.length).toBe(nFetch);
      expect(idCalls.length).toBe(0);
      expect(lines.some((l) => l.includes("auth_config_missing") && l.includes("BSI_BASE_URL"))).toBe(
        true,
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe("AU27.6", () => {
  it("AU27.6 scan secret containment for METFIX_ORG_OAUTH_CLIENT_SECRET", () => {
    const root = join(process.cwd(), "worker");
    const files = walkTs(root);
    const hits: string[] = [];
    for (const abs of files) {
      const rel = abs.replace(process.cwd() + "/", "");
      const src = readFileSync(abs, "utf8");
      if (!src.includes("METFIX_ORG_OAUTH_CLIENT_SECRET")) continue;
      if (rel === "worker/upstream.ts") continue;
      // Session DO Env Pick lists the binding name; runtime reads go through requireAuthConfig.
      if (rel === "worker/do/session.ts") continue;
      hits.push(rel);
    }
    expect(hits, `secret name leaked outside upstream.ts: ${hits.join(", ")}`).toEqual([]);

    const clientRoot = join(process.cwd(), "client");
    for (const abs of walkTs(clientRoot)) {
      const src = readFileSync(abs, "utf8");
      expect(src).not.toContain("METFIX_ORG_OAUTH_CLIENT_SECRET");
      expect(src).not.toMatch(/VITE_[A-Z0-9_]*(OAUTH|SECRET)/);
    }
    const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    // Comment may mention the binding; vars must not define it.
    const varsBlock = wrangler.match(/"vars"\s*:\s*\{[\s\S]*?\}/);
    expect(varsBlock?.[0] ?? "").not.toContain("METFIX_ORG_OAUTH_CLIENT_SECRET");
  });

  it("AU27.6 runtime canary only in oauth/token client_secret", async () => {
    const h = createHarness();
    await loginPost(h);
    const toks = tokenFetches(h);
    expect(toks.length).toBe(1);
    expect(toks[0]!.bodyText).toContain(`client_secret=${encodeURIComponent(SECRET_CANARY)}`);
    for (const f of h.fetches) {
      if (f === toks[0]) continue;
      expect(f.bodyText).not.toContain(SECRET_CANARY);
      expect(JSON.stringify(f.headers)).not.toContain(SECRET_CANARY);
      expect(f.url).not.toContain(SECRET_CANARY);
    }
    const { sid, res } = await h.login();
    const text = await res.clone().text();
    expect(text).not.toContain(SECRET_CANARY);
    expect((res.headers.get("Set-Cookie") ?? "")).not.toContain(SECRET_CANARY);
    void sid;
  });

  it("AU27.6 token error paths never log form body or secret canary", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...a) => {
      lines.push(a.map(String).join(" "));
    });
    const err = vi.spyOn(console, "error").mockImplementation((...a) => {
      lines.push(a.map(String).join(" "));
    });
    try {
      const h = createHarness({
        oauthToken: () =>
          Response.json({ error: "server_error", error_description: "boom" }, { status: 500 }),
      });
      await loginPost(h);
      expect(lines.length).toBeGreaterThanOrEqual(0);
      for (const line of lines) {
        expect(line).not.toContain(SECRET_CANARY);
        expect(line).not.toContain(PW);
        expect(line).not.toContain("grant_type=");
        expect(line).not.toContain("client_secret=");
      }
    } finally {
      spy.mockRestore();
      err.mockRestore();
    }
  });
});

async function patchSession(
  h: ReturnType<typeof createHarness>,
  sid: string,
  fn: (rec: Record<string, unknown>) => void,
) {
  const hex = await sidHex(sid);
  const aad = sessionAad(hex);
  const stor = h.sessionNs.getStorage(aad)!;
  const blob = (stor.get("rec") as { blob: string }).blob;
  const pt = await decryptSessionPayload(blob, aad, ENCKEY);
  const rec = JSON.parse(pt!) as Record<string, unknown>;
  fn(rec);
  stor.set("rec", { blob: await encryptSessionPayload(JSON.stringify(rec), aad, ENCKEY) });
  return rec;
}

describe("AU27.7", () => {
  it("AU27.7 refresh keeps REFRESH1 when omitted; stores REFRESH2 when returned", async () => {
    let phase: "omit" | "rotate" = "omit";
    const h = createHarness({
      oauthToken: async (req) => {
        const form = new URLSearchParams(await req.text());
        if (form.get("grant_type") === "password") {
          return Response.json({
            access_token: ACCESS1,
            refresh_token: REFRESH1,
            expires_in: 3600,
            user_id: 999,
          });
        }
        expect(form.get("grant_type")).toBe("refresh_token");
        expect(form.get("client_id")).toBe(CID);
        expect(form.get("client_secret")).toBe(SECRET_CANARY);
        if (phase === "omit") {
          expect(form.get("refresh_token")).toBe(REFRESH1);
          return Response.json({ access_token: ACCESS2, expires_in: 3600 });
        }
        expect(form.get("refresh_token")).toBe(REFRESH1);
        return Response.json({
          access_token: ACCESS2,
          refresh_token: REFRESH2,
          expires_in: 3600,
        });
      },
      bsiMe: () => Response.json({ id: 42, display_name: "Jane From Me" }),
    });
    const { sid } = await h.login();
    const csrf = await csrfSid(h.env, sid);

    await patchSession(h, sid, (r) => {
      r.access_exp = Date.now() + 10_000;
      r.bsi_refresh = REFRESH1;
    });
    phase = "omit";
    const meBefore = meFetches(h).length;
    await h.call("/api/daily-fix/comments", {
      method: "POST",
      headers: hOk({ sid, csrf }),
      body: JSON.stringify({
        date: "2025-02-10",
        type: "belly",
        content: "hi",
        recaptcha: TOK,
      }),
    });
    expect(meFetches(h).length - meBefore).toBe(1);
    const afterOmit = await patchSession(h, sid, () => {});
    expect(afterOmit.bsi_refresh).toBe(REFRESH1);
    expect(afterOmit.bsi_access).toBe(ACCESS2);
    expect(afterOmit.user_public_name).toBe("Jane From Me");

    await patchSession(h, sid, (r) => {
      r.access_exp = Date.now() + 10_000;
      r.bsi_refresh = REFRESH1;
    });
    phase = "rotate";
    await h.call("/api/daily-fix/comments", {
      method: "POST",
      headers: hOk({ sid, csrf }),
      body: JSON.stringify({
        date: "2025-02-10",
        type: "belly",
        content: "hi2",
        recaptcha: TOK,
      }),
    });
    const afterRot = await patchSession(h, sid, () => {});
    expect(afterRot.bsi_refresh).toBe(REFRESH2);
  });
});
