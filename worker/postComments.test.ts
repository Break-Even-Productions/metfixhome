import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handlePostCommentsRoutes } from "./postComments";
import type { Env } from "./upstream";

describe("TC13 post comments auth gates", () => {
  const fetchImpl = vi.fn();

  function env(overrides: Partial<Env> = {}): Env {
    return {
      ASSETS: {} as Fetcher,
      BSI_POSTS_API_KEY: "posts-key",
      ...overrides,
    } as Env;
  }

  beforeEach(() => {
    fetchImpl.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET anonymous calls upstream with API key", async () => {
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ comments: [], meta: { post_id: 1, count: 0 } }), {
        status: 200,
      }),
    );
    const res = await handlePostCommentsRoutes(
      new Request("https://metfix.org/api/posts/1/comments"),
      env(),
      { fetchImpl },
    );
    expect(res?.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({ "X-API-Key": "posts-key" });
    expect(init.headers).not.toHaveProperty("Authorization");
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
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
        headers: {
          "Content-Type": "application/json",
          Host: "metfix.org",
        },
        body: JSON.stringify({ content: "hello" }),
      }),
      env(),
      { fetchImpl },
    );
    expect(res?.status).toBe(401);
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
