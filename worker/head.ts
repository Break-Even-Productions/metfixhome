import type { DailyFixDay, DailyFixTab } from "../shared/daily-fix";
import {
  METFIX_OG_FALLBACK_IMAGE,
  METFIX_OG_FALLBACK_SIZE,
  buildDescription,
  escapeAttr,
  forceHttpsUrl,
  prepareTitle,
  yymmddFromIso,
} from "../shared/daily-fix";
import type { PostsHead } from "../shared/posts";

export type FullHead = {
  title: string;
  description: string;
  canonical: string;
  ogUrl: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  imageAlt: string;
};

function rawPillarPhoto(raw: unknown, pillar: "belly" | "body" | "brain"): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const block = (raw as Record<string, unknown>)[pillar];
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const photo = (block as Record<string, unknown>).photo_url;
  return typeof photo === "string" ? photo : null;
}

/**
 * Build the Daily Fix SEO head.
 * Photo URLs prefer raw upstream (so http can be force-https'd per Spec 6.2);
 * the shared mapper still nulls http for the client (PR #5 lock).
 */
export function buildFullHead(
  day: DailyFixDay,
  opts: { bare: boolean; yymmdd: string; tab: DailyFixTab | null; raw?: unknown },
): FullHead {
  const ymd = opts.yymmdd || yymmddFromIso(day.date) || "";
  const titles: { belly?: string; body?: string; brain?: string } = {};
  const bellyTitle = prepareTitle(day.belly.title);
  const bodyTitle = prepareTitle(day.body.title);
  const brainTitle = prepareTitle(day.brain.title);
  if (bellyTitle) titles.belly = bellyTitle;
  if (bodyTitle) titles.body = bodyTitle;
  if (brainTitle) titles.brain = brainTitle;

  let title = `The Daily Fix - ${ymd}`;
  const tab = opts.tab;
  const tabHasContent =
    tab === "body" ? day.body.hasContent : tab === "brain" ? day.brain.hasContent : false;
  if (tab && tabHasContent) {
    title += tab === "body" ? " | Body" : " | Brain";
  }

  const description = buildDescription(ymd, titles);
  const canonical = opts.bare
    ? "https://metfix.org/the-daily-fix"
    : `https://metfix.org/the-daily-fix/${ymd}`;

  let ogUrl = canonical;
  if (tab && tabHasContent) {
    ogUrl = `${canonical}?tab=${tab}`;
  }

  let imageUrl: string | null = null;
  if (tab === "body" && tabHasContent) {
    imageUrl = forceHttpsUrl(rawPillarPhoto(opts.raw, "body") ?? day.body.photo_url);
  } else if (tab === "brain" && tabHasContent) {
    imageUrl = forceHttpsUrl(rawPillarPhoto(opts.raw, "brain") ?? day.brain.photo_url);
  }
  if (!imageUrl) {
    imageUrl = forceHttpsUrl(rawPillarPhoto(opts.raw, "belly") ?? day.belly.photo_url);
  }
  let imageWidth: number | null = null;
  let imageHeight: number | null = null;
  if (!imageUrl) {
    imageUrl = METFIX_OG_FALLBACK_IMAGE;
    imageWidth = METFIX_OG_FALLBACK_SIZE;
    imageHeight = METFIX_OG_FALLBACK_SIZE;
  }

  return {
    title,
    description,
    canonical,
    ogUrl,
    imageUrl,
    imageWidth,
    imageHeight,
    imageAlt: title,
  };
}

/** Full-mode tags replaced in document order (site robots meta is left alone). */
const FULL_REPLACE_SELECTORS = [
  "title",
  'meta[name="description"]',
  'link[rel="canonical"]',
  'meta[property="og:type"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:image"]',
  'meta[property="og:image:width"]',
  'meta[property="og:image:height"]',
  'meta[property="og:image:alt"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:alt"]',
];

export type HeadMode =
  | { mode: "full"; head: FullHead; dfInitialJson: string | null }
  | { mode: "posts"; head: PostsHead }
  | { mode: "generic" }
  | { mode: "generic_noindex" };

export function buildFullHeadSnippet(head: FullHead): string {
  const h = head;
  const parts = [
    `<title>${escapeAttr(h.title)}</title>`,
    `<meta name="description" content="${escapeAttr(h.description)}">`,
    `<link rel="canonical" href="${escapeAttr(h.canonical)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeAttr(h.title)}">`,
    `<meta property="og:description" content="${escapeAttr(h.description)}">`,
    `<meta property="og:url" content="${escapeAttr(h.ogUrl)}">`,
    `<meta property="og:image" content="${escapeAttr(h.imageUrl)}">`,
  ];
  if (h.imageWidth != null && h.imageHeight != null) {
    parts.push(`<meta property="og:image:width" content="${h.imageWidth}">`);
    parts.push(`<meta property="og:image:height" content="${h.imageHeight}">`);
  }
  parts.push(`<meta property="og:image:alt" content="${escapeAttr(h.imageAlt)}">`);
  parts.push(`<meta name="twitter:card" content="summary_large_image">`);
  parts.push(`<meta name="twitter:title" content="${escapeAttr(h.title)}">`);
  parts.push(`<meta name="twitter:description" content="${escapeAttr(h.description)}">`);
  parts.push(`<meta name="twitter:image" content="${escapeAttr(h.imageUrl)}">`);
  return parts.join("");
}

