import {
  Clapperboard,
  FileText,
  Presentation,
  Radio,
  type LucideIcon,
} from "lucide-react";
import type { DetailReaderModel, ResourceType } from "@shared/library";

export type ContentTypeVisual = {
  label: string;
  slug: string;
  Icon: LucideIcon;
};

const RESOURCE_TYPE_SLUG: Record<ResourceType, string> = {
  post: "articles",
  page: "articles",
  course: "courses",
  event: "events",
  infographic: "infographic",
  daily_fix: "daily-fix",
  exclusive_resource: "articles",
};

const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  post: "Articles",
  page: "Articles",
  course: "Courses",
  event: "Events",
  infographic: "Infographics",
  daily_fix: "Daily Fix",
  exclusive_resource: "Articles",
};

export function resourceTypeContentSlug(type: ResourceType): string {
  return RESOURCE_TYPE_SLUG[type] ?? "articles";
}

function fallbackFromResourceType(type: ResourceType): ContentTypeVisual {
  const slug = resourceTypeContentSlug(type);
  return {
    label: RESOURCE_TYPE_LABEL[type] ?? "Article",
    slug,
    Icon: FileText,
  };
}

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
  if (model.content_types.length === 0) {
    return fallbackFromResourceType(model.resourceType);
  }
  return { label: "Article", slug: "articles", Icon: FileText };
}
