import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  expectedSearchHrefFromApp,
  librarySearchIsShadowed,
  librarySearchRendersSearchPage,
} from "./searchHref";

const appSrc = readFileSync(
  path.resolve(import.meta.dirname, "../App.tsx"),
  "utf8",
);

describe("search href ER-11 / ER-14", () => {
  it("current AppRoutes fall back to /library (no literal search route)", () => {
    expect(expectedSearchHrefFromApp(appSrc)).toBe("/library");
  });

  it("literal /library/search with Search page resolves", () => {
    const planted = `${appSrc}\n<Route path={"/library/search"} component={LibrarySearchPage} />\n`;
    expect(librarySearchRendersSearchPage(planted)).toBe(true);
    expect(librarySearchIsShadowed(planted)).toBe(false);
    expect(expectedSearchHrefFromApp(planted)).toBe("/library/search");
  });

  it("param /library/:slug does NOT count alone (ER-11)", () => {
    const planted = `${appSrc}\n<Route path={"/library/:slug"} component={LibrarySlug} />\n`;
    expect(expectedSearchHrefFromApp(planted)).toBe("/library");
  });

  it("param route before literal shadows → fallback /library (ER-14)", () => {
    const planted = [
      appSrc,
      `<Route path={"/library/:slug"} component={LibrarySlug} />`,
      `<Route path={"/library/search"} component={LibrarySearchPage} />`,
    ].join("\n");
    expect(librarySearchIsShadowed(planted)).toBe(true);
    expect(expectedSearchHrefFromApp(planted)).toBe("/library");
  });

  it("literal wired to NotFound does not resolve (ER-14)", () => {
    const planted = `${appSrc}\n<Route path={"/library/search"} component={NotFound} />\n`;
    expect(librarySearchRendersSearchPage(planted)).toBe(false);
    expect(expectedSearchHrefFromApp(planted)).toBe("/library");
  });

  it("literal after /library/:type/:id (2 params) is not shadowed", () => {
    // Current staging has /library/:type/:id — 2 segments required, so
    // /library/search (1 segment) does not match it.
    const planted = [
      `function AppRoutes(){ return (<>`,
      `<Route path={"/library/:type/:id"} component={LibraryDetailPage} />`,
      `<Route path={"/library/search"} component={LibrarySearchPage} />`,
      `<Route path={"/library"} component={LibraryPage} />`,
      `</>); }`,
    ].join("\n");
    expect(librarySearchIsShadowed(planted)).toBe(false);
    expect(expectedSearchHrefFromApp(planted)).toBe("/library/search");
  });
});
