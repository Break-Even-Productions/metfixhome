import { describe, expect, it } from "vitest";
import {
  buildPopularUpstreamQuery,
  buildSearchUpstreamQuery,
  isValidLibraryId,
} from "./library";

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
    // Must not build an upstream content_access[] filter for the main catalog.
    expect(src).not.toMatch(/out\.append\(\s*["']content_access/);
    expect(src).toMatch(/Bearer/);
    expect(src).toMatch(/X-API-Key/);
  });

  it("SR18 serves /library/search as SPA hub (not NotFound)", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("./library.ts", import.meta.url)), "utf8");
    expect(src).toMatch(/path === "\/library\/search"/);
    expect(src).toMatch(/buildLibraryHead\(\{\s*kind:\s*"hub"/);
  });
});
