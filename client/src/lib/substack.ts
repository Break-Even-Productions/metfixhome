/**
 * Substack archive loader for the home resources rail.
 * Lives outside `components/home/**` so home repo-scans stay free of Substack literals.
 */
import { SUBSTACK_ARCHIVE_URL } from "@/data/newsletter";

export type SubstackPost = {
  title: string;
  excerpt: string;
  url: string;
  date: string;
  image: string | null;
};

export { SUBSTACK_ARCHIVE_URL };

/** Shown immediately / when the live archive route is unavailable. */
export const FALLBACK_SUBSTACK_POSTS: SubstackPost[] = [
  {
    title: "The Metal You Taste After a Hard Workout",
    excerpt: "We've all had the client.",
    url: "https://letsstartwiththetruth.substack.com/p/the-metal-you-taste-after-a-hard",
    date: "2026-09-23T10:03:58.406Z",
    image: null,
  },
  {
    title: "The Expert With Connections",
    excerpt:
      "On the press, the vaccine season, and the one sentence no editor thought to require",
    url: "https://letsstartwiththetruth.substack.com/p/the-expert-with-connections",
    date: "2026-09-22T22:49:11.323Z",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/e7545052-16c3-478f-966a-c01676310357_1280x720.png",
  },
  {
    title: "The Cameras Went Dark Four Days Before Xi Arrives",
    excerpt:
      "The White House has blocked the network assigned to provide the cameras. The other networks have declined to replace it.",
    url: "https://letsstartwiththetruth.substack.com/p/the-cameras-went-dark-four-days-before",
    date: "2026-09-22T00:36:38.687Z",
    image:
      "https://substack-post-media.s3.amazonaws.com/public/images/70f2e2d5-f901-4b3f-834c-d844816adc19_1280x720.png",
  },
  {
    title: "The Backdoor in the Medicaid Rule",
    excerpt:
      "The new federal restriction on Medicaid funding for pediatric gender-affirming medication and surgery is being covered as a culture-war story.",
    url: "https://letsstartwiththetruth.substack.com/p/the-backdoor-in-the-medicaid-rule",
    date: "2026-09-21T16:03:53.147Z",
    image: null,
  },
  {
    title: "The Photo Op Executive Order",
    excerpt: "The Vaccine Order That Can't Order Anything",
    url: "https://letsstartwiththetruth.substack.com/p/the-photo-op-executive-order",
    date: "2026-09-18T11:03:52.077Z",
    image:
      "https://substackcdn.com/image/fetch/$s_!wO9l!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F5cd40263-fa3f-497a-af14-59f71c367070_1048x1048.png",
  },
  {
    title: "How Medicine Meets the Gym",
    excerpt:
      "Metabolic health, medical education, and the case for bringing clinicians and coaches together",
    url: "https://letsstartwiththetruth.substack.com/p/how-medicine-meets-the-gym",
    date: "2026-09-16T19:37:27.471Z",
    image: "https://substackcdn.com/image/youtube/w_728,c_limit/Yr3f5AiJVfs",
  },
];

const ARCHIVE_API_PATH = "/api/substack/archive";

function isPost(value: unknown): value is SubstackPost {
  if (!value || typeof value !== "object") return false;
  const post = value as SubstackPost;
  return (
    typeof post.title === "string" &&
    typeof post.excerpt === "string" &&
    typeof post.url === "string" &&
    typeof post.date === "string" &&
    (post.image === null || typeof post.image === "string")
  );
}

export function substackImageUrl(src: string): string {
  if (src.startsWith("https://substack-post-media.s3.amazonaws.com/")) {
    return `https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/${encodeURIComponent(src)}`;
  }
  return src;
}

export function formatSubstackPostDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export async function loadSubstackPosts(signal?: AbortSignal): Promise<SubstackPost[]> {
  try {
    const response = await fetch(ARCHIVE_API_PATH, { signal });
    if (!response.ok) return FALLBACK_SUBSTACK_POSTS;
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return FALLBACK_SUBSTACK_POSTS;
    const posts = data.filter(isPost);
    return posts.length > 0 ? posts : FALLBACK_SUBSTACK_POSTS;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return FALLBACK_SUBSTACK_POSTS;
  }
}
