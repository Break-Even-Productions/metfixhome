import { DETAIL_PAGE_CSP } from "./csp";
import type { Env } from "./upstream";

/** Public site key from Worker var (same rules as `/api/recaptcha-site-key.js`). */
export function detailPageRecaptchaSiteKey(env: Env): string {
  const raw = typeof env.RECAPTCHA_SITE_KEY === "string" ? env.RECAPTCHA_SITE_KEY.trim() : "";
  return /^[A-Za-z0-9_-]*$/.test(raw) ? raw : "";
}

export function withDetailPageCsp(headers: Headers): Headers {
  headers.set("Content-Security-Policy", DETAIL_PAGE_CSP);
  return headers;
}

/** Inject `window.__MFX_RECAPTCHA_SITE_KEY__` into the SPA shell `<head>`. */
export function injectRecaptchaSiteKey(response: Response, siteKey: string): Response {
  const snippet = `window.__MFX_RECAPTCHA_SITE_KEY__=${JSON.stringify(siteKey)};`;
  const rewriter = new HTMLRewriter();
  // Use `body` so Node's HTMLRewriter polyfill applies (head is not modeled there).
  rewriter.on("body", {
    element(el) {
      el.append(`<script>${snippet}</script>`, { html: true });
    },
  });
  return rewriter.transform(response);
}

/** CSP + optional reCAPTCHA bootstrap for post/library HTML handlers. */
export function finishDetailPageHtml(response: Response, env: Env): Response {
  const siteKey = detailPageRecaptchaSiteKey(env);
  const withKey = injectRecaptchaSiteKey(response, siteKey);
  const headers = withDetailPageCsp(new Headers(withKey.headers));
  return new Response(withKey.body, { status: withKey.status, headers });
}
