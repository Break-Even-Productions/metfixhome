import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("site no longer ships a CMS schema", () => {
  it("studio schema directory is gone", () => {
    const dir = path.resolve(import.meta.dirname, "../../../../sanity");
    expect(fs.existsSync(dir)).toBe(false);
  });

  it("client content modules do not call a CMS client", () => {
    const lib = path.resolve(import.meta.dirname, "../../lib");
    const files = fs.readdirSync(lib).filter((name) => name.endsWith(".ts") && !name.includes(".test."));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const src = fs.readFileSync(path.join(lib, name), "utf8");
      expect(src, name).not.toMatch(/@sanity\/|sanityClient|apicdn\.sanity\.io/);
    }
  });
});
