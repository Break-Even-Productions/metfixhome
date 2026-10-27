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
  handleLibraryHtml,
  isValidLibraryId,
} from "./library";
import type { Env } from "./upstream";

describe("library search query builder", () => {
  it("allows query + content_type_terms and rejects content_access", () => {
    const ok = buildSearchUpstreamQuery(
      new URLSearchParams("query=insulin&content_type_terms[]=whiteboards&limit=12"),
    );
    expect(ok).toContain("query=insulin");
    expect(ok).toContain("content_type_terms");
    expect(ok).toContain("whiteboards");
  });

  it("rejects overlong query", () => {
    const long = "x".repeat(200);
    expect(buildSearchUpstreamQuery(new URLSearchParams(`query=${long}`))).toBeNull();
  });

  it("rejects bad content_types", () => {
    expect(
      buildSearchUpstreamQuery(new URLSearchParams("content_types[]=evil")),
    ).toBeNull();
  });

  it("forwards singular category as categories[]", () => {
    const qs = buildSearchUpstreamQuery(new URLSearchParams("category=42&category=7"));
    expect(qs).toContain("categories%5B%5D=42");
    expect(qs).toContain("categories%5B%5D=7");
    expect(buildSearchUpstreamQuery(new URLSearchParams("category=0"))).toBeNull();
  });

  it("validates ids", () => {
    expect(isValidLibraryId("42")).toBe(true);
    expect(isValidLibraryId("0")).toBe(false);
    expect(isValidLibraryId("12abc")).toBe(false);
  });
});

describe("library popular query builder", () => {
  it("defaults limit/offset and allows content_types", () => {
    const ok = buildPopularUpstreamQuery(new URLSearchParams("content_types[]=post"));
    expect(ok).toContain("limit=6");
    expect(ok).toContain("offset=0");
    expect(ok).toContain("content_types");
  });

  it("forwards offset and rejects bad values", () => {
    expect(buildPopularUpstreamQuery(new URLSearchParams("limit=24&offset=48"))).toBe(
      "limit=24&offset=48",
    );
    expect(buildPopularUpstreamQuery(new URLSearchParams("limit=48"))).toContain(
      "limit=48",
    );
    expect(buildPopularUpstreamQuery(new URLSearchParams("limit=0"))).toBeNull();
    expect(buildPopularUpstreamQuery(new URLSearchParams("limit=49"))).toBeNull();
    expect(buildPopularUpstreamQuery(new URLSearchParams("offset=-1"))).toBeNull();
    expect(
      buildPopularUpstreamQuery(new URLSearchParams("content_types[]=evil")),
    ).toBeNull();
  });
});

describe("library source scan", () => {
  it("does not invent Manus or metfix-only content_access allowlists", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("./library.ts", import.meta.url)), "utf8");
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
      new Request("https://metfix.org/library", { headers: { Accept: "text/html" } }),
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
        fetch: vi.fn(async () =>
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
        new Request(`https://metfix.org${path}`, { headers: { Accept: "text/html" } }),
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
      { waitUntil() {}, passThroughOnException() {}, props: {} } as ExecutionContext,
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
