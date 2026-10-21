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
  CODE,
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
  WP_BRIDGE_CODE,
  createHarness,
  csrfSid,
  googleStart,
  hOk,
  mintGoogleOidcKeys,
  sessKvKey,
  setupAuthHooks,
  sidHex,
  signGoogleIdToken,
  validIdTokenClaims,
} from "../harness/realauth-harness";
import {
  decryptSessionPayload,
  encryptSessionPayload,
  sha256Hex,
} from "../../../worker/auth/crypto";

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
    ]);
    expect(meUp[0]!.headers.authorization).toBe(`Bearer ${ACCESS1}`);
    expect(meUp[0]!.headers["x-api-key"]).toBeUndefined();
    expect(meUp[0]!.bodyText).toBe("");
    forbiddenIpHeaders(
      Object.fromEntries(
        Object.entries(meUp[0]!.headers).filter(([k]) => k !== "authorization"),
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
  it("AU27.3 invalid_grant → 401; non-grant Retry-After 17/600 → 60 on all grants", async () => {
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

    const h429 = createHarness({
      oauthToken: () =>
        new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
          status: 429,
          headers: { "Retry-After": "99999" },
        }),
    });
    const r429 = await loginPost(h429);
    expect(r429.status).toBe(503);
    expect(r429.headers.get("Retry-After")).toBe("600");

    type NonGrant =
      | { error: string; status: number }
      | { error?: undefined; status: number };
    const nonGrants: NonGrant[] = [
      { error: "invalid_client", status: 400 },
      { error: "invalid_client", status: 401 },
      { error: "unauthorized_client", status: 400 },
      { error: "unsupported_grant_type", status: 400 },
      { error: "invalid_request", status: 400 },
      { error: "nope", status: 400 },
      { status: 400 },
    ];
    const upstreamRAs = ["17", "600"] as const;

    function nonGrantResponse(row: NonGrant, ura: string): Response {
      const body =
        row.error === undefined
          ? { error_description: "x" }
          : { error: row.error, error_description: "x" };
      return new Response(JSON.stringify(body), {
        status: row.status,
        headers: { "Content-Type": "application/json", "Retry-After": ura },
      });
    }

    async function expectFixed60(label: string, res: Response) {
      expect(res.status, label).toBe(503);
      expect(await res.json()).toStrictEqual({ error: "unavailable" });
      expect(res.headers.get("Retry-After"), label).toBe("60");
    }

    // Password grant
    for (const row of nonGrants) {
      for (const ura of upstreamRAs) {
        const h = createHarness({
          oauthToken: async () => nonGrantResponse(row, ura),
        });
        await expectFixed60(
          `password ${JSON.stringify(row)} ra=${ura}`,
          await loginPost(h, { identifier: `pw-${row.error ?? "miss"}-${ura}` }),
        );
      }
    }

    // Refresh grant
    for (const row of nonGrants) {
      for (const ura of upstreamRAs) {
        const h = createHarness({
          oauthToken: async (req) => {
            const form = new URLSearchParams(await req.text());
            if (form.get("grant_type") === "password") {
              return Response.json({
                access_token: ACCESS1,
                refresh_token: REFRESH1,
                expires_in: 3600,
              });
            }
            return nonGrantResponse(row, ura);
          },
        });
        const { sid } = await h.login();
        await expireForRefresh(h, sid);
        await expectFixed60(
          `refresh ${JSON.stringify(row)} ra=${ura}`,
          await commentPost(h, sid),
        );
      }
    }

    // authorization_code (Google)
    for (const row of nonGrants) {
      for (const ura of upstreamRAs) {
        const h = createHarness({
          googleEnabled: true,
          oauthToken: async (req) => {
            const form = new URLSearchParams(await req.text());
            if (form.get("grant_type") === "authorization_code") {
              return nonGrantResponse(row, ura);
            }
            return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
          },
        });
        const { res } = await signedGoogleCallback(h);
        await expectFixed60(
          `authorization_code ${JSON.stringify(row)} ra=${ura}`,
          res,
        );
      }
    }
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

async function commentPost(h: ReturnType<typeof createHarness>, sid: string) {
  const csrf = await csrfSid(h.env, sid);
  return h.call("/api/daily-fix/comments", {
    method: "POST",
    headers: hOk({ sid, csrf }),
    body: JSON.stringify({
      date: "2025-02-10",
      type: "belly",
      content: "hi",
      recaptcha: TOK,
    }),
  });
}

function refreshTokenValues(h: ReturnType<typeof createHarness>): string[] {
  return tokenFetches(h)
    .map((f) => Object.fromEntries(new URLSearchParams(f.bodyText)))
    .filter((form) => form.grant_type === "refresh_token")
    .map((form) => form.refresh_token ?? "");
}

function proxyFetches(h: ReturnType<typeof createHarness>) {
  return h.fetches.filter((f) => f.url.includes("/wp-json/metfix/v1/proxy/"));
}

async function signedGoogleCallback(h: ReturnType<typeof createHarness>) {
  const keys = await mintGoogleOidcKeys();
  const { state, preCookie, rec } = await googleStart(h, "intent=login&return=/the-daily-fix");
  expect(rec?.nonce).toBeTruthy();
  const claims = await validIdTokenClaims(h, rec!.nonce, {});
  const idToken = await signGoogleIdToken(keys.privateKey, keys.kid, claims);
  h.installGoogleOidc(keys, idToken);
  const res = await h.call(`/api/auth/google/callback?code=${CODE}&state=${state}`, {
    headers: { Cookie: preCookie },
  });
  return { res, state, preCookie };
}

function expireForRefresh(
  h: ReturnType<typeof createHarness>,
  sid: string,
  refresh = REFRESH1,
) {
  return patchSession(h, sid, (r) => {
    r.access_exp = Date.now() + 10_000;
    r.bsi_refresh = refresh;
    r.bsi_access = ACCESS1;
  });
}

async function sidFromGoogleCallback(h: ReturnType<typeof createHarness>) {
  const { res } = await signedGoogleCallback(h);
  expect(res.status).toBe(302);
  const sidM = (res.headers.get("Set-Cookie") ?? "").match(/__Host-mfx_sid=([^;]+)/);
  const sid = sidM ? decodeURIComponent(sidM[1]!) : "";
  expect(sid.length).toBeGreaterThan(10);
  return sid;
}

describe("AU27.7", () => {
  for (const origin of ["password", "google"] as const) {
    async function sessionFor(h: ReturnType<typeof createHarness>) {
      if (origin === "google") return sidFromGoogleCallback(h);
      const { sid } = await h.login();
      return sid;
    }
    function harnessOpts(
      extra: Parameters<typeof createHarness>[0] = {},
    ): Parameters<typeof createHarness>[0] {
      return origin === "google" ? { googleEnabled: true, ...extra } : extra;
    }

    it(`AU27.7 (a) [${origin}] rotating mock stores ACCESS2/R1; next refresh sends R1; R0 once`, async () => {
      const h = createHarness(harnessOpts({ rotatingRefresh: true }));
      const sid = await sessionFor(h);
      await expireForRefresh(h, sid);

      const meBefore = meFetches(h).length;
      const tokBefore = refreshTokenValues(h).length;
      const res = await commentPost(h, sid);
      expect(res.status).toBe(201);
      expect(meFetches(h).length - meBefore).toBe(1);
      expect(refreshTokenValues(h).length - tokBefore).toBe(1);

      const after = await patchSession(h, sid, () => {});
      expect(after.bsi_access).toBe(ACCESS2);
      expect(after.bsi_refresh).toBe(REFRESH2);

      await expireForRefresh(h, sid, REFRESH2);
      const res2 = await commentPost(h, sid);
      expect(res2.status).toBe(201);
      const rts = refreshTokenValues(h);
      expect(rts.filter((t) => t === REFRESH1).length).toBe(1);
      expect(rts[rts.length - 1]).toBe(REFRESH2);
      expect(proxyFetches(h).length).toBe(0);
    });

    it(`AU27.7 (b) [${origin}] refresh invalid_grant 400/401 → signed_out; DO/KV cleared`, async () => {
      for (const status of [400, 401]) {
        const h = createHarness(
          harnessOpts({
            oauthToken: async (req) => {
              const form = new URLSearchParams(await req.text());
              const grant = form.get("grant_type");
              if (grant === "password" || grant === "authorization_code") {
                return Response.json({
                  access_token: ACCESS1,
                  refresh_token: REFRESH1,
                  expires_in: 3600,
                });
              }
              return Response.json({ error: "invalid_grant" }, { status });
            },
          }),
        );
        const sid = await sessionFor(h);
        const hex = await sidHex(sid);
        const aad = sessionAad(hex);
        await expireForRefresh(h, sid);
        const tokBefore = refreshTokenValues(h).length;

        const acting = await commentPost(h, sid);
        expect(acting.status).toBe(401);
        expect(await acting.json()).toStrictEqual({ error: "signed_out" });
        expect(refreshTokenValues(h).length - tokBefore).toBe(1);

        const me = await h.call("/api/auth/me", {
          headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(sid)}` },
        });
        expect(me.status).toBe(401);
        expect(await me.json()).toStrictEqual({ error: "signed_out" });
        expect(h.sessionNs.getStorage(aad)?.size ?? 0).toBe(0);
        expect(h.sessionNs.getAlarm(aad)).toBeNull();
        expect(await h.kv.get(sessKvKey(hex))).toBeNull();
      }
    });

    it(`AU27.7 (c) [${origin}] refresh 5xx → 503; DO pair unchanged`, async () => {
      const h = createHarness(
        harnessOpts({
          oauthToken: async (req) => {
            const form = new URLSearchParams(await req.text());
            const grant = form.get("grant_type");
            if (grant === "password" || grant === "authorization_code") {
              return Response.json({
                access_token: ACCESS1,
                refresh_token: REFRESH1,
                expires_in: 3600,
              });
            }
            return new Response("boom", { status: 503 });
          },
        }),
      );
      const sid = await sessionFor(h);
      await expireForRefresh(h, sid);
      const before = await patchSession(h, sid, () => {});
      const res = await commentPost(h, sid);
      expect(res.status).toBe(503);
      expect(await res.json()).toStrictEqual({ error: "unavailable" });
      const after = await patchSession(h, sid, () => {});
      expect(after.bsi_access).toBe(before.bsi_access);
      expect(after.bsi_refresh).toBe(before.bsi_refresh);
      expect(after.bsi_access).toBe(ACCESS1);
      expect(after.bsi_refresh).toBe(REFRESH1);
    });

    it(`AU27.7 (d) [${origin}] 200 without refresh_token → 503; DO unchanged`, async () => {
      const h = createHarness(
        harnessOpts({
          oauthToken: async (req) => {
            const form = new URLSearchParams(await req.text());
            const grant = form.get("grant_type");
            if (grant === "password" || grant === "authorization_code") {
              return Response.json({
                access_token: ACCESS1,
                refresh_token: REFRESH1,
                expires_in: 3600,
              });
            }
            return Response.json({ access_token: ACCESS2, expires_in: 3600 });
          },
        }),
      );
      const sid = await sessionFor(h);
      await expireForRefresh(h, sid);
      const before = await patchSession(h, sid, () => {});
      const res = await commentPost(h, sid);
      expect(res.status).toBe(503);
      expect(await res.json()).toStrictEqual({ error: "unavailable" });
      const after = await patchSession(h, sid, () => {});
      expect(after.bsi_access).toBe(before.bsi_access);
      expect(after.bsi_refresh).toBe(before.bsi_refresh);
      expect(after.bsi_refresh).toBe(REFRESH1);
      expect(after.bsi_access).toBe(ACCESS1);
    });

    it(`AU27.7 (e) [${origin}] token 200 then /me 500 → 503; DO holds R1; next sends R1`, async () => {
      let mePhase: "login" | "fail" | "ok" = "login";
      const h = createHarness(
        harnessOpts({
          rotatingRefresh: true,
          bsiMe: async () => {
            if (mePhase === "fail") return new Response("{}", { status: 500 });
            return Response.json({ id: 42, display_name: "Jane" });
          },
        }),
      );
      const sid = await sessionFor(h);
      mePhase = "fail";
      await expireForRefresh(h, sid);
      const res = await commentPost(h, sid);
      expect(res.status).toBe(503);
      expect(await res.json()).toStrictEqual({ error: "unavailable" });
      const kept = await patchSession(h, sid, () => {});
      expect(kept.bsi_refresh).toBe(REFRESH2);
      expect(kept.bsi_access).toBe(ACCESS2);
      expect(refreshTokenValues(h).filter((t) => t === REFRESH1).length).toBe(1);

      await expireForRefresh(h, sid, REFRESH2);
      mePhase = "ok";
      expect((await commentPost(h, sid)).status).toBe(201);
      const rts = refreshTokenValues(h);
      expect(rts.filter((t) => t === REFRESH1).length).toBe(1);
      expect(rts[rts.length - 1]).toBe(REFRESH2);
    });

    it(`AU27.7 (f) [${origin}] token 200 then /me 401 → signed_out; DO/KV cleared`, async () => {
      let mePhase: "login" | "fail" = "login";
      const h = createHarness(
        harnessOpts({
          rotatingRefresh: true,
          bsiMe: async () => {
            if (mePhase === "fail") return new Response("{}", { status: 401 });
            return Response.json({ id: 42, display_name: "Jane" });
          },
        }),
      );
      const sid = await sessionFor(h);
      const hex = await sidHex(sid);
      const aad = sessionAad(hex);
      mePhase = "fail";
      await expireForRefresh(h, sid);
      const tokBefore = refreshTokenValues(h).length;
      const res = await commentPost(h, sid);
      expect(res.status).toBe(401);
      expect(await res.json()).toStrictEqual({ error: "signed_out" });
      expect(h.sessionNs.getStorage(aad)?.size ?? 0).toBe(0);
      expect(await h.kv.get(sessKvKey(hex))).toBeNull();
      expect(refreshTokenValues(h).length - tokBefore).toBe(1);
      expect(
        await (
          await h.call("/api/auth/me", {
            headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(sid)}` },
          })
        ).json(),
      ).toStrictEqual({ error: "signed_out" });
    });
  }
});

