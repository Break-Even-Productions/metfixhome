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

export function buildFullHead(
  day: DailyFixDay,
  opts: { bare: boolean; yymmdd: string; tab: DailyFixTab | null },
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
    imageUrl = forceHttpsUrl(day.body.photo_url);
  } else if (tab === "brain" && tabHasContent) {
    imageUrl = forceHttpsUrl(day.brain.photo_url);
  }
  if (!imageUrl) {
    imageUrl = forceHttpsUrl(day.belly.photo_url);
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

const STRIP_HEAD_RE =
  /<title\b[^>]*>[\s\S]*?<\/title>|<meta\s+name=["']description["'][^>]*>|<link\s+rel=["']canonical["'][^>]*>|<meta\s+property=["']og:(?:type|title|description|url|image|image:width|image:height|image:alt)["'][^>]*>|<meta\s+name=["']twitter:(?:card|title|description|image|image:alt)["'][^>]*>|<meta\s+name=["']robots["'][^>]*>/gi;

const REPLACE_SELECTORS = [
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
  'meta[name="robots"]',
];

export type HeadMode =
  | { mode: "full"; head: FullHead; dfInitialJson: string | null }
  | { mode: "generic" }
  | { mode: "generic_noindex" };

export function buildHeadSnippet(plan: HeadMode): string {
  if (plan.mode === "generic_noindex") {
    return `<meta name="robots" content="noindex">`;
  }
  if (plan.mode === "generic") {
    return "";
  }
  const h = plan.head;
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

export function applyHeadToHtml(html: string, plan: HeadMode): string {
  let out = html.replace(STRIP_HEAD_RE, "");
  const snippet = buildHeadSnippet(plan);
  if (snippet) {
    if (out.includes("</head>")) {
      out = out.replace("</head>", `${snippet}</head>`);
    } else {
      out = snippet + out;
    }
  }
  const dfJson = plan.mode === "full" ? plan.dfInitialJson : null;
  if (dfJson) {
    const tag = `<script type="application/json" id="df-initial">${dfJson}</script>`;
    if (out.includes("</body>")) {
      out = out.replace("</body>", `${tag}</body>`);
    } else {
      out += tag;
    }
  }
  return out;
}

class HeadRewriter {
  private injected = false;
  constructor(private readonly plan: HeadMode) {}

  element(element: Element) {
    if (this.injected) {
      element.remove();
      return;
    }
    this.injected = true;
    const html = buildHeadSnippet(this.plan);
    if (html) {
      element.replace(html, { html: true });
    } else {
      element.remove();
    }
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

/**
 * Spec §6: HTMLRewriter on the Worker.
 * Node/vitest has no HTMLRewriter — fall back to the equivalent string transform.
 */
export async function rewriteHtml(response: Response, plan: HeadMode): Promise<Response> {
  if (typeof HTMLRewriter === "undefined") {
    const html = await response.text();
    const next = applyHeadToHtml(html, plan);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(next, { status: response.status, headers });
  }

  const rewriter = new HTMLRewriter();
  const headRewriter = new HeadRewriter(plan);
  for (const sel of REPLACE_SELECTORS) {
    rewriter.on(sel, headRewriter);
  }
  const dfJson = plan.mode === "full" ? plan.dfInitialJson : null;
  rewriter.on("body", new DfInitialInjector(dfJson));
  return rewriter.transform(response);
}
