/**
 * T-E-NAV-1 / T-E-NAV-9 / T-E-60 (rev1.0.12 + errata ER-11 / ER-14).
 * Search href derivation imports F1-owned `@/style-parity/searchHref`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEARCH_HREF as CONST_SEARCH_HREF } from "@/const";
import {
  expectedSearchHrefFromApp,
  librarySearchIsShadowed,
  listRoutePathsInOrder,
} from "@/style-parity/searchHref";
import {
  GLOBAL_NAV_ITEMS,
  GLOBAL_NAV_SEARCH_HREF,
  SEARCH_HREF,
  resolveSearchHref,
} from "./GlobalNav";

const APP_TSX = join(process.cwd(), "client/src/App.tsx");
const GLOBAL_NAV_SRC = join(process.cwd(), "client/src/components/GlobalNav.tsx");
const CONST_SRC = join(process.cwd(), "client/src/const.ts");
const ALLOWED_EXTERNAL = [
  "https://whatis.metfix.org/",
  "https://brokenscience.org/metfix/metfix-map/",
  "https://brokenscience.org/shop/",
];

const APP_ROUTES = [
  "/",
  "/login",
  "/join",
  "/become-an-affiliate",
  "/classes",
  "/courses",
  "/affiliate-seminars",
  "/the-daily-fix",
  "/posts",
  "/library",
  "/account",
  "/members",
];

function pathOf(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.includes("#")) return href.split("#")[0] || "/";
  return href;
}

describe("T-E-NAV-1 / T-E-NAV-9 GlobalNav routes", () => {
  it("every nav href resolves to AppRoutes path or allowlisted external host", () => {
    for (const item of GLOBAL_NAV_ITEMS) {
      if (item.openInNewTab || item.href.startsWith("http")) {
        expect(ALLOWED_EXTERNAL).toContain(item.href);
        continue;
      }
      const path = pathOf(item.href);
      const ok =
        path === "/" ||
        path === "" ||
        APP_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
      expect(ok, item.href).toBe(true);
    }
  });

  it("drops Find a Doctor and other beta-only items", () => {
    const labels = GLOBAL_NAV_ITEMS.map((i) => i.label.toLowerCase());
    expect(labels).not.toContain("find a doctor");
    expect(labels).not.toContain("partner with us");
    expect(labels).not.toContain("build a gym");
    expect(labels).not.toContain("our team");
    expect(labels).not.toContain("advisory board");
    expect(labels).not.toContain("scholarship");
  });

  it("Find a Gym points at brokenscience map", () => {
    const gym = GLOBAL_NAV_ITEMS.find((i) => i.label === "Find a Gym");
    expect(gym?.href).toBe("https://brokenscience.org/metfix/metfix-map/");
  });

  it("ER-11/14: SEARCH_HREF needs literal unshadowed /library/search — current AppRoutes → /library", () => {
    const app = readFileSync(APP_TSX, "utf8");
    const paths = listRoutePathsInOrder(app);
    expect(paths).toContain("/library");
    expect(paths).not.toContain("/library/search");
    expect(librarySearchIsShadowed(app)).toBe(false);
    const expected = expectedSearchHrefFromApp(app);
    expect(expected).toBe("/library");
    expect(resolveSearchHref(app)).toBe(expected);
    expect(SEARCH_HREF).toBe(expected);
    expect(GLOBAL_NAV_SEARCH_HREF).toBe(expected);
    expect(CONST_SEARCH_HREF).toBe(expected);
  });

  it("ER-11/14 planted: param routes do not count; shadowed literal → /library", () => {
    expect(expectedSearchHrefFromApp(`<Route path="/library/:slug" />`)).toBe(
      "/library",
    );
    expect(
      expectedSearchHrefFromApp(
        `<Route path="/library/:type/:id" /><Route path="/library" />`,
      ),
    ).toBe("/library");
    expect(
      expectedSearchHrefFromApp(
        `<Route path="/library/search" component={LibrarySearch} />`,
      ),
    ).toBe("/library/search");
    // ER-14: earlier param route that matches /library/search shadows the literal
    expect(
      expectedSearchHrefFromApp(
        `<Route path="/library/:slug" /><Route path="/library/search" component={LibrarySearch} />`,
      ),
    ).toBe("/library");
  });

  it("T-E-60: no overlay symbols; SEARCH_HREF once; visible Search link text", () => {
    const src = readFileSync(GLOBAL_NAV_SRC, "utf8");
    expect(src).not.toMatch(/SearchOverlay/);
    expect(src).not.toMatch(/SEARCH_ITEMS/);
    expect(src).not.toMatch(/searchOpen/);
    expect(src).not.toMatch(/setSearchOpen/);
    expect(src).toMatch(/<span>Search<\/span>/);
    expect(src).not.toMatch(/sr-only">Search/);
    const constSrc = readFileSync(CONST_SRC, "utf8");
    expect(constSrc.match(/export const SEARCH_HREF/g)).toHaveLength(1);
  });
});