describe("AU27.8", () => {
  it("AU27.8 single-flight: 20 concurrent refreshes → 1 token + 1 /me; all ACCESS2", async () => {
    const h = createHarness({ rotatingRefresh: true });
    h.env.COMMENT_WRITE_LIMITER = { async limit() { return { success: true }; } };
    const { sid } = await h.login();
    await expireForRefresh(h, sid);

    const tokBefore = refreshTokenValues(h).length;
    const meBefore = meFetches(h).length;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => commentPost(h, sid)),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(refreshTokenValues(h).length - tokBefore).toBe(1);
    expect(meFetches(h).length - meBefore).toBe(1);
    expect(refreshTokenValues(h).filter((t) => t === REFRESH1).length).toBe(1);

    const bearers = h.fetches
      .filter(
        (f) =>
          f.url.includes("/daily-fix/comments") &&
          f.method === "POST" &&
          (f.headers.authorization ?? "").startsWith("Bearer "),
      )
      .map((f) => f.headers.authorization);
    expect(bearers.length).toBeGreaterThanOrEqual(20);
    expect(bearers.every((a) => a === `Bearer ${ACCESS2}`)).toBe(true);

    const after = await patchSession(h, sid, () => {});
    expect(after.bsi_access).toBe(ACCESS2);
    expect(after.bsi_refresh).toBe(REFRESH2);
  });

  it("AU27.8 failure shared: invalid_grant → 1 token; all 401; DO empty", async () => {
    const h = createHarness({
      oauthToken: async (req) => {
        const form = new URLSearchParams(await req.text());
        if (form.get("grant_type") === "password") {
          return Response.json({
            access_token: ACCESS1,
            refresh_token: REFRESH1,
            expires_in: 3600,
          });
        }
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      },
    });
    h.env.COMMENT_WRITE_LIMITER = { async limit() { return { success: true }; } };
    const { sid } = await h.login();
    const hex = await sidHex(sid);
    const aad = sessionAad(hex);
    await expireForRefresh(h, sid);
    const tokBefore = refreshTokenValues(h).length;

    const results = await Promise.all(
      Array.from({ length: 20 }, () => commentPost(h, sid)),
    );
    expect(results.every((r) => r.status === 401)).toBe(true);
    expect(refreshTokenValues(h).length - tokBefore).toBe(1);
    expect(h.sessionNs.getStorage(aad)?.size ?? 0).toBe(0);
    expect(await h.kv.get(sessKvKey(hex))).toBeNull();
  });

  it("AU27.8 failure shared: refresh 503 → 1 token; all 503; DO unchanged", async () => {
    const h = createHarness({
      oauthToken: async (req) => {
        const form = new URLSearchParams(await req.text());
        if (form.get("grant_type") === "password") {
          return Response.json({
            access_token: ACCESS1,
            refresh_token: REFRESH1,
            expires_in: 3600,
          });
        }
        return new Response("up", { status: 503 });
      },
    });
    h.env.COMMENT_WRITE_LIMITER = { async limit() { return { success: true }; } };
    const { sid } = await h.login();
    await expireForRefresh(h, sid);
    const before = await patchSession(h, sid, () => {});
    const tokBefore = refreshTokenValues(h).length;

    const results = await Promise.all(
      Array.from({ length: 20 }, () => commentPost(h, sid)),
    );
    expect(results.every((r) => r.status === 503)).toBe(true);
    expect(refreshTokenValues(h).length - tokBefore).toBe(1);
    const after = await patchSession(h, sid, () => {});
    expect(after.bsi_access).toBe(before.bsi_access);
    expect(after.bsi_refresh).toBe(before.bsi_refresh);
  });
});

