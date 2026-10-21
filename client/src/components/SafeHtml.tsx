/**
 * Posts HTML sink (A14 / N3). Only place in the posts path that uses
 * dangerouslySetInnerHTML — always fed DOMPurify output with the shared allowlist.
 */
import { useMemo } from "react";
import DOMPurify from "dompurify";
import { allowlistedImageUrl } from "@shared/posts/sanitize";
import {
  ALLOWED_ATTR,
  ALLOWED_TAGS,
  IMG_ADDED_ATTR,
  LINK_REL,
  METFIX_ORIGIN,
  SANITIZE_BASE,
} from "@shared/posts/sanitizeConfig";

/** Identity import of the shared allowlist (PS9 / CQ14). */
export const SAFE_HTML_ALLOWED_TAGS = ALLOWED_TAGS;
export const SAFE_HTML_ALLOWED_ATTR = ALLOWED_ATTR;

/** Flat attr names DOMPurify accepts (plus sanitizer-added attrs). */
const PURIFY_ATTRS: string[] = [
  ...new Set([
    ...Object.values(ALLOWED_ATTR).flatMap((attrs) => [...attrs]),
    "loading",
    "referrerpolicy",
    "rel",
    "target",
  ]),
];

let hooksInstalled = false;

function resolveHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const nospace = trimmed.replace(/\s+/g, "");
  const schemeMatch = nospace.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  const scheme = schemeMatch ? schemeMatch[1]!.toLowerCase() : null;
  if (scheme != null && scheme !== "https" && scheme !== "http" && scheme !== "mailto") {
    return null;
  }
  try {
    if (scheme === "mailto") {
      const url = new URL(trimmed);
      return url.protocol === "mailto:" ? url.href : null;
    }
    const url = new URL(trimmed, SANITIZE_BASE);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeSrcset(raw: string): string | null {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const out: string[] = [];
  for (const part of parts) {
    const [urlPart, ...rest] = part.split(/\s+/);
    if (!urlPart) return null;
    const ok = allowlistedImageUrl(urlPart);
    if (!ok) return null;
    out.push(rest.length > 0 ? `${ok} ${rest.join(" ")}` : ok);
  }
  return out.join(", ");
}

function ensureHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    const tag = node.nodeName.toLowerCase();
    if (tag === "a" && data.attrName === "href") {
      const resolved = resolveHref(data.attrValue);
      if (!resolved) {
        data.keepAttr = false;
        return;
      }
      data.attrValue = resolved;
      return;
    }
    if (tag === "img") {
      if (data.attrName === "src") {
        const ok = allowlistedImageUrl(data.attrValue);
        if (!ok) {
          data.keepAttr = false;
          return;
        }
        data.attrValue = ok;
        return;
      }
      if (data.attrName === "srcset") {
        const normalized = normalizeSrcset(data.attrValue);
        if (!normalized) {
          data.keepAttr = false;
          return;
        }
        data.attrValue = normalized;
      }
    }
  });

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof Element)) return;
    const tag = node.nodeName.toLowerCase();
    if (tag === "img") {
      if (!node.getAttribute("src")) {
        node.remove();
        return;
      }
      node.setAttribute("loading", IMG_ADDED_ATTR.loading);
      node.setAttribute("referrerpolicy", IMG_ADDED_ATTR.referrerpolicy);
      return;
    }
    if (tag === "a" && node.hasAttribute("href")) {
      const href = node.getAttribute("href")!;
      node.setAttribute("rel", LINK_REL);
      try {
        if (href.startsWith("mailto:")) {
          node.removeAttribute("target");
          return;
        }
        const origin = new URL(href, SANITIZE_BASE).origin;
        if (origin !== METFIX_ORIGIN) {
          node.setAttribute("target", "_blank");
        } else {
          node.removeAttribute("target");
        }
      } catch {
        node.removeAttribute("target");
      }
    }
  });
}

export type SafeHtmlProps = {
  html: string;
  className?: string;
  as?: "div" | "article" | "section";
};

/**
 * Sanitize `html` with DOMPurify using the shared posts allowlist, then render.
 */
export function SafeHtml({ html, className, as: Tag = "div" }: SafeHtmlProps) {
  const clean = useMemo(() => {
    ensureHooks();
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [...ALLOWED_TAGS],
      ALLOWED_ATTR: PURIFY_ATTRS,
      ADD_ATTR: ["target", "rel", "loading", "referrerpolicy"],
      ALLOW_DATA_ATTR: false,
    });
  }, [html]);

  return <Tag className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export default SafeHtml;
