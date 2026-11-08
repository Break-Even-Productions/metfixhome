/**
 * Public profile skin API. Eligibility stays on BSI.
 * GET /api/profiles/metfix/:id
 * GET /api/profiles/affiliates/:id
 * GET /api/profiles/clinics/:id
 */
import {
  assertBsiHost,
  resolveBsiOrigin,
  UPSTREAM_USER_AGENT,
  type Env,
  type FetchImpl,
} from "./upstream";

const POSITIVE_INT = /^[1-9][0-9]{0,9}$/;
const ELIGIBILITY = new Set(["foundations_coach", "primary_owner", "metfix_pro"]);

export type PublicProfileDeps = {
  fetchImpl?: FetchImpl;
  bsiBaseUrl?: string;
};

type Kind = "metfix" | "affiliate" | "clinic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function httpsUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

function labels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) out.push(item.trim());
  }
  return out;
}

function socials(value: unknown): { name: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { name: string; url: string }[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const name = text(row?.name);
    const url = httpsUrl(row?.url);
    if (name && url) out.push({ name, url });
  }
  return out;
}

function team(value: unknown): Record<string, unknown[]> {
  const row = asRecord(value);
  if (!row) return { owners: [] };
  const mapList = (raw: unknown): Record<string, unknown>[] => {
    if (!Array.isArray(raw)) return [];
    const people: Record<string, unknown>[] = [];
    for (const item of raw) {
      const person = asRecord(item);
      const memberId = typeof person?.member_id === "number" ? person.member_id : Number(person?.member_id);
      const name = text(person?.name);
      if (!Number.isInteger(memberId) || memberId < 1 || !name) continue;
      people.push({
        member_id: memberId,
        name,
        profile_url: `/metfix-profile/${memberId}`,
        profile_picture_url: httpsUrl(person?.profile_picture_url),
      });
    }
    return people;
  };
  const shaped: Record<string, unknown[]> = { owners: mapList(row.owners) };
  if (Array.isArray(row.delegates)) shaped.delegates = mapList(row.delegates);
  if (Array.isArray(row.coaches)) shaped.coaches = mapList(row.coaches);
  return shaped;
}

function services(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null;
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const name = text(row?.name);
    const slug = text(row?.slug);
    if (!name || !slug) continue;
    out.push({
      id: typeof row?.id === "number" ? row.id : Number(row?.id) || 0,
      slug,
      name,
      summary: text(row?.summary) ?? "",
      note: text(row?.note),
    });
  }
  return out;
}

/** Drop HTML and anything the public skin does not render. */
export function shapePublicProfile(kind: Kind, raw: unknown): Record<string, unknown> | null {
  const row = asRecord(raw);
  if (!row || row.profile_kind !== kind) return null;

  if (kind === "metfix") {
    const memberId = typeof row.member_id === "number" ? row.member_id : Number(row.member_id);
    const name = text(row.display_name);
    const eligibility = labels(row.eligibility).filter((item) => ELIGIBILITY.has(item));
    if (!Number.isInteger(memberId) || memberId < 1 || !name || eligibility.length === 0) return null;
    return {
      profile_kind: "metfix",
      member_id: memberId,
      display_name: name,
      secondary: text(row.secondary),
      bio: text(row.bio),
      location: text(row.address) ?? text(row.location),
      website: httpsUrl(row.website),
      contact_email: text(row.contact_email),
      profile_picture_url: httpsUrl(row.profile_picture_url),
      tags: labels(row.tags),
      socials: socials(row.socials),
      eligibility,
      profile_url: `/metfix-profile/${memberId}`,
    };
  }

  const id = typeof row.id === "number" ? row.id : Number(row.id);
  const name = text(row.name);
  const slug = text(row.slug);
  if (!Number.isInteger(id) || id < 1 || !name || !slug) return null;
  const prefix = kind === "clinic" ? "/clinics" : "/affiliates";
  const body: Record<string, unknown> = {
    profile_kind: kind,
    id,
    name,
    slug,
    bio: text(row.bio),
    location: text(row.location),
    website: httpsUrl(row.website),
    logo_url: httpsUrl(row.logo_url),
    video_url: httpsUrl(row.video_embed),
    tags: labels(row.tags),
    socials: socials(row.socials),
    is_first_100: row.is_first_100 === true,
    is_international: row.is_international === true,
    team: team(row.team),
    url: `${prefix}/${id}/${slug}`,
  };
  if (kind === "clinic") {
    const blocks = services(row.services);
    if (!blocks) return null;
    body.services = blocks;
  }
  return body;
}

export async function handlePublicProfileRoutes(
  request: Request,
  env: Env,
  deps: PublicProfileDeps = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;

  let kind: Kind | null = null;
  let id = "";
  const metfix = url.pathname.match(/^\/api\/profiles\/metfix\/([^/]+)$/);
  const affiliate = url.pathname.match(/^\/api\/profiles\/affiliates\/([^/]+)$/);
  const clinic = url.pathname.match(/^\/api\/profiles\/clinics\/([^/]+)$/);
  if (metfix) {
    kind = "metfix";
    id = metfix[1]!;
  } else if (affiliate) {
    kind = "affiliate";
    id = affiliate[1]!;
  } else if (clinic) {
    kind = "clinic";
    id = clinic[1]!;
  } else {
    return null;
  }

  if (!POSITIVE_INT.test(id)) return json({ error: "invalid_id" }, 400);

  const origin = resolveBsiOrigin(env, deps.bsiBaseUrl ? { baseUrl: deps.bsiBaseUrl } : undefined);
  const path =
    kind === "metfix"
      ? `/wp-json/bsi/v1/profiles/public/metfix/${id}`
      : `/wp-json/bsi/v1/profiles/public/${kind === "clinic" ? "clinics" : "affiliates"}/${id}`;
  const upstream = `${origin}${path}`;
  try {
    assertBsiHost(upstream, env);
  } catch {
    return json({ error: "unavailable" }, 502);
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(upstream, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": UPSTREAM_USER_AGENT,
      },
    });
  } catch {
    return json({ error: "unavailable" }, 502);
  }

  if (response.status === 404) return json({ error: "not_found" }, 404);
  if (response.status === 400) return json({ error: "invalid_id" }, 400);
  if (!response.ok) return json({ error: "unavailable" }, 502);

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return json({ error: "unavailable" }, 502);
  }
  const shaped = shapePublicProfile(kind, parsed);
  if (!shaped) return json({ error: "unavailable" }, 502);
  if (method === "HEAD") return new Response(null, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } });
  return json(shaped, 200);
}
