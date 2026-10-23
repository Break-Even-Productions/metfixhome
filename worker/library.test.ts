import { describe, expect, it, vi } from "vitest";

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
