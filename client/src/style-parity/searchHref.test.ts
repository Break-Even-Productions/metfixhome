import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectedSearchHrefFromApp } from "./searchHref";

const appSrc = readFileSync(
  path.resolve(import.meta.dirname, "../App.tsx"),
  "utf8",
);

describe("search href ER-11 (literal /library/search only)", () => {
  it("current AppRoutes fall back to /library", () => {
    expect(expectedSearchHrefFromApp(appSrc)).toBe("/library");
  });

  it("literal /library/search route resolves", () => {
    const planted = `${appSrc}\n<Route path={"/library/search"} />\n`;
    expect(expectedSearchHrefFromApp(planted)).toBe("/library/search");
  });

  it("param route /library/:slug does NOT count (ER-11)", () => {
    const planted = `${appSrc}\n<Route path={"/library/:slug"} />\n`;
    expect(expectedSearchHrefFromApp(planted)).toBe("/library");
  });
});
