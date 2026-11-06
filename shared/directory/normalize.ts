import type { DirectoryKind, DirectoryListing } from "./types";

/** Affiliate profiles still live on BSI until metfix.org profiles ship. */
const BSI_ORIGIN = "https://brokenscience.org";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finiteCoord(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || Math.abs(n) > 180) return null;
  if (n === 0) return null;
  return n;
}

export function communityLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const labels: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const label = item.trim();
      if (label) labels.push(label);
      continue;
    }
    const row = asRecord(item);
    const label = text(row?.label) || text(row?.name) || text(row?.attr_name);
    if (label) labels.push(label);
  }
  return [...new Set(labels)];
}

/** Resolve affiliate/clinic profile URLs onto brokenscience.org. */
export function absoluteProfile(raw: string): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("/")) return `${BSI_ORIGIN}${raw}`;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (
      host === "brokenscience.org" ||
      host === "www.brokenscience.org" ||
      host === "metfix.org" ||
      host === "www.metfix.org"
    ) {
      return `${BSI_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function httpUrl(raw: string): string | undefined {
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  return undefined;
}

export function normalizeDirectoryRow(
  raw: unknown,
  kind: DirectoryKind,
): DirectoryListing | null {
  const row = asRecord(raw);
  if (!row) return null;
  const lat = finiteCoord(row.lat ?? row.latitude ?? row.map_lat);
  const lng = finiteCoord(row.lng ?? row.longitude ?? row.map_lng ?? row.lon);
  if (lat == null || lng == null) return null;

  const idRaw = row.affiliate_id ?? row.member_id ?? row.id;
  const idText = typeof idRaw === "number" || typeof idRaw === "string" ? String(idRaw).trim() : "";
  if (!idText) return null;

  const name =
    text(row.affiliate_name) ||
    text(row.display_name) ||
    text(row.name) ||
    text(row.title);
  if (!name) return null;

  const affiliateName = text(row.affiliate_name);
  const title =
    kind === "gym"
      ? "MetFix Affiliate"
      : kind === "doctor"
        ? "MetFix Clinic"
        : affiliateName
          ? `MetFix Coach · ${affiliateName}`
          : "MetFix Coach";

  const city = text(row.city);
  const state = text(row.state_abbr) || text(row.state);
  const address = text(row.full_addr) || text(row.address);
  const image = httpUrl(text(row.pfp_pic) || text(row.logo_url) || text(row.image));
  const website = httpUrl(text(row.website));
  const profileUrl = absoluteProfile(text(row.affiliate_profile_url) || text(row.profile_url));
  const place = [city, state].filter(Boolean).join(", ");

  return {
    id: `${kind}:${idText}`,
    kind,
    name: kind === "coach" ? text(row.display_name) || name : name,
    title,
    lat,
    lng,
    city,
    state,
    address,
    ...(website ? { website } : {}),
    ...(profileUrl ? { profileUrl } : {}),
    ...(image ? { image } : {}),
    communities: communityLabels(row.communities_served),
    ...(place ? { summary: place } : {}),
  };
}

export function directoryRows(json: unknown, keys: readonly string[]): unknown[] {
  const row = asRecord(json);
  if (!row) return [];
  for (const key of keys) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [];
}

export function directoryHasMore(json: unknown): boolean {
  const row = asRecord(json);
  if (!row) return false;
  return row.has_more === true || row.hasMore === true;
}

export function findADoctorEnabled(json: unknown): boolean {
  const row = asRecord(json);
  if (!row) return false;
  if (row.find_a_doctor_enabled === false) return false;
  if (row.find_a_doctor_enabled === true) return true;
  return directoryRows(json, ["items", "clinics", "affiliates"]).length > 0;
}
