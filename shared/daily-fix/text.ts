/** Strip HTML tags (non-greedy). */
export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/**
 * Decode HTML entities exactly once (not recursively).
 * `&amp;#8211;` → `&#8211;` (not `–`).
 */
export function decodeHtmlEntitiesOnce(input: string): string {
  return input.replace(
    /&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g,
    (entity, body: string) => {
      if (body === "amp") return "&";
      if (body === "lt") return "<";
      if (body === "gt") return ">";
      if (body === "quot") return '"';
      if (body === "apos") return "'";
      if (body === "nbsp") return "\u00A0";
      if (body.startsWith("#x") || body.startsWith("#X")) {
        const code = Number.parseInt(body.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
      }
      if (body.startsWith("#")) {
        const code = Number.parseInt(body.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
      }
      return entity;
    },
  );
}

/** Attribute-escape for HTML attribute values. */
export function escapeAttr(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Prepare a pillar title for head: strip tags, decode once. */
export function prepareTitle(raw: string): string {
  return decodeHtmlEntitiesOnce(stripTags(raw));
}

/**
 * CQ description cut: if code-point length > 155, take 154, cut to last space,
 * trim trailing `.,:;-` and spaces, append … (U+2026).
 */
export function cutDescription(d: string): string {
  const chars = Array.from(d);
  if (chars.length <= 155) return d;
  let chunk = chars.slice(0, 154).join("");
  const space = chunk.lastIndexOf(" ");
  if (space !== -1) chunk = chunk.slice(0, space);
  chunk = chunk.replace(/[.,:;\-\s]+$/, "");
  return `${chunk}\u2026`;
}

export function buildDescription(ymd: string, titles: { belly?: string; body?: string; brain?: string }): string {
  const parts: string[] = [];
  if (titles.belly) parts.push(`Belly - ${titles.belly}`);
  if (titles.body) parts.push(`Body - ${titles.body}`);
  if (titles.brain) parts.push(`Brain - ${titles.brain}`);
  if (parts.length === 0) {
    return `The Daily Fix ${ymd}: one recipe (Belly), one workout (Body) and one article (Brain) from MetFix.`;
  }
  return cutDescription(`The Daily Fix ${ymd}: ${parts.join(". ")}.`);
}

/**
 * Escape JSON for `<script type="application/json">` context.
 * After JSON.stringify, replace < > & U+2028 U+2029.
 */
export function escapeScriptJson(value: unknown): string {
  const json = JSON.stringify(value);
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export const METFIX_OG_FALLBACK_IMAGE =
  "https://brokenscience.org/wp-content/uploads/2025/11/MetFix-logo-1x1-1.jpg";
export const METFIX_OG_FALLBACK_SIZE = 1336;

/** Force https on a photo URL; return null if unusable. */
export function forceHttpsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
