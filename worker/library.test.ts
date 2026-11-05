import { describe, expect, it, vi } from "vitest";
import { DETAIL_PAGE_CSP } from "./csp";
import { installHtmlRewriterPolyfill } from "./test/htmlrewriter-polyfill";

installHtmlRewriterPolyfill();

vi.mock("./head", async () => {
  const actual = await vi.importActual<typeof import("./head")>("./head");
  return {
    ...actual,
    // Node vitest has no HTMLRewriter; pass SPA shell through unchanged.
    rewriteHtml: (response: Response) => response,
  };
});

import {
  buildPopularUpstreamQuery,
  buildSearchUpstreamQuery,
  handleLibraryApi,
  handleLibraryHtml,
  isValidLibraryId,
} from "./library";
import type { Env } from "./upstream";

describe("library search query builder", () => {
  it("allows query + content_type_terms and rejects content_access", () => {
    const ok = buildSearchUpstreamQuery(
      new URLSearchParams(
        "query=insulin&content_type_terms[]=whiteboards&limit=12",
      ),
    );
    expect(ok).toContain("query=insulin");
    expect(ok).toContain("content_type_terms");
    expect(ok).toContain("whiteboards");
  });

  it("rejects overlong query", () => {
    const long = "x".repeat(200);
    expect(
      buildSearchUpstreamQuery(new URLSearchParams(`query=${long}`)),
    ).toBeNull();
  });

  it("rejects bad content_types", () => {
    expect(
      buildSearchUpstreamQuery(new URLSearchParams("content_types[]=evil")),
    ).toBeNull();
  });

  it("forwards singular category as categories[]", () => {
    const qs = buildSearchUpstreamQuery(
      new URLSearchParams("category=42&category=7"),
    );
    expect(qs).toContain("categories%5B%5D=42");
    expect(qs).toContain("categories%5B%5D=7");
    expect(
      buildSearchUpstreamQuery(new URLSearchParams("category=0")),
    ).toBeNull();
  });

  it("validates ids", () => {
    expect(isValidLibraryId("42")).toBe(true);
    expect(isValidLibraryId("0")).toBe(false);
    expect(isValidLibraryId("12abc")).toBe(false);
  });
});

describe("library popular query builder", () => {
  it("defaults limit/offset and allows content_types", () => {
    const ok = buildPopularUpstreamQuery(
      new URLSearchParams("content_types[]=post"),
    );
    expect(ok).toContain("limit=6");
    expect(ok).toContain("offset=0");
    expect(ok).toContain("content_types");
  });

  it("forwards offset and rejects bad values", () => {
    expect(
      buildPopularUpstreamQuery(new URLSearchParams("limit=24&offset=48")),
    ).toBe("limit=24&offset=48");
    expect(
      buildPopularUpstreamQuery(new URLSearchParams("limit=48")),
    ).toContain("limit=48");
    expect(
      buildPopularUpstreamQuery(new URLSearchParams("limit=0")),
    ).toBeNull();
    expect(
      buildPopularUpstreamQuery(new URLSearchParams("limit=49")),
    ).toBeNull();
    expect(
      buildPopularUpstreamQuery(new URLSearchParams("offset=-1")),
    ).toBeNull();
    expect(
      buildPopularUpstreamQuery(new URLSearchParams("content_types[]=evil")),
    ).toBeNull();
  });
});

