export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Legacy BSI WordPress login (site chrome that still points off-site). */
export const LOGIN_URL = "https://brokenscience.org/login/";

/** In-app MetFix member login (Worker session). */
export const METFIX_LOGIN_PATH = "/login";

export const getLoginUrl = () => LOGIN_URL;

export function getMetfixLoginUrl(next?: string): string {
  const path = basePath(METFIX_LOGIN_PATH);
  if (!next) return path;
  const params = new URLSearchParams({ next });
  return `${path}?${params.toString()}`;
}

const KNOWN_ROUTES = new Set([
  "classes",
  "courses",
  "become-an-affiliate",
  "affiliate-seminars",
  "the-daily-fix",
  "posts",
  "library",
  "topic",
  "login",
  "404",
]);

/** Wouter base path from Vite `base` (Cloudflare Workers; `base: "/"`). */
export function getRouterBase(): string {
  const base = import.meta.env.BASE_URL;
  if (base !== "./") return base.replace(/\/$/, "");

  const [first] = window.location.pathname.split("/").filter(Boolean);
  if (!first || KNOWN_ROUTES.has(first)) return "";
  return `/${first}`;
}

/** Public asset URL with Vite `BASE_URL` (site root when `base: "/"`). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\//, "")}`;
}

/** Internal route or hash link with site base path. */
export function basePath(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const prefix = getRouterBase();
  if (path.startsWith("/#")) return `${prefix}/#${path.slice(2)}`;
  return `${prefix}${path}`;
}

export const HOME_SCROLL_KEY = "metfix-home-scroll";

export function requestHomeScroll(sectionId: string) {
  sessionStorage.setItem(HOME_SCROLL_KEY, sectionId);
}

export function scrollToHomeSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${sectionId}`);
  }
}
