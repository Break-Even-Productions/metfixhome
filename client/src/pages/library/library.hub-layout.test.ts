/**
 * Node scans: section grid and the home page staying off the library rails.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("library hub layout and home prefetch", () => {
  it("keeps the desktop three-column rail and leads tablet and mobile with one full-width card", () => {
    const css = readFileSync(
      fileURLToPath(new URL("./library.css", import.meta.url)),
      "utf8",
    );
    expect(css).toMatch(/\.library-rail > :first-child \{\s*grid-column: 1 \/ -1;/);
    expect(css).toMatch(
      /@media \(min-width: 1024px\) \{\s*\.library-rail \{\s*grid-template-columns: repeat\(3, 1fr\);/,
    );
    expect(css).toMatch(/\.library-rail > :first-child \{\s*grid-column: auto;/);
    expect(css).not.toMatch(/min-width:\s*720px/);
  });

  it("does not prefetch library sections from the home page", () => {
    const homeDir = fileURLToPath(
      new URL("../../components/home", import.meta.url),
    );
    const hits = readdirSync(homeDir).filter((name) => {
      if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return false;
      const text = readFileSync(join(homeDir, name), "utf8");
      return /\/api\/library|fetchLibrary/.test(text);
    });
    expect(hits).toEqual([]);
  });
});