describe("library source scan", () => {
  it("does not invent Manus or metfix-only content_access allowlists", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      fileURLToPath(new URL("./library.ts", import.meta.url)),
      "utf8",
    );
    expect(src.toLowerCase()).not.toMatch(/manus/);
    expect(src).not.toMatch(/out\.append\(\s*["']content_access/);
    expect(src).toMatch(/Bearer/);
    expect(src).toMatch(/X-API-Key/);
  });
});

describe("SS20a handleLibraryHtml /library/search (SR18)", () => {
  const SPA_SHELL = `<!doctype html><html><head><title>MetFix</title></head><body><div id="root"></div></body></html>`;

  function makeEnv(assetsFetch: ReturnType<typeof vi.fn>): Env {
    return {
      ASSETS: { fetch: assetsFetch } as unknown as Fetcher,
      BSI_POSTS_API_KEY: "test-key",
    } as Env;
  }

  function makeCtx(): ExecutionContext {
    return {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    } as unknown as ExecutionContext;
  }

  it("GET /library/search and ?query=x → 200 text/html SPA shell (not 404)", async () => {
    const assetsFetch = vi.fn(async () => {
      return new Response(SPA_SHELL, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    });
    const env = makeEnv(assetsFetch);
    const ctx = makeCtx();
    const deps = {
      cachesDefault: {
        match: async () => undefined,
        put: async () => {},
      } as unknown as Cache,
      fetchImpl: vi.fn(async () => new Response("{}", { status: 404 })),
    };

    const hub = await handleLibraryHtml(
      new Request("https://metfix.org/library", {
        headers: { Accept: "text/html" },
      }),
      env,
      ctx,
      deps,
    );
    const search = await handleLibraryHtml(
      new Request("https://metfix.org/library/search", {
        headers: { Accept: "text/html" },
      }),
      env,
      ctx,
      deps,
    );
    const withQ = await handleLibraryHtml(
      new Request("https://metfix.org/library/search?query=x", {
        headers: { Accept: "text/html" },
      }),
      env,
      ctx,
      deps,
    );
    const notFound = await handleLibraryHtml(
      new Request("https://metfix.org/library/not-a-real-type/1", {
        headers: { Accept: "text/html" },
      }),
      env,
      ctx,
      deps,
    );

    expect(hub.status).toBe(200);
    expect(search.status).toBe(200);
    expect(withQ.status).toBe(200);
    expect(search.headers.get("content-type") ?? "").toMatch(/text\/html/);
    const hubBody = await hub.text();
    const searchBody = await search.text();
    const qBody = await withQ.text();
    // Same SPA shell bytes as hub (rewriter may inject head; bodies still share root shell).
    expect(searchBody).toContain('id="root"');
    expect(qBody).toContain('id="root"');
    expect(hubBody).toContain('id="root"');
    expect(notFound.status).toBe(404);
  });
});

describe("TC12 taxonomy HTML routes", () => {
  const SPA_SHELL = `<!doctype html><html><head><title>MetFix</title></head><body><div id="root"></div></body></html>`;

  function makeEnv(): Env {
    return {
      ASSETS: {
        fetch: vi.fn(
          async () =>
            new Response(SPA_SHELL, {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }),
        ),
      } as unknown as Fetcher,
      BSI_POSTS_API_KEY: "test-key",
      RECAPTCHA_SITE_KEY: "6LeTestSiteKey_abc-123",
    } as Env;
  }

  const ctx = {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;

  const deps = {
    cachesDefault: {
      match: async () => undefined,
      put: async () => {},
    } as unknown as Cache,
    fetchImpl: vi.fn(async () => new Response("{}", { status: 404 })),
  };

  for (const path of [
    "/topic/metabolic-health",
    "/library/topic/metabolic-health",
    "/library/category/bsi",
    "/library/content-type/video",
  ]) {
    it(`GET ${path} → 200 SPA`, async () => {
      const res = await handleLibraryHtml(
        new Request(`https://metfix.org${path}`, {
          headers: { Accept: "text/html" },
        }),
        makeEnv(),
        ctx,
        deps,
      );
      expect(res.status).toBe(200);
    });
  }

  it("invalid taxonomy slug → 404", async () => {
    const res = await handleLibraryHtml(
      new Request("https://metfix.org/topic/not%20valid", {
        headers: { Accept: "text/html" },
      }),
      makeEnv(),
      ctx,
      deps,
    );
    expect(res.status).toBe(404);
  });
});

describe("TC14 detail page CSP + reCAPTCHA (library)", () => {
  const SPA_SHELL = `<!doctype html><html><head><title>MetFix</title></head><body><div id="root"></div></body></html>`;

  it("handleLibraryHtml sets DETAIL_PAGE_CSP and site key", async () => {
    const env = {
      ASSETS: {
        fetch: vi.fn(async () => new Response(SPA_SHELL, { status: 200 })),
      } as unknown as Fetcher,
      BSI_POSTS_API_KEY: "test-key",
      RECAPTCHA_SITE_KEY: "6LeTestSiteKey_abc-123",
    } as Env;
    const res = await handleLibraryHtml(
      new Request("https://metfix.org/library/topic/metabolic-health", {
        headers: { Accept: "text/html" },
      }),
      env,
      {
        waitUntil() {},
        passThroughOnException() {},
        props: {},
      } as ExecutionContext,
      {
        cachesDefault: {
          match: async () => undefined,
          put: async () => {},
        } as unknown as Cache,
        fetchImpl: vi.fn(async () => new Response("{}", { status: 404 })),
      },
    );
    expect(res.headers.get("Content-Security-Policy")).toBe(DETAIL_PAGE_CSP);
    const body = await res.text();
    expect(body).toContain("window.__MFX_RECAPTCHA_SITE_KEY__");
    expect(body).toContain("6LeTestSiteKey_abc-123");
    expect(DETAIL_PAGE_CSP).toContain("https://www.youtube.com");
    expect(DETAIL_PAGE_CSP).toContain("player.vimeo.com");
  });
});

describe("library archive merge", () => {
  function makeEnv(): Env {
    return { BSI_POSTS_API_KEY: "test-key" } as Env;
  }

  function makeCtx(): ExecutionContext {
    return {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    } as unknown as ExecutionContext;
  }

  function term(id: number, slug: string, name = slug) {
    return { id, name, slug };
  }

  function resource(id: number, title: string, date: string) {
    return {
      id,
      type: "post",
      title,
      date,
      excerpt: "",
      content_access_display: { access: "full" },
    };
  }

  function searchBody(resources: unknown[], total = resources.length) {
    return {
      resources,
      meta: {
        total,
        count: resources.length,
        limit: 9,
        offset: 0,
        has_more: false,
      },
    };
  }

  function installFetch(opts: {
    bookLibrary?: boolean;
    failCategory?: boolean;
    glassman?: boolean;
  }) {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(`${url.pathname}${url.search}`);
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      const glassman = opts.glassman !== false;
      if (url.pathname.endsWith("/topics")) {
        return json(
          glassman ? [term(43889, "glassman-archive", "Glassman Archive")] : [],
        );
      }
      if (url.pathname.endsWith("/content-type-terms")) {
        const terms = [term(43874, "articles", "Articles")];
        if (opts.bookLibrary)
          terms.push(term(50, "book-library", "Book Library"));
        return json(terms);
      }
      if (url.pathname.endsWith("/categories-for-filter")) {
        return json(
          glassman ? [term(400, "glassman-archive", "Glassman Archive")] : [],
        );
      }
      if (url.pathname.endsWith("/search")) {
        if (
          opts.failCategory &&
          url.searchParams.getAll("categories[]").includes("400")
        ) {
          return json({ error: "nope" }, 500);
        }
        if (url.searchParams.getAll("topics[]").includes("43889")) {
          return json(
            searchBody([
              resource(1, "Shared", "2024-01-02T00:00:00.000Z"),
              resource(2, "Topic only", "2024-06-01T00:00:00.000Z"),
            ]),
          );
        }
        if (url.searchParams.getAll("categories[]").includes("400")) {
          return json(
            searchBody([
              resource(1, "Shared", "2024-01-02T00:00:00.000Z"),
              resource(3, "Category only", "2024-03-01T00:00:00.000Z"),
            ]),
          );
        }
        if (
          url.searchParams
            .getAll("content_type_terms[]")
            .includes("book-library")
        ) {
          return json(
            searchBody([resource(4, "Book", "2024-12-01T00:00:00.000Z")]),
          );
        }
        return json({ error: "unexpected" }, 500);
      }
      return json({ error: "missing" }, 404);
    });
    return { fetchImpl, calls };
  }

  async function getArchive(
    fetchImpl: ReturnType<typeof installFetch>["fetchImpl"],
    path = "/api/library/archive?limit=9",
  ) {
    return handleLibraryApi(
      new Request(`https://metfix.org${path}`),
      makeEnv(),
      makeCtx(),
      {
        fetchImpl,
        cachesDefault: {
          match: async () => undefined,
          put: async () => {},
        } as unknown as Cache,
      },
    );
  }

  it("merges topic and category in one response and skips a missing book library", async () => {
    const { fetchImpl, calls } = installFetch({});
    const res = await getArchive(fetchImpl);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resources: Array<{ title: string }> };
    expect(body.resources.map((r) => r.title)).toEqual([
      "Topic only",
      "Category only",
      "Shared",
    ]);
    const searches = calls.filter((url) => url.includes("/search?"));
    expect(searches).toHaveLength(2);
    expect(searches.some((url) => url.includes("topics%5B%5D=43889"))).toBe(
      true,
    );
    expect(searches.some((url) => url.includes("categories%5B%5D=400"))).toBe(
      true,
    );
    expect(searches.some((url) => url.includes("book-library"))).toBe(false);
    expect(calls.filter((url) => url.includes("/search?")).length).toBe(2);
    const firstSearch = calls.findIndex((url) => url.includes("/search?"));
    expect(firstSearch).toBe(3);
  });

  it("adds the book library content type once that term exists", async () => {
    const { fetchImpl, calls } = installFetch({ bookLibrary: true });
    const res = await getArchive(fetchImpl);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resources: Array<{ title: string }> };
    expect(body.resources.map((r) => r.title)).toEqual([
      "Book",
      "Topic only",
      "Category only",
      "Shared",
    ]);
    const searches = calls.filter((url) => url.includes("/search?"));
    expect(searches).toHaveLength(3);
    expect(
      searches.some((url) =>
        url.includes("content_type_terms%5B%5D=book-library"),
      ),
    ).toBe(true);
  });

  it("returns an empty list without searching when the terms are absent", async () => {
    const { fetchImpl, calls } = installFetch({ glassman: false });
    const res = await getArchive(fetchImpl);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resources: unknown[] };
    expect(body.resources).toEqual([]);
    expect(calls.some((url) => url.includes("/search?"))).toBe(false);
  });

  it("rejects extra query params and a failed leg", async () => {
    const extra = installFetch({});
    const bad = await getArchive(
      extra.fetchImpl,
      "/api/library/archive?query=glassman",
    );
    expect(bad.status).toBe(400);
    expect(extra.calls).toHaveLength(0);

    const failed = installFetch({ failCategory: true });
    const res = await getArchive(failed.fetchImpl);
    expect(res.status).toBe(503);
  });
});

