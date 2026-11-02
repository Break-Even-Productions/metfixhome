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
  it("current AppRoutes resolve literal /library/search (PR #24)", () => {
    expect(librarySearchRendersSearchPage(appSrc)).toBe(true);
    expect(librarySearchIsShadowed(appSrc)).toBe(false);
    expect(expectedSearchHrefFromApp(appSrc)).toBe("/library/search");
  });

  it("literal /library/search with Search page resolves", () => {
    const planted = `${appSrc}\n<Route path={"/library/search"} component={LibrarySearchPage} />\n`;
    expect(librarySearchRendersSearchPage(planted)).toBe(true);
    expect(librarySearchIsShadowed(planted)).toBe(false);
    expect(expectedSearchHrefFromApp(planted)).toBe("/library/search");
  });

  it("param /library/:slug alone does NOT resolve search (ER-11)", () => {
    const planted = [
      `function AppRoutes(){ return (<>`,
      `<Route path={"/library/:slug"} component={LibrarySlug} />`,
      `<Route path={"/library"} component={LibraryPage} />`,
      `</>); }`,
    ].join("\n");
    expect(expectedSearchHrefFromApp(planted)).toBe("/library");
  });

  it("param route before literal shadows → fallback /library (ER-14)", () => {
    const planted = [
      `function AppRoutes(){ return (<>`,
      `<Route path={"/library/:slug"} component={LibrarySlug} />`,
      `<Route path={"/library/search"} component={LibrarySearchPage} />`,
      `<Route path={"/library"} component={LibraryPage} />`,
      `</>); }`,
    ].join("\n");
    expect(librarySearchIsShadowed(planted)).toBe(true);
    expect(expectedSearchHrefFromApp(planted)).toBe("/library");
  });

  it("literal wired to NotFound does not resolve (ER-14)", () => {
    const planted = [
      `function AppRoutes(){ return (<>`,
      `<Route path={"/library/search"} component={NotFound} />`,
      `<Route path={"/library"} component={LibraryPage} />`,
      `</>); }`,
    ].join("\n");
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
