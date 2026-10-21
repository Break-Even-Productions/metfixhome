/**
 * PR2 Round 1 — Comment write/like gates CW1–CW16 (worker subset).
 * Each `it` title starts with the exact gate ID.
 * Client-only rows (CW10, CW12.*, CW13.2/13.3) are omitted here.
 */
import { describe, expect, it } from "vitest";
import {
  ACCESS1,
  H_OK,
  IP,
  IP2,
  POST_BODY,
  TOK,
  callComments,
  okComment,
  seedSession,
  setupGate,
  useGateHooks,
} from "./auth/comment-write-harness.test";

useGateHooks();

const DATE_Q = "?date=2025-02-10";

describe("PR2 gates CW — comment write/like", () => {
  it("CW1.1 PATCH content trimmed; headers exact; 401 without session", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let upstreamBody = "";
    let upstreamUrl = "";
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      upstreamUrl = String(url);
      upstreamBody = String(init?.body);
      const hdrs = new Headers(init?.headers);
      expect([...hdrs.keys()].map((k) => k.toLowerCase()).sort()).toStrictEqual([
        "accept",
        "authorization",
        "content-type",
        "user-agent",
        "x-api-key",
      ]);
      return Response.json(okComment({ id: 101, content: "edit", timestamp: "t" }));
    });
    const res = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: H_OK(s),
      body: JSON.stringify({ content: "  edit  ", recaptcha: TOK }),
    });
    expect(res?.status).toBe(200);
    expect(upstreamUrl).toBe(
      "https://brokenscience.org/wp-json/metfix/v1/daily-fix/comments/101",
    );
    expect(JSON.parse(upstreamBody)).toStrictEqual({ content: "edit" });

    g.fetchMock.mockClear();
    const out = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: "https://metfix.org" },
      body: JSON.stringify({ content: "x", recaptcha: TOK }),
    });
    expect(out?.status).toBe(401);
    expect(g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length).toBe(
      0,
    );
  });

  it("CW2.1 DELETE upstream path exact, no body; 200 deleted; 401 without session", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let method = "";
    let body: string | undefined;
    let auth = "";
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      method = (init?.method ?? "").toUpperCase();
      body = init?.body != null ? String(init.body) : undefined;
      auth = new Headers(init?.headers).get("Authorization") ?? "";
      expect(String(url)).toBe(
        "https://brokenscience.org/wp-json/metfix/v1/daily-fix/comments/101",
      );
      return Response.json({ deleted: true }, { status: 200 });
    });
    const res = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "DELETE",
      headers: H_OK(s),
    });
    expect(res?.status).toBe(200);
    expect(await res?.json()).toStrictEqual({ deleted: true });
    expect(method).toBe("DELETE");
    expect(body).toBeUndefined();
    expect(auth).toBe(`Bearer ${ACCESS1}`);

    g.fetchMock.mockClear();
    const out = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "DELETE",
      headers: { Origin: "https://metfix.org" },
    });
    expect(out?.status).toBe(401);
    expect(g.fetchMock).toHaveBeenCalledTimes(0);
  });

  it("CW3.1 :id abc/0/0101/11-digit → 404, 0 BSI", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    for (const id of ["abc", "0", "0101", "12345678901"]) {
      g.fetchMock.mockClear();
      const res = await callComments(g, `/api/daily-fix/comments/${id}/like${DATE_Q}`, {
        method: "POST",
        headers: H_OK(s),
        body: JSON.stringify({ liked: true }),
      });
      expect(res?.status).toBe(404);
      expect(g.fetchMock).toHaveBeenCalledTimes(0);
    }
    // Valid id must still send session Bearer (kills key-only like / M-CW13).
    let auth = "";
    g.fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      auth = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json({ liked: true, like_count: 1 });
    });
    await callComments(g, `/api/daily-fix/comments/101/like${DATE_Q}`, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ liked: true }),
    });
    expect(auth).toBe(`Bearer ${ACCESS1}`);
  });

  it("CW4.1 body/query owner fields and Authorization EVIL never reach BSI", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let seenBody = "";
    let auth = "";
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      seenBody = String(init?.body ?? "");
      auth = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json(okComment({ id: 1, content: "h", timestamp: "t" }), { status: 201 });
    });
    await callComments(g, "/api/daily-fix/comments?user_id=9&comment_id=1", {
      method: "POST",
      headers: { ...H_OK(s), Authorization: "Bearer EVIL" },
      body: JSON.stringify({
        ...POST_BODY,
        user_id: 99,
        author: "a",
        owner: "o",
        comment_id: 3,
        id: 4,
      }),
    });
    const parsed = JSON.parse(seenBody) as Record<string, unknown>;
    expect(parsed.user_id).toBeUndefined();
    expect(parsed.author).toBeUndefined();
    expect(parsed.owner).toBeUndefined();
    expect(auth).toBe(`Bearer ${ACCESS1}`);

    // DELETE must also use session Bearer (never key-only / client EVIL).
    auth = "";
    g.fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      auth = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json({ deleted: true }, { status: 200 });
    });
    await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "DELETE",
      headers: { ...H_OK(s), Authorization: "Bearer EVIL" },
    });
    expect(auth).toBe(`Bearer ${ACCESS1}`);
  });

  it("CW5.1 B PATCH → BSI 403 → forbidden; 0 cache.delete", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json({ message: "nope" }, { status: 403 });
    });
    const res = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: H_OK(s),
      body: JSON.stringify({ content: "x", recaptcha: TOK }),
    });
    expect(res?.status).toBe(403);
    expect(await res?.json()).toStrictEqual({ error: "forbidden" });
    expect(g.cache.deletes.length).toBe(0);
  });

  it("CW5.2 B DELETE → BSI 403 forbidden; path from URL id", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let path = "";
    g.fetchMock.mockImplementation(async (url: string) => {
      path = String(url);
      return Response.json({ message: "nope" }, { status: 403 });
    });
    const res = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "DELETE",
      headers: H_OK(s),
      body: JSON.stringify({ comment_id: 999 }),
    });
    expect(path).toContain("/comments/101");
    expect(res?.status).toBe(403);
    expect(await res?.json()).toStrictEqual({ error: "forbidden" });
  });

  it("CW5.3 like uses session Bearer; no session → 401 never key-only", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let auth = "";
    g.fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      auth = new Headers(init?.headers).get("Authorization") ?? "";
      return Response.json({ liked: true, like_count: 1 });
    });
    await callComments(g, `/api/daily-fix/comments/101/like${DATE_Q}`, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ liked: true }),
    });
    expect(auth).toBe(`Bearer ${ACCESS1}`);

    g.fetchMock.mockClear();
    const out = await callComments(g, `/api/daily-fix/comments/101/like${DATE_Q}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://metfix.org" },
      body: JSON.stringify({ liked: true }),
    });
    expect(out?.status).toBe(401);
    expect(g.fetchMock).toHaveBeenCalledTimes(0);
  });

  it("CW6.1 likes 1–30 proceed; 31st → 429; other user/IP allowed", async () => {
    const g = setupGate();
    const s = await seedSession(g, { user_id: "7" });
    g.fetchMock.mockImplementation(async () => Response.json({ liked: true, like_count: 1 }));
    for (let i = 0; i < 30; i++) {
      const res = await callComments(g, `/api/daily-fix/comments/${1000 + i}/like${DATE_Q}`, {
        method: "POST",
        headers: H_OK(s),
        body: JSON.stringify({ liked: true }),
      });
      expect(res?.status).toBe(200);
    }
    const limited = await callComments(g, `/api/daily-fix/comments/2000/like${DATE_Q}`, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ liked: true }),
    });
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBe("60");
    const s2 = await seedSession(g, { user_id: "8" });
    const other = await callComments(g, `/api/daily-fix/comments/2001/like${DATE_Q}`, {
      method: "POST",
      headers: { ...H_OK(s2), "CF-Connecting-IP": IP2 },
      body: JSON.stringify({ liked: true }),
    });
    expect(other?.status).toBe(200);
  });

  it("CW6.2 5th toggle on same comment → 429, 0 BSI", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async () => Response.json({ liked: true, like_count: 1 }));
    for (let i = 0; i < 4; i++) {
      const res = await callComments(g, `/api/daily-fix/comments/101/like${DATE_Q}`, {
        method: "POST",
        headers: H_OK(s),
        body: JSON.stringify({ liked: i % 2 === 0 }),
      });
      expect(res?.status).toBe(200);
    }
    g.fetchMock.mockClear();
    const limited = await callComments(g, `/api/daily-fix/comments/101/like${DATE_Q}`, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ liked: true }),
    });
    expect(limited?.status).toBe(429);
    expect(g.fetchMock).toHaveBeenCalledTimes(0);
  });

  it("CW7.1 signed-in GET no-store Bearer own; anonymous no own/liked cached", async () => {
    const g = setupGate();
    const s = await seedSession(g, { user_id: "42" });
    const fixture = {
      comments: {
        belly: [
          {
            id: 1,
            user: { id: 42, display_name: "A" },
            content: "a",
            timestamp: "t",
            like_count: 0,
            parent_id: null,
            deleted: 0,
            edited: 0,
            liked: true,
            replies: [],
          },
          {
            id: 2,
            user: { id: 42, display_name: "A" },
            content: "b",
            timestamp: "t",
            like_count: 0,
            parent_id: null,
            deleted: 0,
            edited: 0,
            liked: false,
            replies: [],
          },
          {
            id: 3,
            user: { id: 9, display_name: "B" },
            content: "c",
            timestamp: "t",
            like_count: 0,
            parent_id: null,
            deleted: 0,
            edited: 0,
            liked: false,
            replies: [],
          },
        ],
        body: [],
        brain: [],
      },
      meta: {},
    };
    g.fetchMock.mockResolvedValue(Response.json(fixture));
    const signed = await callComments(g, "/api/daily-fix/comments?date=2025-02-10&type=all", {
      headers: { Cookie: `__Host-mfx_sid=${encodeURIComponent(s.sid)}` },
    });
    expect(signed?.headers.get("Cache-Control")).toBe("no-store");
    const hdrs = new Headers((g.fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(hdrs.get("Authorization")).toBe(`Bearer ${ACCESS1}`);
    const body = (await signed?.json()) as {
      comments: { belly: Array<{ own?: boolean; user: { id?: unknown; display_name: string } }> };
    };
    expect(body.comments.belly.map((r) => r.own)).toStrictEqual([true, true, false]);
    expect(JSON.stringify(body)).not.toContain('"id":42');
    expect(JSON.stringify(body)).not.toMatch(/"user":\{[^}]*"id"/);

    g.fetchMock.mockClear();
    g.cache.store.clear();
    g.fetchMock.mockResolvedValue(Response.json(fixture));
    const anon = await callComments(g, "/api/daily-fix/comments?date=2025-02-10&type=all");
    expect(anon?.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60");
    const anonBody = JSON.stringify(await anon?.json());
    expect(anonBody).not.toContain('"own"');
    expect(anonBody).not.toContain('"liked"');
    expect(g.cache.puts.length).toBe(1);
  });

  it("CW8.1 successful PATCH/DELETE/like each purge date key once; failures 0", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      if (String(url).includes("/like")) return Response.json({ liked: true, like_count: 1 });
      if ((init?.method ?? "").toUpperCase() === "DELETE") {
        return Response.json({ deleted: true });
      }
      return Response.json(okComment({ id: 101, content: "e", timestamp: "t" }));
    });

    g.cache.deletes.length = 0;
    await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: H_OK(s),
      body: JSON.stringify({ content: "e", recaptcha: TOK }),
    });
    expect(g.cache.deletes).toStrictEqual([
      "https://cache.metfix.internal/daily-fix/comments?date=2025-02-10",
    ]);

    g.cache.deletes.length = 0;
    await callComments(g, `/api/daily-fix/comments/102${DATE_Q}`, {
      method: "DELETE",
      headers: H_OK(s),
    });
    expect(g.cache.deletes).toStrictEqual([
      "https://cache.metfix.internal/daily-fix/comments?date=2025-02-10",
    ]);

    g.cache.deletes.length = 0;
    await callComments(g, `/api/daily-fix/comments/103/like${DATE_Q}`, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ liked: true }),
    });
    expect(g.cache.deletes).toStrictEqual([
      "https://cache.metfix.internal/daily-fix/comments?date=2025-02-10",
    ]);

    g.cache.deletes.length = 0;
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return new Response("{}", { status: 500 });
    });
    await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: H_OK(s),
      body: JSON.stringify({ content: "e", recaptcha: TOK }),
    });
    expect(g.cache.deletes.length).toBe(0);
  });

  it("CW9.1 PATCH/DELETE/like missing CSRF / wrong Origin / cross-site → 403, 0 limiter", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const cases: Array<{ path: string; method: string; headers: Record<string, string>; body?: string }> =
      [
        {
          path: `/api/daily-fix/comments/101${DATE_Q}`,
          method: "PATCH",
          headers: { ...H_OK(s), "X-CSRF-Token": "" },
          body: JSON.stringify({ content: "x", recaptcha: TOK }),
        },
        {
          path: `/api/daily-fix/comments/101${DATE_Q}`,
          method: "DELETE",
          headers: { ...H_OK(s), Origin: "https://evil.com" },
        },
        {
          path: `/api/daily-fix/comments/101/like${DATE_Q}`,
          method: "POST",
          headers: { ...H_OK(s), "Sec-Fetch-Site": "cross-site" },
          body: JSON.stringify({ liked: true }),
        },
      ];
    for (const c of cases) {
      g.writeLimiter.calls.length = 0;
      g.likeLimiter.calls.length = 0;
      g.toggleLimiter.calls.length = 0;
      g.fetchMock.mockClear();
      const res = await callComments(g, c.path, {
        method: c.method,
        headers: c.headers,
        body: c.body,
      });
      expect(res?.status).toBe(403);
      expect(g.fetchMock).toHaveBeenCalledTimes(0);
      expect(g.writeLimiter.calls.length).toBe(0);
      expect(g.likeLimiter.calls.length).toBe(0);
      expect(g.toggleLimiter.calls.length).toBe(0);
    }
  });

  it("CW11.1 non-moderator BSI 403; moderator BSI 200; Worker makes no own-check", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json({ code: "forbidden" }, { status: 403 });
    });
    const denied = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: H_OK(s),
      body: JSON.stringify({ content: "x", recaptcha: TOK }),
    });
    expect(denied?.status).toBe(403);
    expect(await denied?.json()).toStrictEqual({ error: "forbidden" });
    expect(g.cache.deletes.length).toBe(0);

    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json(okComment({ id: 101, content: "mod", timestamp: "t" }));
    });
    const ok = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: H_OK(s),
      body: JSON.stringify({ content: "mod", recaptcha: TOK }),
    });
    expect(ok?.status).toBe(200);
  });

  it("CW11.2 moderator claim headers/body/cookies not forwarded; BSI 403 → forbidden", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let keys: string[] = [];
    let body = "";
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      const hdrs = new Headers(init?.headers);
      keys = [...hdrs.keys()].map((k) => k.toLowerCase()).sort();
      body = String(init?.body ?? "");
      return Response.json({ code: "forbidden" }, { status: 403 });
    });
    const res = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: {
        ...H_OK(s),
        "X-Moderator": "1",
        "X-Role": "moderator",
        Cookie: `${H_OK(s).Cookie}; mfx_mod=1`,
      },
      body: JSON.stringify({
        content: "x",
        recaptcha: TOK,
        is_moderator: true,
        role: "moderator",
        moderator: true,
      }),
    });
    expect(keys).toStrictEqual([
      "accept",
      "authorization",
      "content-type",
      "user-agent",
      "x-api-key",
    ]);
    expect(JSON.parse(body)).toStrictEqual({ content: "x" });
    expect(res?.status).toBe(403);
  });

  it("CW13.1 BSI 429 Retry-After clamp on POST/PATCH/DELETE/like", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const cases: Array<[string | null, string]> = [
      ["17", "17"],
      ["600", "600"],
      ["99999", "600"],
      ["999999", "600"],
      ["1000000", "600"],
      ["1".repeat(30), "600"],
      ["1".repeat(400), "600"],
      ["0", "1"],
      ["1.5", "60"],
      ["1e30", "60"],
      ["Wed, 21 Oct 2026 07:28:00 GMT", "60"],
      ["abc", "60"],
      [null, "60"],
    ];
    const routes: Array<{
      path: string;
      method: string;
      body?: string;
    }> = [
      {
        path: "/api/daily-fix/comments",
        method: "POST",
        body: JSON.stringify(POST_BODY),
      },
      {
        path: `/api/daily-fix/comments/101${DATE_Q}`,
        method: "PATCH",
        body: JSON.stringify({ content: "x", recaptcha: TOK }),
      },
      { path: `/api/daily-fix/comments/101${DATE_Q}`, method: "DELETE" },
      {
        path: `/api/daily-fix/comments/101/like${DATE_Q}`,
        method: "POST",
        body: JSON.stringify({ liked: true }),
      },
    ];

    for (const route of routes) {
      for (const [raIn, raOut] of cases) {
        g.writeLimiter.calls.length = 0;
        g.writeLimiter.counts.clear();
        g.likeLimiter.counts.clear();
        g.toggleLimiter.counts.clear();
        g.cache.deletes.length = 0;
        g.fetchMock.mockClear();
        g.fetchMock.mockImplementation(async (url: string) => {
          if (String(url).includes("siteverify")) {
            return Response.json({
              success: true,
              score: 0.9,
              action: "comment",
              hostname: "metfix.org",
            });
          }
          const headers = raIn == null ? undefined : { "Retry-After": raIn };
          return new Response("{}", { status: 429, headers });
        });
        const res = await callComments(g, route.path, {
          method: route.method,
          headers: H_OK(s),
          body: route.body,
        });
        expect(res?.status).toBe(429);
        expect(await res?.json()).toStrictEqual({ error: "rate_limited" });
        expect(res?.headers.get("Retry-After")).toBe(raOut);
        expect(g.cache.deletes.length).toBe(0);
        const bsiCalls = g.fetchMock.mock.calls.filter((c) =>
          String(c[0]).includes("brokenscience"),
        );
        expect(bsiCalls.length).toBe(1);
      }
    }
  });

  it("CW14.1 BSI nested-reply refusal → 400 invalid_parent, 1 BSI, 0 retries", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json({ code: "invalid_parent" }, { status: 400 });
    });
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ ...POST_BODY, parent_comment_id: 55 }),
    });
    expect(res?.status).toBe(400);
    expect(await res?.json()).toStrictEqual({ error: "invalid_parent" });
    expect(g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length).toBe(
      1,
    );
  });

  it("CW14.2 BSI like on deleted → 409 comment_deleted, 0 cache.delete", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async () =>
      Response.json({ code: "comment_deleted" }, { status: 409 }),
    );
    const res = await callComments(g, `/api/daily-fix/comments/101/like${DATE_Q}`, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ liked: true }),
    });
    expect(res?.status).toBe(409);
    expect(await res?.json()).toStrictEqual({ error: "comment_deleted" });
    expect(g.cache.deletes.length).toBe(0);
  });

  it("CW15.1 like body exactly {liked:bool}; non-boolean → 400, 0 BSI", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let upstream = "";
    g.fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      upstream = String(init?.body);
      return Response.json({ liked: true, like_count: 1 });
    });
    await callComments(g, `/api/daily-fix/comments/101/like${DATE_Q}`, {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ liked: true }),
    });
    expect(JSON.parse(upstream)).toStrictEqual({ liked: true });

    for (const liked of ["true", 1, null, undefined] as unknown[]) {
      g.fetchMock.mockClear();
      const body =
        liked === undefined ? JSON.stringify({}) : JSON.stringify({ liked });
      const res = await callComments(g, `/api/daily-fix/comments/101/like${DATE_Q}`, {
        method: "POST",
        headers: H_OK(s),
        body,
      });
      expect(res?.status).toBe(400);
      expect(g.fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  it("CW16.1 PATCH deleted comment BSI refusal → 409 comment_deleted, 0 purge", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json({ code: "comment_deleted" }, { status: 409 });
    });
    const res = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "PATCH",
      headers: H_OK(s),
      body: JSON.stringify({ content: "x", recaptcha: TOK }),
    });
    expect(res?.status).toBe(409);
    expect(await res?.json()).toStrictEqual({ error: "comment_deleted" });
    expect(g.cache.deletes.length).toBe(0);
    expect(g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length).toBe(
      1,
    );
  });

  it("CW16.2 DELETE already-deleted BSI 204 → Worker 204; second DELETE also 204", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    const a = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "DELETE",
      headers: H_OK(s),
    });
    expect(a?.status).toBe(204);
    const b = await callComments(g, `/api/daily-fix/comments/101${DATE_Q}`, {
      method: "DELETE",
      headers: H_OK(s),
    });
    expect(b?.status).toBe(204);
    expect(g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length).toBe(
      2,
    );
  });
});
