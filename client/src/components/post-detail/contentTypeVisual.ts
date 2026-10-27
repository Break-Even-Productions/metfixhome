import {
  Clapperboard,
  FileText,
  Presentation,
  Radio,
  type LucideIcon,
} from "lucide-react";
import type { DetailReaderModel } from "@shared/library";

export type ContentTypeVisual = {
  label: string;
  slug: string | null;
  Icon: LucideIcon;
};

export function primaryContentTypeVisual(model: DetailReaderModel): ContentTypeVisual {
  const term = model.content_types[0];
  const slug = (term?.slug ?? "").toLowerCase();
  const name = term?.name;

  if (slug === "videos" || slug === "video") {
    return { label: name || "Videos", slug: term?.slug ?? "videos", Icon: Clapperboard };
  }
  if (slug === "webinars" || slug === "webinar" || slug === "live-streams" || slug === "livestream") {
    return { label: name || "Live Stream", slug: term?.slug ?? slug, Icon: Radio };
  }
  if (slug === "whiteboards" || slug === "whiteboard") {
    return { label: name || "Whiteboard", slug: term?.slug ?? slug, Icon: Presentation };
  }
  if (slug === "articles" || slug === "posts" || slug === "post") {
    return { label: name || "Articles", slug: term?.slug ?? slug ?? "articles", Icon: FileText };
  }
  if (name && term?.slug) {
    return { label: name, slug: term.slug, Icon: FileText };
  }
  return { label: "Article", slug: term?.slug ?? null, Icon: FileText };
}
