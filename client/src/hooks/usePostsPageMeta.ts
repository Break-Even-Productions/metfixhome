/**
 * Posts head via the shared builder (CQ6 / N2 / PH15).
 * Worker and client set identical title/description/robots/canonical/og values.
 */
import { buildPostsHead, type BuildPostsHeadInput } from "@shared/posts";
import { usePageMeta } from "./usePageMeta";

export function usePostsPageMeta(input: BuildPostsHeadInput) {
  const head = buildPostsHead(input);
  usePageMeta({
    title: head.title,
    description: head.description,
    robots: head.robots,
    canonical: head.canonical,
    ogType: head.ogType,
    ogImage: head.ogImage,
    ogUrl: head.ogUrl,
  });
}
