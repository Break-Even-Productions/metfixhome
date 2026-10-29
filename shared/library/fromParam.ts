/**
 * Breadcrumb `?from=` parser (PL9 / CQ-5 / SEC12).
 */
export type FromKind = "topic" | "category" | "content-type";

export type ParsedFromParam = {
  kind: FromKind;
  slug: string;
};

const FROM_PARAM_RE =
  /^(topic|category|content-type):([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const FROM_MAX = 80;

export function parseFromParam(raw: unknown): ParsedFromParam | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > FROM_MAX) return null;
  const m = FROM_PARAM_RE.exec(trimmed);
  if (!m) return null;
  return { kind: m[1] as FromKind, slug: m[2]! };
}

/** Humanize slug: `metabolic-health` → `Metabolic Health` (Emily ResourceDetail). */
export function humanizeSlug(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fromParamHref(parsed: ParsedFromParam): string {
  if (parsed.kind === "topic") return `/topic/${parsed.slug}`;
  if (parsed.kind === "category") return `/library/category/${parsed.slug}`;
  return `/library/content-type/${parsed.slug}`;
}

export function formatFromParam(kind: FromKind, slug: string): string {
  return `${kind}:${slug}`;
}
