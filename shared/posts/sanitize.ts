import { decodeHtmlEntitiesOnce } from "../daily-fix/text";
import { IMAGE_HOST } from "./constants";
import {
  ALLOWED_ATTR,
  ALLOWED_TAG_SET,
  IMG_ADDED_ATTR,
  LINK_REL,
  METFIX_ORIGIN,
  REMOVE_WITH_CONTENT_SET,
  SANITIZE_BASE,
  VOID_TAGS,
} from "./sanitizeConfig";

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const CDATA_RE = /<!\[CDATA\[[\s\S]*?\]\]>/gi;

/** Strip HTML comments and CDATA sections (PS6). */
function stripCommentsAndCdata(html: string): string {
  return html.replace(COMMENT_RE, "").replace(CDATA_RE, "");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Parse a start-tag's attribute list into a lowercased name → raw value map.
 * Handles double/single/unquoted values; skips malformed junk.
 */
function parseAttrs(attrText: string): Map<string, string> {
  const out = new Map<string, string>();
  const re =
    /([^\s"'>/=\x00-\x1f]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrText))) {
    const name = m[1]!.toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    out.set(name, value);
  }
  return out;
}

/** Drop control chars that obfuscate schemes (`java\tscript:`). */
function scrubControls(input: string): string {
  return input.replace(/[\u0000-\u001f\u007f]/g, "");
}

function schemeOf(href: string): string | null {
  const decoded = scrubControls(decodeHtmlEntitiesOnce(href)).trim();
  const nospace = decoded.replace(/\s+/g, "");
  const m = nospace.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  return m ? m[1]!.toLowerCase() : null;
}

function hasExplicitPort(raw: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[^/@]+@)?[^/:]+:\d+/.test(raw);
}

/**
 * Resolve href against SANITIZE_BASE; allow only https / http / mailto.
 * Returns normalized href or null if the attribute must be removed.
 */
function resolveHref(raw: string): string | null {
  const decoded = scrubControls(decodeHtmlEntitiesOnce(raw)).trim();
  if (!decoded) return null;
  const scheme = schemeOf(decoded);
  if (scheme != null && scheme !== "https" && scheme !== "http" && scheme !== "mailto") {
    return null;
  }
  try {
    if (scheme === "mailto") {
      const url = new URL(decoded);
      if (url.protocol !== "mailto:") return null;
      return url.href;
    }
    const url = new URL(decoded, SANITIZE_BASE);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Image URL allowlist (DR6 / PS5): resolve relative, https only, exact host,
 * no credentials, no explicit port. Returns normalized href or null.
 */
export function allowlistedImageUrl(raw: string): string | null {
  const decoded = scrubControls(decodeHtmlEntitiesOnce(raw)).trim();
  if (!decoded) return null;
  if (hasExplicitPort(decoded)) return null;
  // Protocol-relative `//host/...` must not resolve via SANITIZE_BASE (PW35 / PS5).
  if (decoded.startsWith("//")) return null;
  // Only path-absolute relatives resolve; bare words are not image URLs.
  if (!decoded.startsWith("/") && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    return null;
  }
  try {
    const url = new URL(decoded, SANITIZE_BASE);
    if (url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    if (url.port !== "") return null;
    if (url.hostname !== IMAGE_HOST) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Validate every srcset candidate; any bad candidate → drop whole attribute. */
function sanitizeSrcset(raw: string): string | null {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const out: string[] = [];
  for (const part of parts) {
    const tokens = part.split(/\s+/);
    const urlPart = tokens[0]!;
    const descriptor = tokens.slice(1).join(" ");
    const allowed = allowlistedImageUrl(urlPart);
    if (!allowed) return null;
    out.push(descriptor ? `${allowed} ${descriptor}` : allowed);
  }
  return out.join(", ");
}

function isExternalHref(href: string): boolean {
  try {
    if (href.startsWith("mailto:")) return false;
    const url = new URL(href);
    return url.origin !== METFIX_ORIGIN;
  } catch {
    return true;
  }
}

function isMailto(href: string): boolean {
  return href.startsWith("mailto:");
}

type AttrPair = { name: string; value: string };

function buildAnchorAttrs(attrs: Map<string, string>): AttrPair[] | null {
  const allowed = ALLOWED_ATTR.a;
  const out: AttrPair[] = [];
  let href: string | null = null;

  for (const name of allowed) {
    if (!attrs.has(name)) continue;
    const raw = attrs.get(name)!;
    if (name === "href") {
      href = resolveHref(raw);
      if (href == null) continue; // drop href, keep element + text
      out.push({ name: "href", value: href });
    } else {
      out.push({ name, value: raw });
    }
  }

  out.push({ name: "rel", value: LINK_REL });
  if (href && !isMailto(href) && isExternalHref(href)) {
    out.push({ name: "target", value: "_blank" });
  }
  return out;
}

/**
 * Build img attrs. Returns null → drop the whole `img` element (bad src).
 */
function buildImgAttrs(attrs: Map<string, string>): AttrPair[] | null {
  const allowed = ALLOWED_ATTR.img;
  const out: AttrPair[] = [];

  const srcRaw = attrs.get("src");
  if (srcRaw == null) return null;
  const src = allowlistedImageUrl(srcRaw);
  if (src == null) return null;
  out.push({ name: "src", value: src });

  for (const name of allowed) {
    if (name === "src") continue;
    if (!attrs.has(name)) continue;
    const raw = attrs.get(name)!;
    if (name === "srcset") {
      const srcset = sanitizeSrcset(raw);
      if (srcset != null) out.push({ name: "srcset", value: srcset });
      // bad srcset → omit attribute only
      continue;
    }
    out.push({ name, value: raw });
  }

  out.push({ name: "loading", value: IMG_ADDED_ATTR.loading });
  out.push({ name: "referrerpolicy", value: IMG_ADDED_ATTR.referrerpolicy });
  return out;
}

function serializeOpen(tag: string, attrs: AttrPair[], selfClosing: boolean): string {
  let s = `<${tag}`;
  for (const { name, value } of attrs) {
    s += ` ${name}="${escapeAttr(value)}"`;
  }
  s += selfClosing ? " />" : ">";
  return s;
}

type Token =
  | { kind: "text"; value: string }
  | { kind: "open"; tag: string; attrs: Map<string, string>; selfClosing: boolean; raw: string }
  | { kind: "close"; tag: string };

/**
 * Quote-aware tag end finder: does not treat `>` inside quoted attr values
 * as the end of the tag (needed for PS6 mXSS fixtures).
 */
function findTagEnd(html: string, start: number): number {
  let i = start;
  let quote: '"' | "'" | null = null;
  while (i < html.length) {
    const ch = html[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === ">") return i;
    i++;
  }
  return -1;
}

/**
 * Lightweight HTML tokenizer. Quote-aware so `</tag>` inside attribute values
 * is not treated as a real close tag (PS6).
 */
function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      tokens.push({ kind: "text", value: html.slice(i) });
      break;
    }
    if (lt > i) {
      tokens.push({ kind: "text", value: html.slice(i, lt) });
    }

    // Close tag
    const close = html.slice(lt).match(/^<\/\s*([a-zA-Z][a-zA-Z0-9]*)\s*>/);
    if (close) {
      tokens.push({ kind: "close", tag: close[1]!.toLowerCase() });
      i = lt + close[0].length;
      continue;
    }

    // Open / void tag
    const open = html.slice(lt).match(/^<\s*([a-zA-Z][a-zA-Z0-9]*)/);
    if (open) {
      const tagEnd = findTagEnd(html, lt + 1);
      if (tagEnd === -1) {
        tokens.push({ kind: "text", value: html.slice(lt) });
        break;
      }
      const full = html.slice(lt, tagEnd + 1);
      const tag = open[1]!.toLowerCase();
      const afterName = lt + open[0].length;
      const attrText = html.slice(afterName, tagEnd);
      const selfClosing = /\/\s*>$/.test(full) || VOID_TAGS.has(tag);
      tokens.push({
        kind: "open",
        tag,
        attrs: parseAttrs(attrText),
        selfClosing,
        raw: full,
      });
      i = tagEnd + 1;
      continue;
    }

    // Lone `<` — treat as text
    tokens.push({ kind: "text", value: "<" });
    i = lt + 1;
  }
  return tokens;
}

type Frame = {
  tag: string;
  /** When true, discard all descendant output until matching close. */
  remove: boolean;
  /** When true, tag was unwrapped — no close tag to emit. */
  unwrap: boolean;
  /** When true, we emitted an open tag and need a close. */
  opened: boolean;
};

/**
 * String-based allowlist sanitizer (A13 / PS1–PS7).
 * Pure: runs in Node tests and Workers. Idempotent.
 */
export function sanitizeHtmlString(html: string): string {
  if (!html) return "";
  const cleaned = stripCommentsAndCdata(html);
  const tokens = tokenize(cleaned);
  const out: string[] = [];
  const stack: Frame[] = [];

  const removing = (): boolean => stack.some((f) => f.remove);

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;

    if (tok.kind === "text") {
      if (!removing()) out.push(tok.value);
      continue;
    }

    if (tok.kind === "close") {
      let idx = -1;
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s]!.tag === tok.tag) {
          idx = s;
          break;
        }
      }
      if (idx === -1) continue;
      // Close + pop from top down through the matched frame
      while (stack.length > idx) {
        const f = stack.pop()!;
        if (f.opened && !f.remove) {
          out.push(`</${f.tag}>`);
        }
      }
      continue;
    }

    // open
    const tag = tok.tag;

    if (REMOVE_WITH_CONTENT_SET.has(tag)) {
      // Void-like or self-closing dangerous tags must not open a remove frame
      // that would swallow the rest of the document (`<link>`, `<meta>`, `<input>`).
      // `embed`/`object` may carry child text in fixtures (PS2) — open a remove frame
      // unless the token is self-closing. True void tags must not swallow the document.
      const voidLike =
        tok.selfClosing ||
        tag === "input" ||
        tag === "link" ||
        tag === "meta" ||
        tag === "base";
      if (voidLike) continue;
      stack.push({ tag, remove: true, unwrap: false, opened: false });
      continue;
    }

    if (removing()) {
      if (!tok.selfClosing && !VOID_TAGS.has(tag)) {
        stack.push({ tag, remove: true, unwrap: false, opened: false });
      }
      continue;
    }

    if (!ALLOWED_TAG_SET.has(tag)) {
      // Unwrap: keep text/descendants, drop the tag itself
      if (!tok.selfClosing && !VOID_TAGS.has(tag)) {
        stack.push({ tag, remove: false, unwrap: true, opened: false });
      }
      continue;
    }

    // Allowed tag
    if (tag === "a") {
      const attrs = buildAnchorAttrs(tok.attrs) ?? [];
      if (tok.selfClosing) {
        out.push(serializeOpen("a", attrs, true));
      } else {
        out.push(serializeOpen("a", attrs, false));
        stack.push({ tag: "a", remove: false, unwrap: false, opened: true });
      }
      continue;
    }

    if (tag === "img") {
      const attrs = buildImgAttrs(tok.attrs);
      if (attrs == null) continue; // drop whole img
      out.push(serializeOpen("img", attrs, true));
      continue;
    }

    // Other allowed tags: strip all attributes (Q10)
    if (VOID_TAGS.has(tag) || tok.selfClosing) {
      out.push(serializeOpen(tag, [], true));
    } else {
      out.push(serializeOpen(tag, [], false));
      stack.push({ tag, remove: false, unwrap: false, opened: true });
    }
  }

  // Close any still-open allowed tags (malformed input)
  for (let s = stack.length - 1; s >= 0; s--) {
    const f = stack[s]!;
    if (f.opened && !f.remove) out.push(`</${f.tag}>`);
  }

  return out.join("");
}

/**
 * Public sanitizer entry. Uses the string path (works in Node + Workers).
 * When `HTMLRewriter` exists, still runs the string path so unit tests and
 * Worker output share one deterministic implementation (PS7 idempotence).
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlString(html);
}

/**
 * Optional HTMLRewriter-backed path for environments that provide it.
 * Falls back to the string sanitizer (HTMLRewriter cannot unwrap tags).
 */
export function sanitizeHtmlPreferRewriter(html: string): string {
  // HTMLRewriter has no unwrap primitive; string path is authoritative.
  void (globalThis as { HTMLRewriter?: unknown }).HTMLRewriter;
  return sanitizeHtmlString(html);
}
