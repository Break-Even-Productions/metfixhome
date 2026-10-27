import { basePath } from "@/const";
import type { DetailReaderModel } from "./types";
import { primaryContentTypeVisual } from "./contentTypeVisual";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ResourceMetaRow({ model }: { model: DetailReaderModel }) {
  const visual = primaryContentTypeVisual(model);
  const category = model.categories[0];
  const TypeIcon = visual.Icon;

  return (
    <div className="post-detail-meta">
      <time dateTime={model.date}>{formatDate(model.date)}</time>
      {visual.slug ? (
        <>
          <span className="post-detail-meta-sep" aria-hidden>·</span>
          <a
            className="post-detail-meta-type"
            href={basePath(`/library/content-type/${visual.slug}`)}
          >
            <TypeIcon size={12} strokeWidth={2.25} aria-hidden />
            <span>{visual.label}</span>
          </a>
        </>
      ) : null}
      {category ? (
        <>
          <span className="post-detail-meta-sep" aria-hidden>·</span>
          <a href={basePath(`/library/category/${category.slug}`)}>{category.name}</a>
        </>
      ) : null}
      {model.author ? (
        <>
          <span className="post-detail-meta-sep" aria-hidden>·</span>
          <span>{model.author}</span>
        </>
      ) : null}
    </div>
  );
}
