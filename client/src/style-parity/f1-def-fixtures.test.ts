import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VISUAL_MASKS } from "../../../tests/visual/masks";

const root = path.resolve(import.meta.dirname, "../../..");

describe("DEF4 / DEF6 / DEF9 fixtures", () => {
  it("DEF9: rename-map.json is empty object (style-only PR F)", () => {
    const map = JSON.parse(
      readFileSync(path.join(root, "tests/fixtures/rename-map.json"), "utf8"),
    );
    expect(map).toEqual({});
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("DEF6: beta-radius-shadow.json pins beta SHA and sets", () => {
    const j = JSON.parse(
      readFileSync(path.join(root, "tests/fixtures/beta-radius-shadow.json"), "utf8"),
    );
    expect(j.betaSha).toMatch(/^95f67814/);
    expect(j.borderRadius).toContain("1.75rem");
    expect(j.borderRadius).toContain("2.5rem");
    expect(j.boxShadow).toContain("none");
  });

  it("DEF4: every visual mask has a non-empty reason", () => {
    for (const m of VISUAL_MASKS) {
      expect(m.reason?.trim().length, String(m.path)).toBeGreaterThan(0);
    }
  });
});
