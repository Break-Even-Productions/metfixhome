import { createClient, type SanityClient } from "@sanity/client";

const projectId =
  (import.meta.env.VITE_SANITY_PROJECT_ID as string | undefined) || "etg9lezr";
const dataset =
  (import.meta.env.VITE_SANITY_DATASET as string | undefined) || "production";
const apiVersion =
  (import.meta.env.VITE_SANITY_API_VERSION as string | undefined) || "2025-01-01";

export const isSanityConfigured = Boolean(projectId);

// Published documents are public on this dataset. apiVersion 2025-01-01
// defaults to the raw perspective, so published is pinned. Reads use the API CDN.
export const sanityClient: SanityClient | null = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      perspective: "published",
    })
  : null;