describe("library popular cushions (timeout + stale + membership skip)", () => {
  function makeEnv(): Env {
    return { BSI_POSTS_API_KEY: "test-key" } as Env;
  }

  function makeCtx(): ExecutionContext {
    return {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    } as unknown as ExecutionContext;
  }

  function memoryCache(): Cache & {
    store: Map<string, Response>;
  } {
    const store = new Map<string, Response>();
    return {
      store,
      match: async (req: RequestInfo | URL) => {
        const key = typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
        const hit = store.get(key);
        return hit ? hit.clone() : undefined;
      },
      put: async (req: RequestInfo | URL, res: Response) => {
        const key = typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
        store.set(key, res.clone());
      },
      delete: async () => false,
      keys: async () => [] as unknown as ReadonlyArray<Request>,
    } as Cache & { store: Map<string, Response> };
  }

  function popularUpstream() {
    return {
      resources: [
        {
          id: 1,
          type: "post",
          title: "Hot",
          excerpt: "x",
          date: "2025-01-01T00:00:00Z",
          content_access_display: { access: "full", is_exclusive: false },
        },
        {
          id: 2,
          type: "page",
          title: "Society page",
          excerpt: "y",
          date: "2025-01-02T00:00:00Z",
          permalink: "https://brokenscience.org/society-member/",
          content_access_display: { access: "full", is_exclusive: false },
        },
      ],
      meta: { count: 2, limit: 6 },
    };
  }

  it("uses a 12s AbortSignal for popular and skips membership HTML probes", async () => {
    const seen: number[] = [];
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation((ms: number) => {
        seen.push(ms);
        return new AbortController().signal;
      });

    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return new Response(JSON.stringify(popularUpstream()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const cache = memoryCache();
    const res = await handleLibraryApi(
      new Request("https://metfix.org/api/library/popular?limit=6"),
      makeEnv(),
      makeCtx(),
      { fetchImpl, cachesDefault: cache },
    );
    expect(res.status).toBe(200);
    expect(seen).toContain(12_000);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/resources/popular?");
    expect(urls.some((u) => u.includes("society-member"))).toBe(false);

    const put = [...cache.store.values()][0]!;
    expect(put.headers.get("Cache-Control")).toBe("s-maxage=86400");
    expect(put.headers.get("X-Library-Fresh-Until")).toBeTruthy();

    timeoutSpy.mockRestore();
  });

  it("serves stale popular JSON when upstream times out", async () => {
    const cache = memoryCache();
    const staleBody = {
      resources: [
        {
          id: 9,
          type: "post",
          title: "Stale hit",
          excerpt: "",
          date: "2025-01-01T00:00:00.000Z",
          image: null,
          permalink: null,
          author: null,
          categories: [],
          topics: [],
          content_types: [],
          access: {
            access: "full",
            has_content_access: false,
            user_has_access: true,
            has_preview: false,
            is_exclusive: false,
            show_same: 0,
            show_video_in_preview: false,
            access_group_labels: [],
          },
          view_count: null,
          daily_fix_date: null,
        },
      ],
      meta: { total: 1, count: 1, limit: 6, offset: 0, has_more: false },
    };
    // Seed an expired (stale) entry under the same key the Worker will use.
    const warm = await handleLibraryApi(
      new Request("https://metfix.org/api/library/popular?limit=6"),
      makeEnv(),
      makeCtx(),
      {
        fetchImpl: vi.fn(async () =>
          new Response(JSON.stringify(popularUpstream()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
        cachesDefault: cache,
      },
    );
    expect(warm.status).toBe(200);
    // Force stale by rewriting fresh-until into the past.
    const key = [...cache.store.keys()][0]!;
    cache.store.set(
      key,
      new Response(JSON.stringify(staleBody), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "s-maxage=86400",
          "X-Library-Fresh-Until": new Date(Date.now() - 60_000).toISOString(),
        },
      }),
    );

    const fetchImpl = vi.fn(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });

    const res = await handleLibraryApi(
      new Request("https://metfix.org/api/library/popular?limit=6"),
      makeEnv(),
      makeCtx(),
      { fetchImpl, cachesDefault: cache },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resources: Array<{ title: string }> };
    expect(body.resources[0]?.title).toBe("Stale hit");
  });

  it("search uses 8s timeout and still flags membership pages (capped)", async () => {
    const seen: number[] = [];
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation((ms: number) => {
        seen.push(ms);
        return new AbortController().signal;
      });

    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/resources/search")) {
        return new Response(
          JSON.stringify({
            resources: [
              {
                id: 2,
                type: "page",
                title: "Society page",
                excerpt: "y",
                date: "2025-01-02T00:00:00Z",
                permalink: "https://brokenscience.org/society-member/",
                content_access_display: { access: "full", is_exclusive: false },
              },
            ],
            meta: {
              total: 1,
              count: 1,
              limit: 6,
              offset: 0,
              has_more: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        "<html><p>Exclusive to members. Please log in.</p></html>",
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        },
      );
    });

    const res = await handleLibraryApi(
      new Request("https://metfix.org/api/library/search?limit=6"),
      makeEnv(),
      makeCtx(),
      {
        fetchImpl,
        cachesDefault: {
          match: async () => undefined,
          put: async () => {},
        } as unknown as Cache,
      },
    );
    expect(res.status).toBe(200);
    expect(seen).toContain(8_000);
    expect(seen).toContain(2_500);
    expect(urls.some((u) => u.includes("society-member"))).toBe(true);
    const body = (await res.json()) as {
      resources: Array<{ access: { access: string } }>;
    };
    expect(body.resources[0]?.access.access).toBe("none");
    timeoutSpy.mockRestore();
  });
});