describe("AU27.9", () => {
  it("AU27.9 store-before-/me: DO already holds R1 when /me runs; keep vs end", async () => {
    // Success path: in-handler DO read sees REFRESH2 before /me returns
    {
      let mePhase: "login" | "refresh" = "login";
      let sid = "";
      const h = createHarness({
        rotatingRefresh: true,
        bsiMe: async () => {
          if (mePhase === "refresh") {
            const hex = await sidHex(sid);
            const aad = sessionAad(hex);
            const blob = (h.sessionNs.getStorage(aad)?.get("rec") as { blob: string })?.blob;
            const pt = await decryptSessionPayload(blob!, aad, ENCKEY);
            const rec = JSON.parse(pt!) as { bsi_refresh?: string; bsi_access?: string };
            expect(rec.bsi_refresh).toBe(REFRESH2);
            expect(rec.bsi_refresh).not.toBe(REFRESH1);
            expect(rec.bsi_access).toBe(ACCESS2);
          }
          return Response.json({ id: 42, display_name: "Jane" });
        },
      });
      const login = await h.login();
      sid = login.sid;
      mePhase = "refresh";
      await expireForRefresh(h, sid);
      expect((await commentPost(h, sid)).status).toBe(201);
      expect(refreshTokenValues(h).filter((t) => t === REFRESH1).length).toBe(1);
    }

    // /me non-401 failures → 503, keep ACCESS2/R1; never reuse R0
    for (const fail of [
      () => new Response("{}", { status: 500 }),
      () => new Response("{}", { status: 403 }),
      () => Response.json({ id: "7", display_name: "Jane" }),
      () => Response.json({ display_name: "Jane" }),
      () =>
        new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ]) {
      let mePhase: "login" | "fail" | "ok" = "login";
      let sidFail = "";
      const hFail = createHarness({
        rotatingRefresh: true,
        bsiMe: async () => {
          if (mePhase === "fail" || mePhase === "ok") {
            const hex = await sidHex(sidFail);
            const aad = sessionAad(hex);
            const blob = (hFail.sessionNs.getStorage(aad)?.get("rec") as { blob: string })?.blob;
            const pt = await decryptSessionPayload(blob!, aad, ENCKEY);
            const rec = JSON.parse(pt!) as { bsi_refresh?: string };
            expect(rec.bsi_refresh).toBe(REFRESH2);
            expect(rec.bsi_refresh).not.toBe(REFRESH1);
          }
          if (mePhase === "fail") return fail();
          return Response.json({ id: 42, display_name: "Jane" });
        },
      });
      const loginFail = await hFail.login();
      sidFail = loginFail.sid;
      mePhase = "fail";
      await expireForRefresh(hFail, sidFail);
      const res = await commentPost(hFail, sidFail);
      expect(res.status).toBe(503);
      expect(await res.json()).toStrictEqual({ error: "unavailable" });
      const kept = await patchSession(hFail, sidFail, () => {});
      expect(kept.bsi_refresh).toBe(REFRESH2);
      expect(kept.bsi_access).toBe(ACCESS2);
      expect(refreshTokenValues(hFail).filter((t) => t === REFRESH1).length).toBe(1);

      await expireForRefresh(hFail, sidFail, REFRESH2);
      mePhase = "ok";
      expect((await commentPost(hFail, sidFail)).status).toBe(201);
      const rts = refreshTokenValues(hFail);
      expect(rts.filter((t) => t === REFRESH1).length).toBe(1);
      expect(rts[rts.length - 1]).toBe(REFRESH2);
    }

    // /me 401 → end session; 0 further token POSTs
    {
      let mePhase: "login" | "fail" = "login";
      let sid401 = "";
      const h401 = createHarness({
        rotatingRefresh: true,
        bsiMe: async () => {
          if (mePhase === "fail") {
            const hex = await sidHex(sid401);
            const aad = sessionAad(hex);
            const blob = (h401.sessionNs.getStorage(aad)?.get("rec") as { blob: string })?.blob;
            const pt = await decryptSessionPayload(blob!, aad, ENCKEY);
            expect(JSON.parse(pt!).bsi_refresh).toBe(REFRESH2);
            return new Response("{}", { status: 401 });
          }
          return Response.json({ id: 42, display_name: "Jane" });
        },
      });
      const l = await h401.login();
      sid401 = l.sid;
      const hex = await sidHex(sid401);
      const aad = sessionAad(hex);
      mePhase = "fail";
      await expireForRefresh(h401, sid401);
      const tokBefore = refreshTokenValues(h401).length;
      const res = await commentPost(h401, sid401);
      expect(res.status).toBe(401);
      expect(await res.json()).toStrictEqual({ error: "signed_out" });
      expect(h401.sessionNs.getStorage(aad)?.size ?? 0).toBe(0);
      expect(await h401.kv.get(sessKvKey(hex))).toBeNull();
      expect(
        await (
          await h401.call("/api/auth/me", {
            headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(sid401)}` },
          })
        ).json(),
      ).toStrictEqual({ error: "signed_out" });

      const nFetch = h401.fetches.length;
      for (let i = 0; i < 3; i++) {
        expect((await commentPost(h401, sid401)).status).toBe(401);
      }
      expect(h401.fetches.length).toBe(nFetch);
      expect(refreshTokenValues(h401).length - tokBefore).toBe(1);
    }
  });
});

describe("AU27.10", () => {
  it("AU27.10 (a) Google code exchange: 5-key /oauth/token; 0 proxy; /me Bearer ACCESS1", async () => {
    const h = createHarness({ googleEnabled: true });
    const { res } = await signedGoogleCallback(h);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/the-daily-fix");
    expect(res.headers.get("Set-Cookie") ?? "").toMatch(/__Host-mfx_sid=/);

    expect(proxyFetches(h).length).toBe(0);
    // No x-api-key on /oauth/token or /me (social/bridge may still use the API key).
    for (const f of [...tokenFetches(h), ...meFetches(h)]) {
      expect(f.headers["x-api-key"]).toBeUndefined();
    }

    const codeToks = tokenFetches(h).filter((f) => {
      const form = Object.fromEntries(new URLSearchParams(f.bodyText));
      return form.grant_type === "authorization_code";
    });
    expect(codeToks.length).toBe(1);
    expect(codeToks[0]!.url).toBe(OAUTH_TOKEN_URL);
    expect(Object.keys(codeToks[0]!.headers).sort()).toStrictEqual([
      "accept",
      "content-type",
      "user-agent",
    ]);
    const form = Object.fromEntries(new URLSearchParams(codeToks[0]!.bodyText));
    expect(form).toStrictEqual({
      grant_type: "authorization_code",
      code: WP_BRIDGE_CODE,
      redirect_uri: "https://metfix.org/api/auth/callback",
      client_id: CID,
      client_secret: SECRET_CANARY,
    });
    expect(Object.keys(form).sort()).toStrictEqual([
      "client_id",
      "client_secret",
      "code",
      "grant_type",
      "redirect_uri",
    ]);

    const mes = meFetches(h);
    expect(mes.length).toBe(1);
    expect(mes[0]!.headers.authorization).toBe(`Bearer ${ACCESS1}`);
    expect(mes[0]!.headers["x-api-key"]).toBeUndefined();
    expect(Object.keys(mes[0]!.headers).sort()).toStrictEqual([
      "accept",
      "authorization",
      "user-agent",
    ]);

    const text = await res.clone().text();
    expect(text).not.toContain(SECRET_CANARY);
    expect(text).not.toContain(ACCESS1);
    expect(text).not.toContain(REFRESH1);
  });

  it("AU27.10 (b) authorization_code invalid_grant → 401 invalid_login (byte-identical to password)", async () => {
    const hPw = createHarness({
      oauthToken: () => Response.json({ error: "invalid_grant" }, { status: 400 }),
    });
    const pwRes = await loginPost(hPw);
    expect(pwRes.status).toBe(401);
    const pwBody = await pwRes.text();
    expect(JSON.parse(pwBody)).toStrictEqual({ error: "invalid_login" });

    for (const status of [400, 401]) {
      const h = createHarness({
        googleEnabled: true,
        oauthToken: async (req) => {
          const form = new URLSearchParams(await req.text());
          if (form.get("grant_type") === "authorization_code") {
            return Response.json({ error: "invalid_grant" }, { status });
          }
          return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
        },
      });
      const { res } = await signedGoogleCallback(h);
      expect(res.status).toBe(401);
      const body = await res.text();
      expect(body).toBe(pwBody);
      expect(meFetches(h).length).toBe(0);
      expect(proxyFetches(h).length).toBe(0);
      expect(tokenFetches(h).length).toBe(1);
      expect(res.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
    }

    // Non-grant codes: fixed Retry-After 60 (never upstream) — kills M-DT12.
    for (const ura of ["17", "600"] as const) {
      const h = createHarness({
        googleEnabled: true,
        oauthToken: async (req) => {
          const form = new URLSearchParams(await req.text());
          if (form.get("grant_type") === "authorization_code") {
            return new Response(JSON.stringify({ error: "invalid_client" }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Retry-After": ura },
            });
          }
          return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
        },
      });
      const { res } = await signedGoogleCallback(h);
      expect(res.status).toBe(503);
      expect(await res.json()).toStrictEqual({ error: "unavailable" });
      expect(res.headers.get("Retry-After")).toBe("60");
      expect(meFetches(h).length).toBe(0);
      expect(tokenFetches(h).length).toBe(1);
      expect(res.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
    }
  });

  it("AU27.10 (c) Google session refresh: rotating R0→ACCESS2/R1; in-handler DO has R1; 0 proxy", async () => {
    let mePhase: "login" | "refresh" = "login";
    let sid = "";
    const h = createHarness({
      googleEnabled: true,
      rotatingRefresh: true,
      bsiMe: async () => {
        if (mePhase === "refresh") {
          const hex = await sidHex(sid);
          const aad = sessionAad(hex);
          const blob = (h.sessionNs.getStorage(aad)?.get("rec") as { blob: string })?.blob;
          const pt = await decryptSessionPayload(blob!, aad, ENCKEY);
          const rec = JSON.parse(pt!) as { bsi_refresh?: string; bsi_access?: string };
          expect(rec.bsi_refresh).toBe(REFRESH2);
          expect(rec.bsi_refresh).not.toBe(REFRESH1);
          expect(rec.bsi_access).toBe(ACCESS2);
        }
        return Response.json({ id: 42, display_name: "Jane" });
      },
    });
    sid = await sidFromGoogleCallback(h);
    mePhase = "refresh";
    await expireForRefresh(h, sid);
    const tokBefore = refreshTokenValues(h).length;
    expect((await commentPost(h, sid)).status).toBe(201);
    expect(refreshTokenValues(h).length - tokBefore).toBe(1);
    expect(refreshTokenValues(h).filter((t) => t === REFRESH1).length).toBe(1);

    const form = Object.fromEntries(
      new URLSearchParams(
        tokenFetches(h).filter((f) => {
          const g = Object.fromEntries(new URLSearchParams(f.bodyText));
          return g.grant_type === "refresh_token";
        })[0]!.bodyText,
      ),
    );
    expect(form).toStrictEqual({
      grant_type: "refresh_token",
      refresh_token: REFRESH1,
      client_id: CID,
      client_secret: SECRET_CANARY,
    });
    expect(proxyFetches(h).length).toBe(0);

    await expireForRefresh(h, sid, REFRESH2);
    expect((await commentPost(h, sid)).status).toBe(201);
    expect(refreshTokenValues(h).filter((t) => t === REFRESH1).length).toBe(1);
    expect(refreshTokenValues(h).at(-1)).toBe(REFRESH2);
  });

  it("AU27.10 (d) bridge state wrong/missing → 0 token; matching once; replay fails", async () => {
    async function bridgeStateFromSocial(h: ReturnType<typeof createHarness>) {
      const social = h.fetches.find((f) => f.url.includes("/auth/social"));
      expect(social).toBeTruthy();
      const body = JSON.parse(social!.bodyText) as { state?: string };
      expect(typeof body.state).toBe("string");
      return body.state!;
    }

    // Wrong Location state
    {
      const h = createHarness({ googleEnabled: true });
      h.edges.bridge = async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: `https://metfix.org/api/auth/callback?code=${WP_BRIDGE_CODE}&state=wrong_bridge_state`,
          },
        });
      const tokBefore = tokenFetches(h).length;
      const meBefore = meFetches(h).length;
      const { res, state, preCookie } = await signedGoogleCallback(h);
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/?auth_error=state");
      expect(res.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
      expect(tokenFetches(h).length - tokBefore).toBe(0);
      expect(meFetches(h).length - meBefore).toBe(0);
      // Bridge state was consumed (take before compare).
      const bridgeSt = await bridgeStateFromSocial(h);
      const name = `oauth:${await sha256Hex(bridgeSt)}`;
      expect(h.oauthNs.getStorage(name)?.get("rec")).toBeUndefined();
      void state;
      void preCookie;
    }

    // Missing Location state
    {
      const h = createHarness({ googleEnabled: true });
      h.edges.bridge = async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: `https://metfix.org/api/auth/callback?code=${WP_BRIDGE_CODE}`,
          },
        });
      const tokBefore = tokenFetches(h).length;
      const meBefore = meFetches(h).length;
      const { res } = await signedGoogleCallback(h);
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/?auth_error=state");
      expect(res.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
      expect(tokenFetches(h).length - tokBefore).toBe(0);
      expect(meFetches(h).length - meBefore).toBe(0);
    }

    // Matching state succeeds once; replay of Google state fails with 0 new token calls
    {
      const h = createHarness({ googleEnabled: true });
      const first = await signedGoogleCallback(h);
      expect(first.res.status).toBe(302);
      expect(first.res.headers.get("Location")).toBe("/the-daily-fix");
      expect(first.res.headers.get("Set-Cookie") ?? "").toMatch(/__Host-mfx_sid=/);
      expect(
        tokenFetches(h).filter((f) => {
          const form = Object.fromEntries(new URLSearchParams(f.bodyText));
          return form.grant_type === "authorization_code";
        }).length,
      ).toBe(1);
      expect(meFetches(h).length).toBe(1);

      const tokN = tokenFetches(h).length;
      const meN = meFetches(h).length;
      const replay = await h.call(
        `/api/auth/google/callback?code=${CODE}&state=${first.state}`,
        { headers: { Cookie: first.preCookie } },
      );
      expect(replay.status).toBe(302);
      expect(replay.headers.get("Location")).toBe("/?auth_error=state");
      expect(replay.headers.get("Set-Cookie") ?? "").not.toMatch(/__Host-mfx_sid=/);
      expect(tokenFetches(h).length).toBe(tokN);
      expect(meFetches(h).length).toBe(meN);
    }

  });
});

