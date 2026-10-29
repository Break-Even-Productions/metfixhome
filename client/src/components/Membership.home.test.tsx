/**
 * @vitest-environment jsdom
 * WJ20: Membership mounted on Home.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("WJ20 Membership on Home", () => {
  it("Home.tsx imports and renders Membership", () => {
    const src = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(src).toMatch(/import\s+\{\s*Membership\s*\}\s+from\s+["']@\/components\/Membership["']/);
    expect(src).toMatch(/<Membership[\s>]/);
  });
});
