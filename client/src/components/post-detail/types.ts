export type {
  ContentAccessDisplay,
  DetailReaderModel,
  ResourceVideo,
  TermRef,
} from "@shared/library";

import type { DetailPost } from "@shared/posts";
import type { LibraryDetail } from "@shared/library";
import type { DetailReaderModel } from "@shared/library";

/** Normalize library detail or mapped post into the shared reader contract. */
export function toDetailReaderModel(
  source: LibraryDetail | DetailPost,
): DetailReaderModel {
  return {
    id: source.id,
    title: source.title,
    date: source.date,
    author: source.author,
    image: source.image,
    video: source.video,
    categories: source.categories,
    content_types: source.content_types,
    topics: source.topics,
    locked: source.locked,
    access: source.access,
    content: source.content,
  };
}