describe("AU27.Q1", () => {
  it("AU27.Q1 refresh invalid_grant → 1 token POST; 5 further calls → 0 more token POSTs", async () => {
    for (const status of [400, 401]) {
      const h = createHarness({
        oauthToken: async (req) => {
          const form = new URLSearchParams(await req.text());
          if (form.get("grant_type") === "password") {
            return Response.json({
              access_token: ACCESS1,
              refresh_token: REFRESH1,
              expires_in: 3600,
            });
          }
          return Response.json({ error: "invalid_grant" }, { status });
        },
      });
      const { sid } = await h.login();
      const hex = await sidHex(sid);
      const aad = sessionAad(hex);
      await expireForRefresh(h, sid);

      const first = await commentPost(h, sid);
      expect(first.status).toBe(401);
      expect(await first.json()).toStrictEqual({ error: "signed_out" });
      expect(refreshTokenValues(h).length).toBe(1);
      expect(h.sessionNs.getStorage(aad)?.size ?? 0).toBe(0);
      expect(h.sessionNs.getAlarm(aad)).toBeNull();
      expect(await h.kv.get(sessKvKey(hex))).toBeNull();

      const nFetch = h.fetches.length;
      for (let i = 0; i < 5; i++) {
        const r = await commentPost(h, sid);
        expect(r.status).toBe(401);
        expect(await r.json()).toStrictEqual({ error: "signed_out" });
      }
      expect(h.fetches.length).toBe(nFetch);
      expect(refreshTokenValues(h).length).toBe(1);
      // password (1) + refresh (1) = 2 total token POSTs; no further refresh
      expect(tokenFetches(h).length).toBe(2);

      const me = await h.call("/api/auth/me", {
        headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(sid)}` },
      });
      expect(me.status).toBe(401);
      expect(await me.json()).toStrictEqual({ error: "signed_out" });
    }
  });
});
