/**
 * PR2 Round 1 — Comment POST gates P1–P9 (worker).
 * Each `it` title starts with the exact gate ID.
 */
import { describe, expect, it } from "vitest";
import {
  ACCESS1,
  H_OK,
  IP,
  IP2,
  POST_BODY,
  callComments,
  destroySession,
  mockSiteverifyPass,
  okComment,
  seedSession,
  setupGate,
  useGateHooks,
} from "../harness/comment-write-harness";

useGateHooks();

describe("PR2 gates P — comment POST", () => {
  it("P1.1 POST with session + recaptcha + BSI 201 → shaped 201 Member; limiter→siteverify→BSI", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockSiteverifyPass(g);
    const order: string[] = [];
    const origLimit = g.writeLimiter.limit.bind(g.writeLimiter);
    g.writeLimiter.limit = async (opts) => {
      order.push("limiter");
      return origLimit(opts);
    };
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("siteverify")) {
        order.push("siteverify");
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      if (u.includes("brokenscience") && (init?.method ?? "GET").toUpperCase() === "POST") {
        order.push("bsi");
        return Response.json(okComment(), { status: 201 });
      }
      return new Response("{}", { status: 404 });
    });
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(201);
    expect(await res?.json()).toStrictEqual({
      comment: {
        id: 9,
        user: { display_name: "Member" },
        content: "hello",
        timestamp: "2025-02-10T12:00:00Z",
        parent_id: null,
        like_count: 0,
        deleted: 0,
        edited: 0,
        replies: [],
      },
    });
    expect(order).toEqual(["limiter", "siteverify", "bsi"]);
    expect(order.indexOf("limiter")).toBeLessThan(order.indexOf("siteverify"));
    expect(order.indexOf("siteverify")).toBeLessThan(order.indexOf("bsi"));
    expect(g.writeLimiter.calls.some((k) => k.startsWith("write:"))).toBe(true);
  });

  it("P1.2 BSI 201 missing id → 503 unavailable Retry-After 300, 0 cache.delete", async () => {
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
      return Response.json({ comment: { content: "x", timestamp: "t" } }, { status: 201 });
    });
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(503);
    expect(await res?.json()).toStrictEqual({ error: "unavailable" });
    expect(res?.headers.get("Retry-After")).toBe("300");
    expect(g.cache.deletes.length).toBe(0);
  });

  it("P3.1 POST strips extra fields; content trimmed in upstream body", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let upstreamBody = "";
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      upstreamBody = String(init?.body);
      return Response.json(okComment({ content: "hi", id: 1 }), { status: 201 });
    });
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({
        ...POST_BODY,
        content: "  hi  ",
        user_id: 99,
        author: "admin",
        id: 5,
        _method: "DELETE",
        status: "approved",
        url: "https://evil",
      }),
    });
    const parsed = JSON.parse(upstreamBody) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toStrictEqual(["content", "date", "type"]);
    expect(parsed.content).toBe("hi");
  });

  it("P3.2 content empty/whitespace/2001 code points → 400; 2000 astral ok", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    for (const content of ["", "   ", "x".repeat(2001)]) {
      g.fetchMock.mockClear();
      const res = await callComments(g, "/api/daily-fix/comments", {
        method: "POST",
        headers: H_OK(s),
        body: JSON.stringify({ ...POST_BODY, content }),
      });
      expect(res?.status).toBe(400);
      expect(await res?.json()).toStrictEqual({ error: "invalid_request" });
      expect(
        g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length,
      ).toBe(0);
    }
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json(okComment({ content: "😀".repeat(2000), id: 1 }), { status: 201 });
    });
    const ok = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ ...POST_BODY, content: "😀".repeat(2000) }),
    });
    expect(ok?.status).toBe(201);
  });

  it("P3.3 body >8192 bytes → 413 payload_too_large; 8192 not 413", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const oversized = JSON.stringify({ ...POST_BODY, content: "x".repeat(9000) });
    expect(oversized.length).toBeGreaterThan(8192);
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s), "Content-Length": String(oversized.length) },
      body: oversized,
    });
    expect(res?.status).toBe(413);
    expect(await res?.json()).toStrictEqual({ error: "payload_too_large" });
    expect(g.fetchMock).toHaveBeenCalledTimes(0);

    // Build a valid JSON body of exactly 8192 bytes.
    const prefix = `{"date":"2025-02-10","type":"belly","content":"`;
    const suffix = `","recaptcha":"${POST_BODY.recaptcha}"}`;
    const contentLen = 8192 - prefix.length - suffix.length;
    const exact = prefix + "y".repeat(contentLen) + suffix;
    expect(exact.length).toBe(8192);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json(okComment({ id: 1, content: "y", timestamp: "t" }), { status: 201 });
    });
    const res2 = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s), "Content-Length": "8192" },
      body: exact,
    });
    expect(res2?.status).not.toBe(413);
  });

  it("P3.4 wrong Content-Type → 415 unsupported_media_type", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    for (const ct of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      const res = await callComments(g, "/api/daily-fix/comments", {
        method: "POST",
        headers: { ...H_OK(s), "Content-Type": ct },
        body: "x",
      });
      expect(res?.status).toBe(415);
      expect(await res?.json()).toStrictEqual({ error: "unsupported_media_type" });
    }
    const { "Content-Type": _ct, ...noCt } = H_OK(s);
    const missing = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: noCt,
      body: "{}",
    });
    expect(missing?.status).toBe(415);
  });

  it("P3.5 malformed JSON and invalid fields → 400 invalid_request", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const cases = [
      "{",
      "[]",
      JSON.stringify({ ...POST_BODY, type: "all" }),
      JSON.stringify({ ...POST_BODY, date: "bad" }),
      JSON.stringify({ ...POST_BODY, parent_comment_id: 0 }),
      JSON.stringify({ ...POST_BODY, parent_comment_id: -1 }),
      JSON.stringify({ ...POST_BODY, parent_comment_id: "1 OR 1=1" }),
      JSON.stringify({ ...POST_BODY, parent_comment_id: 1.5 }),
      JSON.stringify({ date: POST_BODY.date, type: POST_BODY.type, recaptcha: "t" }),
    ];
    for (const body of cases) {
      g.fetchMock.mockClear();
      const res = await callComments(g, "/api/daily-fix/comments", {
        method: "POST",
        headers: H_OK(s),
        body,
      });
      expect(res?.status).toBe(400);
      expect(await res?.json()).toStrictEqual({ error: "invalid_request" });
      expect(
        g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length,
      ).toBe(0);
    }
  });

  it("P4.1 logged out POST → 401 signed_out, 0 upstream siteverify and limiter", async () => {
    const g = setupGate();
    g.writeLimiter.calls.length = 0;
    g.likeLimiter.calls.length = 0;
    g.toggleLimiter.calls.length = 0;
    const headers = { "Content-Type": "application/json", Origin: "https://metfix.org" };

    const write = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers,
      body: JSON.stringify(POST_BODY),
    });
    expect(write?.status).toBe(401);
    expect(await write?.json()).toStrictEqual({ error: "signed_out" });

    const like = await callComments(g, "/api/daily-fix/comments/101/like?date=2025-02-10", {
      method: "POST",
      headers,
      body: JSON.stringify({ liked: true, date: "2025-02-10" }),
    });
    expect(like?.status).toBe(401);
    expect(await like?.json()).toStrictEqual({ error: "signed_out" });

    // Toggle uses the same like route with liked:false (COMMENT_LIKE_TOGGLE_LIMITER).
    const toggle = await callComments(g, "/api/daily-fix/comments/101/like?date=2025-02-10", {
      method: "POST",
      headers,
      body: JSON.stringify({ liked: false, date: "2025-02-10" }),
    });
    expect(toggle?.status).toBe(401);
    expect(await toggle?.json()).toStrictEqual({ error: "signed_out" });

    expect(g.fetchMock).toHaveBeenCalledTimes(0);
    expect(g.writeLimiter.calls.length).toBe(0);
    expect(g.likeLimiter.calls.length).toBe(0);
    expect(g.toggleLimiter.calls.length).toBe(0);
  });

  it("P4.2 bad session cookie → 401 signed_out clears cookie", async () => {
    const g = setupGate();
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: {
        ...H_OK({ sid: "bad", csrf: "x" }),
        Cookie: "__Host-mfx_sid=not-a-real-session",
      },
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(401);
    expect(res?.headers.get("Set-Cookie")).toContain("__Host-mfx_sid=");
  });

  it("P4.3 upstream write headers include Bearer ACCESS1 only", async () => {
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
      const hdrs = new Headers(init?.headers);
      const keys = [...hdrs.keys()].map((k) => k.toLowerCase()).sort();
      expect(keys).toStrictEqual([
        "accept",
        "authorization",
        "content-type",
        "user-agent",
        "x-api-key",
      ]);
      expect(hdrs.get("Authorization")).toBe(`Bearer ${ACCESS1}`);
      return Response.json(okComment({ id: 1, content: "h", timestamp: "t" }), { status: 201 });
    });
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s), Authorization: "Bearer EVIL" },
      body: JSON.stringify({ ...POST_BODY, user_id: 99 }),
    });
  });

  it("P4.4 signed-in GET uses session Bearer; client Authorization ignored", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockResolvedValue(
      Response.json({ comments: { belly: [], body: [], brain: [] }, meta: {} }),
    );
    await callComments(g, "/api/daily-fix/comments?date=2025-02-10&type=all", {
      headers: {
        Cookie: `__Host-mfx_sid=${s.sid}`,
        Authorization: "Bearer EVIL",
      },
    });
    const init = g.fetchMock.mock.calls[0]?.[1] as RequestInit;
    const hdrs = new Headers(init.headers);
    expect(hdrs.get("Authorization")).toBe(`Bearer ${ACCESS1}`);
  });

  it("P4.5 empty access token at login → 503 unavailable, no session for POST", async () => {
    const g = setupGate();
    const seeded = await seedSession(g, { access_token: "" });
    expect(seeded.loginStatus).toBe(503);
    expect(seeded.sid).toBe("");
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: {
        Origin: "https://metfix.org",
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(401);
    expect(await res?.json()).toStrictEqual({ error: "signed_out" });
  });

  it("P5.1 POST upstream URL fixed comments path, method POST", async () => {
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
      expect(String(url)).toBe(
        "https://brokenscience.org/wp-json/metfix/v1/daily-fix/comments",
      );
      expect(init?.method).toBe("POST");
      return Response.json(okComment({ id: 1, content: "h", timestamp: "t" }), { status: 201 });
    });
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: {
        ...H_OK(s),
        "X-Forwarded-Host": "evil",
        "X-HTTP-Method-Override": "DELETE",
      },
      body: JSON.stringify({ ...POST_BODY, path: "/wp/v2/users" }),
    });
  });

  it("P7.1 successful POST cache.delete once; failed POST no delete", async () => {
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
      return Response.json(okComment({ id: 1, content: "h", timestamp: "t" }), { status: 201 });
    });
    const ok = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(ok?.headers.get("Cache-Control")).toBe("no-store");
    expect(g.cache.deletes).toStrictEqual([
      "https://cache.metfix.internal/daily-fix/comments?date=2025-02-10",
    ]);
    expect(g.cache.puts.length).toBe(0);
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
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(g.cache.deletes.length).toBe(0);
  });

  it("P8.1 sixth POST in 60s → 429 rate_limited, limiter key user:ip", async () => {
    const g = setupGate();
    const s = await seedSession(g, { user_id: "7" });
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json(okComment({ id: 1, content: "h", timestamp: "t" }), { status: 201 });
    });
    for (let i = 0; i < 5; i++) {
      const res = await callComments(g, "/api/daily-fix/comments", {
        method: "POST",
        headers: H_OK(s),
        body: JSON.stringify(POST_BODY),
      });
      expect(res?.status).toBe(201);
    }
    const limited = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(limited?.status).toBe(429);
    expect(await limited?.json()).toStrictEqual({ error: "rate_limited" });
    expect(limited?.headers.get("Retry-After")).toBe("60");
    expect(g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("siteverify")).length).toBe(
      5,
    );
    expect(g.writeLimiter.calls.some((k) => k === `write:7:${IP}`)).toBe(true);
    const s2 = await seedSession(g, { user_id: "8", ip: IP2 });
    // Re-arm BSI mock after seedSession login traffic.
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      return Response.json(okComment({ id: 2, content: "h", timestamp: "t" }), { status: 201 });
    });
    const otherIp = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s2), "CF-Connecting-IP": IP2 },
      body: JSON.stringify(POST_BODY),
    });
    expect(otherIp?.status).toBe(201);
  });

  it("P8.2 CSRF fail and logged out skip limiter", async () => {
    const g = setupGate();
    g.writeLimiter.calls.length = 0;
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(POST_BODY),
    });
    expect(g.writeLimiter.calls.length).toBe(0);
    const s = await seedSession(g);
    g.writeLimiter.calls.length = 0;
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s), "X-CSRF-Token": "wrong" },
      body: JSON.stringify(POST_BODY),
    });
    expect(g.writeLimiter.calls.length).toBe(0);
  });

  it("P9.1 six concurrent POSTs → five BSI, one 429", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    let bsi = 0;
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return Response.json({
          success: true,
          score: 0.9,
          action: "comment",
          hostname: "metfix.org",
        });
      }
      bsi++;
      return Response.json(okComment({ id: bsi, content: "h", timestamp: "t" }), { status: 201 });
    });
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        callComments(g, "/api/daily-fix/comments", {
          method: "POST",
          headers: H_OK(s),
          body: JSON.stringify(POST_BODY),
        }),
      ),
    );
    const statuses = results.map((r) => r?.status);
    expect(statuses.filter((st) => st === 201).length).toBe(5);
    expect(statuses.filter((st) => st === 429).length).toBe(1);
    expect(bsi).toBe(5);
  });

  it("P9.2 replay after logout → 401 NW", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    await destroySession(g, s.sid);
    g.fetchMock.mockClear();
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(401);
    expect(g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length).toBe(
      0,
    );
  });

  it("P9.3 BSI 403 on POST → 403 cannot_post", async () => {
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
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(403);
    expect(await res?.json()).toStrictEqual({ error: "cannot_post" });
  });
});
