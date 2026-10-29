import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DETAIL_POST_KEYS } from "./guards";

describe("detail guard lockstep (TC10)", () => {
  it("DETAIL_POST_KEYS matches library detail resource term fields", () => {
    const libGuards = readFileSync(
      fileURLToPath(new URL("../library/guards.ts", import.meta.url)),
      "utf8",
    );
    expect(libGuards).toContain("topics");
    expect(libGuards).toContain("categories");
    expect(libGuards).toContain("content_types");
    expect(DETAIL_POST_KEYS).toContain("topics");
    expect(DETAIL_POST_KEYS).toContain("categories");
    expect(DETAIL_POST_KEYS).toContain("content_types");
    expect(DETAIL_POST_KEYS).toContain("video");
    expect(DETAIL_POST_KEYS).toContain("locked");
    expect(DETAIL_POST_KEYS).toContain("access");
  });
});
