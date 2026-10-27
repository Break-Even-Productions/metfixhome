/**
 * SS21 / SR19 — getRouterBase() + KNOWN_ROUTES library entry.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getRouterBase } from "./const";

describe("getRouterBase library paths (SS21)", () => {
  it('returns "" at site root (covers /library, /library/search, /library/post/1)', () => {
    // vite.config base is "/"; getRouterBase short-circuits to "".
    expect(getRouterBase()).toBe("");
  });

  it('KNOWN_ROUTES gains exactly one "library" line', () => {
    const src = readFileSync(fileURLToPath(new URL("./const.ts", import.meta.url)), "utf8");
    const knownBlock = src.match(/KNOWN_ROUTES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
    expect([...knownBlock.matchAll(/"library"/g)]).toHaveLength(1);
  });

  it('KNOWN_ROUTES includes "topic" (SS21)', () => {
    const src = readFileSync(fileURLToPath(new URL("./const.ts", import.meta.url)), "utf8");
    expect(src).toMatch(/"topic"/);
  });
});