/** Posts list/detail head snippet (A18 / PH15 — values from buildPostsHead). */
export function buildPostsHeadSnippet(head: PostsHead): string {
  const h = head;
  const parts = [
    `<title>${escapeAttr(h.title)}</title>`,
    `<meta name="description" content="${escapeAttr(h.description)}">`,
    `<meta name="robots" content="${escapeAttr(h.robots)}">`,
  ];
  if (h.canonical) {
    parts.push(`<link rel="canonical" href="${escapeAttr(h.canonical)}">`);
  }
  parts.push(`<meta property="og:type" content="${escapeAttr(h.ogType)}">`);
  parts.push(`<meta property="og:title" content="${escapeAttr(h.ogTitle)}">`);
  parts.push(`<meta property="og:description" content="${escapeAttr(h.ogDescription)}">`);
  parts.push(`<meta property="og:url" content="${escapeAttr(h.ogUrl)}">`);
  parts.push(`<meta property="og:image" content="${escapeAttr(h.ogImage)}">`);
  parts.push(`<meta name="twitter:card" content="summary_large_image">`);
  parts.push(`<meta name="twitter:title" content="${escapeAttr(h.ogTitle)}">`);
  parts.push(`<meta name="twitter:description" content="${escapeAttr(h.ogDescription)}">`);
  parts.push(`<meta name="twitter:image" content="${escapeAttr(h.ogImage)}">`);
  return parts.join("");
}

class RemoveElement {
  element(element: Element) {
    element.remove();
  }
}

class ReplaceRobotsNoindex {
  private done = false;
  element(element: Element) {
    if (this.done) {
      element.remove();
      return;
    }
    this.done = true;
    element.replace(`<meta name="robots" content="noindex">`, { html: true });
  }
}

class FullHeadRewriter {
  private injected = false;
  constructor(private readonly head: FullHead) {}

  element(element: Element) {
    if (this.injected) {
      element.remove();
      return;
    }
    this.injected = true;
    element.replace(buildFullHeadSnippet(this.head), { html: true });
  }
}

class PostsHeadRewriter {
  private injected = false;
  constructor(private readonly head: PostsHead) {}

  element(element: Element) {
    if (this.injected) {
      element.remove();
      return;
    }
    this.injected = true;
    element.replace(buildPostsHeadSnippet(this.head), { html: true });
  }
}

class DfInitialInjector {
  constructor(private readonly json: string | null) {}
  element(element: Element) {
    if (!this.json) return;
    element.append(`<script type="application/json" id="df-initial">${this.json}</script>`, {
      html: true,
    });
  }
}

/** Selectors replaced for posts mode (includes robots; optional canonical via snippet). */
const POSTS_REPLACE_SELECTORS = [
  "title",
  'meta[name="description"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
  'meta[property="og:type"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:image"]',
  'meta[property="og:image:width"]',
  'meta[property="og:image:height"]',
  'meta[property="og:image:alt"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:image:alt"]',
];

/**
 * Spec §6: HTMLRewriter on the Worker (workerd always provides HTMLRewriter).
 *
 * - full: replace title/description/canonical/og/twitter; leave site robots alone; inject df-initial
 * - posts: replace title/description/robots/canonical/og/twitter from buildPostsHead (PH15)
 * - generic: remove only canonical + og:url (keep site title/description/robots)
 * - generic_noindex: same as generic, plus swap robots → noindex
 */
export function rewriteHtml(response: Response, plan: HeadMode): Response {
  const rewriter = new HTMLRewriter();

  if (plan.mode === "generic") {
    rewriter.on('link[rel="canonical"]', new RemoveElement());
    rewriter.on('meta[property="og:url"]', new RemoveElement());
    return rewriter.transform(response);
  }

  if (plan.mode === "generic_noindex") {
    rewriter.on('link[rel="canonical"]', new RemoveElement());
    rewriter.on('meta[property="og:url"]', new RemoveElement());
    rewriter.on('meta[name="robots"]', new ReplaceRobotsNoindex());
    return rewriter.transform(response);
  }

  if (plan.mode === "posts") {
    const postsRewriter = new PostsHeadRewriter(plan.head);
    for (const sel of POSTS_REPLACE_SELECTORS) {
      // When snippet has no canonical, still match the site's link so the
      // rewriter removes it after the first inject (same as other selectors).
      rewriter.on(sel, postsRewriter);
    }
    return rewriter.transform(response);
  }

  const headRewriter = new FullHeadRewriter(plan.head);
  for (const sel of FULL_REPLACE_SELECTORS) {
    rewriter.on(sel, headRewriter);
  }
  rewriter.on("body", new DfInitialInjector(plan.dfInitialJson));
  return rewriter.transform(response);
}
