import { describe, expect, it, vi } from "vitest";
import { getLimiterCalls, resetCommentLimiters } from "../comment-limits";
import {
  ACCESS1,
  H_OK,
  IP,
  IP2,
  callComments,
  mockSiteverifyPass,
  seedSession,
  setupGate,
  useGateHooks,
} from "./harness";

useGateHooks();

const POST_BODY = {
  date: "2025-02-10",
  type: "belly",
  content: "hello",
  recaptcha: "tok",
};

describe("PR2 gates P", () => {
  it("P1.1 POST with session + recaptcha + BSI 201 → shaped 201 Member", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockSiteverifyPass(g);
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          comment: {
            id: 9,
            user: { display_name: "Jane" },
            content: "hello",
            timestamp: "2025-02-10T12:00:00Z",
            parent_id: null,
            like_count: 0,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        }),
        { status: 201 },
      );
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
  });

  it("P1.2 BSI 201 missing id → 503 unavailable Retry-After 300, 0 cache.delete", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockSiteverifyPass(g);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ comment: { content: "x", timestamp: "t" } }), {
        status: 201,
      });
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
    mockSiteverifyPass(g);
    let upstreamBody = "";
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      upstreamBody = String(init?.body);
      return new Response(
        JSON.stringify({
          comment: {
            id: 1,
            user: { display_name: "x" },
            content: "hi",
            timestamp: "t",
            parent_id: null,
            like_count: 0,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        }),
        { status: 201 },
      );
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
    const parsed = JSON.parse(upstreamBody);
    expect(Object.keys(parsed).sort()).toStrictEqual(["content", "date", "type"]);
    expect(parsed.content).toBe("hi");
  });

  it("P3.2 content empty/whitespace/2001 chars → 400; 2000 ok", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockSiteverifyPass(g);
    for (const content of ["", "   ", "x".repeat(2001)]) {
      g.fetchMock.mockClear();
      const res = await callComments(g, "/api/daily-fix/comments", {
        method: "POST",
        headers: H_OK(s),
        body: JSON.stringify({ ...POST_BODY, content }),
      });
      expect(res?.status).toBe(400);
      expect(await res?.json()).toStrictEqual({ error: "invalid_request" });
      expect(g.fetchMock).toHaveBeenCalledTimes(0);
    }
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          comment: {
            id: 1,
            user: {},
            content: "😀".repeat(2000),
            timestamp: "t",
            parent_id: null,
            like_count: 0,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        }),
        { status: 201 },
      );
    });
    const ok = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify({ ...POST_BODY, content: "😀".repeat(2000) }),
    });
    expect(ok?.status).toBe(201);
  });

  it("P3.3 body >8192 bytes → 413 payload_too_large", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    const big = "x".repeat(8200);
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s), "Content-Length": String(big.length + 100) },
      body: JSON.stringify({ ...POST_BODY, content: big }),
    });
    expect(res?.status).toBe(413);
    expect(await res?.json()).toStrictEqual({ error: "payload_too_large" });
    expect(g.fetchMock).toHaveBeenCalledTimes(0);
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
      expect(g.fetchMock).toHaveBeenCalledTimes(0);
    }
  });

  it("P4.1 logged out POST → 401 signed_out, 0 upstream", async () => {
    const g = setupGate();
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://metfix.org" },
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(401);
    expect(await res?.json()).toStrictEqual({ error: "signed_out" });
    expect(g.fetchMock).toHaveBeenCalledTimes(0);
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
    mockSiteverifyPass(g);
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      const hdrs = init?.headers as Record<string, string>;
      expect(Object.keys(hdrs).map((k) => k.toLowerCase()).sort()).toStrictEqual([
        "accept",
        "authorization",
        "content-type",
        "user-agent",
        "x-api-key",
      ]);
      expect(hdrs.Authorization).toBe(`Bearer ${ACCESS1}`);
      return new Response(
        JSON.stringify({
          comment: {
            id: 1,
            user: {},
            content: "h",
            timestamp: "t",
            parent_id: null,
            like_count: 0,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        }),
        { status: 201 },
      );
    });
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s), Authorization: "Bearer EVIL" },
      body: JSON.stringify({ ...POST_BODY, user_id: 99 }),
    });
  });

  it("P4.4 signed-in GET upstream has no authorization header", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    g.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ comments: { belly: [], body: [], brain: [] }, meta: {} }), {
        status: 200,
      }),
    );
    await callComments(g, "/api/daily-fix/comments?date=2025-02-10&type=all", {
      headers: { Cookie: `__Host-mfx_sid=${s.sid}` },
    });
    const init = g.fetchMock.mock.calls[0]?.[1] as RequestInit;
    const hdrs = init.headers as Record<string, string>;
    expect(hdrs.Authorization).toBe(`Bearer ${ACCESS1}`);
  });

  it("P4.5 empty access token at session → 503 unavailable on POST", async () => {
    const g = setupGate();
    const s = await seedSession(g, { access_token: "" });
    mockSiteverifyPass(g);
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(503);
    expect(await res?.json()).toStrictEqual({ error: "unavailable" });
  });

  it("P5.1 POST upstream URL fixed comments path, method POST", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockSiteverifyPass(g);
    g.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      expect(String(url)).toBe(
        "https://brokenscience.org/wp-json/metfix/v1/daily-fix/comments",
      );
      expect(init?.method).toBe("POST");
      return new Response(
        JSON.stringify({
          comment: {
            id: 1,
            user: {},
            content: "h",
            timestamp: "t",
            parent_id: null,
            like_count: 0,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        }),
        { status: 201 },
      );
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
    mockSiteverifyPass(g);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          comment: {
            id: 1,
            user: {},
            content: "h",
            timestamp: "t",
            parent_id: null,
            like_count: 0,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        }),
        { status: 201 },
      );
    });
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(g.cache.deletes).toStrictEqual([
      "https://cache.metfix.internal/daily-fix/comments?date=2025-02-10",
    ]);
    g.cache.deletes.length = 0;
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
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
    mockSiteverifyPass(g);
    const ok = {
      comment: {
        id: 1,
        user: {},
        content: "h",
        timestamp: "t",
        parent_id: null,
        like_count: 0,
        deleted: 0,
        edited: 0,
        replies: [],
      },
    };
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify(ok), { status: 201 });
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
    expect(g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("siteverify")).length).toBe(5);
    expect(getLimiterCalls().some((c) => c.key === `7:${IP}`)).toBe(true);
    const s2 = await seedSession(g, { user_id: "8" });
    const otherIp = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s2), "CF-Connecting-IP": IP2 },
      body: JSON.stringify(POST_BODY),
    });
    expect(otherIp?.status).toBe(201);
  });

  it("P8.2 CSRF fail and logged out skip limiter", async () => {
    const g = setupGate();
    resetCommentLimiters();
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(POST_BODY),
    });
    expect(getLimiterCalls().length).toBe(0);
    const s = await seedSession(g);
    await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: { ...H_OK(s), "X-CSRF-Token": "wrong" },
      body: JSON.stringify(POST_BODY),
    });
    expect(getLimiterCalls().length).toBe(0);
  });

  it("P9.1 six concurrent POSTs → five BSI, one 429", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockSiteverifyPass(g);
    let bsi = 0;
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      bsi++;
      return new Response(
        JSON.stringify({
          comment: {
            id: bsi,
            user: {},
            content: "h",
            timestamp: "t",
            parent_id: null,
            like_count: 0,
            deleted: 0,
            edited: 0,
            replies: [],
          },
        }),
        { status: 201 },
      );
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
    expect(statuses.filter((s) => s === 201).length).toBe(5);
    expect(statuses.filter((s) => s === 429).length).toBe(1);
    expect(bsi).toBe(5);
  });

  it("P9.3 BSI 403 on POST → 403 cannot_post", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockSiteverifyPass(g);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ code: "forbidden" }), { status: 403 });
    });
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK(s),
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(403);
    expect(await res?.json()).toStrictEqual({ error: "cannot_post" });
  });

  it("P9.2 replay after logout → 401 — session destroyed via cookie clear", async () => {
    const g = setupGate();
    const s = await seedSession(g);
    mockSiteverifyPass(g);
    g.fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("siteverify")) {
        return new Response(
          JSON.stringify({ success: true, score: 0.9, action: "comment", hostname: "metfix.org" }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 403 });
    });
    const res = await callComments(g, "/api/daily-fix/comments", {
      method: "POST",
      headers: H_OK({ sid: "forged", csrf: s.csrf }),
      body: JSON.stringify(POST_BODY),
    });
    expect(res?.status).toBe(401);
    expect(g.fetchMock.mock.calls.filter((c) => String(c[0]).includes("brokenscience")).length).toBe(
      0,
    );
  });
});
