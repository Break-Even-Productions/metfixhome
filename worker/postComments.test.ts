import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingContext } from "./auth/acting";
import type { SessionRecord } from "./do/session";

const state = vi.hoisted(() => ({
  acting: null as ActingContext | null,
  writeLimitAllowed: true,
  likeLimitAllowed: true,
  likeToggleAllowed: true,
}));

vi.mock("./auth/acting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth/acting")>();
  return {
    ...actual,
    resolveActingSession: vi.fn(async () => {
      if (!state.acting) {
        return new Response(JSON.stringify({ error: "signed_out" }), { status: 401 });
      }
      return state.acting;
    }),
    runUserBsiCall: vi.fn(async (ctx, _env, _fetchImpl, _opts, fn) => {
      const result = await fn(ctx.access);
      return { result };
    }),
  };
});

vi.mock("./auth/comment-rate-limit", () => ({
  checkCommentWriteLimit: vi.fn(async () => ({ allowed: state.writeLimitAllowed })),
  checkCommentLikeLimit: vi.fn(async () => ({ allowed: state.likeLimitAllowed })),
  checkCommentLikeToggleLimit: vi.fn(async () => ({ allowed: state.likeToggleAllowed })),
}));

vi.mock("./comments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./comments")>();
  return {
    ...actual,
    requireCommentCsrf: vi.fn(async () => null),
    verifyCommentRecaptcha: vi.fn(async () => null),
  };
});

import { handlePostCommentsRoutes } from "./postComments";
import type { Env } from "./upstream";

describe("TC13 post comments auth gates", () => {
  const fetchImpl = vi.fn();

  function env(overrides: Partial<Env> = {}): Env {
    return {
      ASSETS: {} as Fetcher,
      BSI_POSTS_API_KEY: "posts-key",
      BSI_BASE_URL: "https://brokenscience.org",
      ...overrides,
    } as Env;
  }

  function mockActing(access = "user-access-token"): ActingContext {
    const record: SessionRecord = {
      bsi_access: access,
      bsi_refresh: "refresh",
      access_exp: Date.now() + 3_600_000,
      user_public_name: "Test User",
      bsi_user_id: "uid-1",
      can_moderate: false,
      created: Date.now(),
      last_seen: Date.now(),
    };
    return { sid: "sid", hex: "hex", access, record };
  }

  function writeHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      Host: "metfix.org",
      Origin: "https://metfix.org",
      "X-CSRF-Token": "csrf",
    };
  }

  function upstreamHeaders(callIndex = 0): Headers {
    const init = fetchImpl.mock.calls[callIndex]![1] as RequestInit;
    return new Headers(init.headers as HeadersInit);
  }

  beforeEach(() => {
    fetchImpl.mockReset();
    state.acting = null;
    state.writeLimitAllowed = true;
    state.likeLimitAllowed = true;
    state.likeToggleAllowed = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET anonymous calls upstream with API key only", async () => {
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ comments: [], meta: { post_id: 1, count: 0 } }), {
        status: 200,
      }),
    );
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments"),
      env(),
      { fetchImpl, bsiBaseUrl: "https://brokenscience.org" },
    );
    expect(res?.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(upstreamHeaders().get("X-API-Key")).toBe("posts-key");
    expect(upstreamHeaders().get("Authorization")).toBeNull();
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET signed-in uses Bearer without X-API-Key", async () => {
    state.acting = mockActing("signed-get-token");
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ comments: [], meta: { post_id: 1, count: 0 } }), {
        status: 200,
      }),
    );
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments", {
        headers: { Cookie: "__Host-mfx_sid=sid" },
      }),
      env(),
      { fetchImpl, bsiBaseUrl: "https://brokenscience.org" },
    );
    expect(res?.status).toBe(200);
    expect(upstreamHeaders().get("Authorization")).toBe("Bearer signed-get-token");
    expect(upstreamHeaders().get("X-API-Key")).toBeNull();
  });

  it("POST off metfix.org host → 404", async () => {
    const res = await handlePostCommentsRoutes(
      new Request("https://evil.example/api/posts/1/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hi" }),
      }),
      env(),
      { fetchImpl },
    );
    expect(res?.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POST without session → 401", async () => {
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments", {
        method: "POST",
        headers: writeHeaders(),
        body: JSON.stringify({ content: "hello", recaptcha: "tok" }),
      }),
      env(),
      { fetchImpl },
    );
    expect(res?.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POST authenticated forwards Bearer only to upstream", async () => {
    state.acting = mockActing("post-write-token");
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ comment: { id: 9, content: "hello", user: { display_name: "T" } } }), {
        status: 201,
      }),
    );
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments", {
        method: "POST",
        headers: writeHeaders(),
        body: JSON.stringify({ content: "hello", recaptcha: "tok" }),
      }),
      env(),
      { fetchImpl, bsiBaseUrl: "https://brokenscience.org" },
    );
    expect(res?.status).toBe(201);
    expect(upstreamHeaders().get("Authorization")).toBe("Bearer post-write-token");
    expect(upstreamHeaders().get("X-API-Key")).toBeNull();
  });

  it("PATCH authenticated forwards Bearer only", async () => {
    state.acting = mockActing("patch-token");
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ comment: { id: 2, content: "edit", user: { display_name: "T" } } }), {
        status: 200,
      }),
    );
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments/2", {
        method: "PATCH",
        headers: writeHeaders(),
        body: JSON.stringify({ content: "edit" }),
      }),
      env(),
      { fetchImpl, bsiBaseUrl: "https://brokenscience.org" },
    );
    expect(res?.status).toBe(200);
    expect(upstreamHeaders().get("Authorization")).toBe("Bearer patch-token");
    expect(upstreamHeaders().get("X-API-Key")).toBeNull();
  });

  it("DELETE authenticated forwards Bearer only", async () => {
    state.acting = mockActing("delete-token");
    fetchImpl.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments/3", {
        method: "DELETE",
        headers: writeHeaders(),
      }),
      env(),
      { fetchImpl, bsiBaseUrl: "https://brokenscience.org" },
    );
    expect(res?.status).toBe(204);
    expect(upstreamHeaders().get("Authorization")).toBe("Bearer delete-token");
    expect(upstreamHeaders().get("X-API-Key")).toBeNull();
  });

  it("POST like authenticated forwards Bearer only", async () => {
    state.acting = mockActing("like-token");
    fetchImpl.mockResolvedValue(new Response(JSON.stringify({ liked: true }), { status: 200 }));
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments/4/like", {
        method: "POST",
        headers: writeHeaders(),
        body: JSON.stringify({ liked: true }),
      }),
      env(),
      { fetchImpl, bsiBaseUrl: "https://brokenscience.org" },
    );
    expect(res?.status).toBe(200);
    expect(upstreamHeaders().get("Authorization")).toBe("Bearer like-token");
    expect(upstreamHeaders().get("X-API-Key")).toBeNull();
    expect(String(fetchImpl.mock.calls[0]![0])).toContain("/comments/4/like");
  });

  it("POST write rate limit → 429", async () => {
    state.acting = mockActing();
    state.writeLimitAllowed = false;
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments", {
        method: "POST",
        headers: writeHeaders(),
        body: JSON.stringify({ content: "hello", recaptcha: "tok" }),
      }),
      env(),
      { fetchImpl },
    );
    expect(res?.status).toBe(429);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("invalid post id path falls through", async () => {
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/abc/comments"),
      env(),
      { fetchImpl },
    );
    expect(res).toBeNull();
  });
});
