import { useEffect } from "react";

export type PageMeta = {
  title: string;
  description?: string;
  /** e.g. "noindex, follow" for 404 pages */
  robots?: string;
  /** Absolute canonical href; null removes any existing canonical link. */
  canonical?: string | null;
  ogType?: string;
  ogImage?: string;
  ogUrl?: string;
};

function setMetaContent(selector: string, content: string): (() => void) | undefined {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLMetaElement)) return undefined;
  const previous = el.getAttribute("content");
  el.setAttribute("content", content);
  return () => {
    if (previous == null) el.removeAttribute("content");
    else el.setAttribute("content", previous);
  };
}

function setOrCreateMeta(
  attr: "name" | "property",
  key: string,
  content: string,
): () => void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.querySelector(selector);
  let created = false;
  if (!(el instanceof HTMLMetaElement)) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
    created = true;
  }
  const previous = el.getAttribute("content");
  el.setAttribute("content", content);
  return () => {
    if (created) {
      el.remove();
      return;
    }
    if (previous == null) el.removeAttribute("content");
    else el.setAttribute("content", previous);
  };
}

function setCanonical(href: string | null): () => void {
  const existing = document.querySelector('link[rel="canonical"]');
  if (href == null) {
    if (existing) {
      const prevHref = existing.getAttribute("href");
      existing.remove();
      return () => {
        if (prevHref == null) return;
        const link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        link.setAttribute("href", prevHref);
        document.head.appendChild(link);
      };
    }
    return () => {};
  }

  let el = existing;
  let created = false;
  if (!(el instanceof HTMLLinkElement)) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
    created = true;
  }
  const previous = el.getAttribute("href");
  el.setAttribute("href", href);
  return () => {
    if (created) {
      el.remove();
      return;
    }
    if (previous == null) el.removeAttribute("href");
    else el.setAttribute("href", previous);
  };
}

/**
 * Sets document title and key meta tags for the current route (SPA).
 * Restores previous values on unmount.
 */
export function usePageMeta({
  title,
  description,
  robots,
  canonical,
  ogType,
  ogImage,
  ogUrl,
}: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const restorers: Array<(() => void) | undefined> = [];
    if (description) {
      restorers.push(setMetaContent('meta[name="description"]', description));
      restorers.push(setOrCreateMeta("property", "og:title", title));
      restorers.push(setOrCreateMeta("property", "og:description", description));
      restorers.push(setMetaContent('meta[name="twitter:title"]', title));
      restorers.push(setMetaContent('meta[name="twitter:description"]', description));
    }
    if (robots) {
      restorers.push(setOrCreateMeta("name", "robots", robots));
    }
    if (canonical !== undefined) {
      restorers.push(setCanonical(canonical));
    }
    if (ogType) {
      restorers.push(setOrCreateMeta("property", "og:type", ogType));
    }
    if (ogImage) {
      restorers.push(setOrCreateMeta("property", "og:image", ogImage));
    }
    if (ogUrl) {
      restorers.push(setOrCreateMeta("property", "og:url", ogUrl));
    }

    return () => {
      document.title = previousTitle;
      restorers.forEach((restore) => restore?.());
    };
  }, [title, description, robots, canonical, ogType, ogImage, ogUrl]);
}
