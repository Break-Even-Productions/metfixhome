/**
 * Proxies the public Substack archive for the home resources rail.
 */

const ARCHIVE_URL =
  "https://letsstartwiththetruth.substack.com/api/v1/archive?sort=new&limit=8";

type ArchivePost = {
  title?: string;
  subtitle?: string;
  description?: string;
  truncated_body_text?: string;
  canonical_url?: string;
  post_date?: string;
  cover_image?: string | null;
  audience?: string;
};

export type SubstackArchivePost = {
  title: string;
  excerpt: string;
  url: string;
  date: string;
  image: string | null;
};

function clip(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const last = cut.lastIndexOf(" ");
  return `${cut.slice(0, last > 80 ? last : max).trim()}…`;
}

function excerpt(post: ArchivePost): string {
  const dek = post.subtitle?.trim() || post.description?.trim() || "";
  if (dek) return clip(dek);
  return clip(post.truncated_body_text?.trim() || "");
}

export async function fetchSubstackArchivePosts(
  fetchImpl: typeof fetch = fetch,
): Promise<SubstackArchivePost[]> {
  const response = await fetchImpl(ARCHIVE_URL, {
    headers: { Accept: "application/json", "User-Agent": "MetFixHome/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Substack archive responded ${response.status}`);
  }
  const data = (await response.json()) as ArchivePost[];
  if (!Array.isArray(data)) return [];
  return data
    .filter((post) => post.audience === "everyone" && post.title && post.canonical_url)
    .slice(0, 6)
    .map((post) => ({
      title: post.title as string,
      excerpt: excerpt(post),
      url: post.canonical_url as string,
      date: post.post_date ?? "",
      image: post.cover_image || null,
    }));
}

export async function handleSubstackArchive(
  request: Request,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const posts = await fetchSubstackArchivePosts(deps.fetchImpl ?? fetch);
    const body = method === "HEAD" ? null : JSON.stringify(posts);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return Response.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
