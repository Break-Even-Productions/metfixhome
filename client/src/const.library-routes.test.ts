/**
 * SS21 / SR19 — getRouterBase() + KNOWN_ROUTES library + topic entries.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getRouterBase } from "./const";

describe("getRouterBase library paths (SS21)", () => {
  it('returns "" at site root (covers /library, /library/search, /library/post/1, /topic/*)', () => {
    // vite.config base is "/"; getRouterBase short-circuits to "".
    expect(getRouterBase()).toBe("");
  });

  it('KNOWN_ROUTES includes "library" and "topic" exactly once each', () => {
    const src = readFileSync(fileURLToPath(new URL("./const.ts", import.meta.url)), "utf8");
    const knownBlock = src.match(/KNOWN_ROUTES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
    expect([...knownBlock.matchAll(/"library"/g)]).toHaveLength(1);
    expect([...knownBlock.matchAll(/"topic"/g)]).toHaveLength(1);
    // Path-segment short-circuit so /topic/:slug is not treated as a deploy base.
    expect(src).toMatch(/KNOWN_ROUTES\.has\(first\)/);
  });
});
