import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import {
  CONTENT_TYPE_CHIPS,
  fromParamHref,
  humanizeSlug,
  parseFromParam,
  type DetailReaderModel,
  type FromKind,
} from "@shared/library";
import { basePath } from "@/const";
import { peekLibraryFilters } from "@/pages/library/filtersCache";

function resolveFromLabel(
  kind: FromKind,
  slug: string,
  model: DetailReaderModel,
): string {
  const matchTerm = (terms: { slug: string; name: string }[]) =>
    terms.find((t) => t.slug === slug)?.name;

  if (kind === "topic") {
    const fromModel = matchTerm(model.topics);
    if (fromModel) return fromModel;
  }
  if (kind === "category") {
    const fromModel = matchTerm(model.categories);
    if (fromModel) return fromModel;
  }
  if (kind === "content-type") {
    const fromModel = matchTerm(model.content_types);
    if (fromModel) return fromModel;
    const chip = CONTENT_TYPE_CHIPS.find((c) => c.slug === slug);
    if (chip) return chip.label;
  }

  const filters = peekLibraryFilters();
  if (filters) {
    const pool =
      kind === "topic"
        ? filters.topics
        : kind === "category"
          ? filters.categories
          : filters.content_type_terms;
    const fromFilters = matchTerm(pool);
    if (fromFilters) return fromFilters;
  }

  return humanizeSlug(slug);
}

function defaultCategoryCrumb(model: DetailReaderModel): {
  href: string;
  label: string;
} | null {
  const cat = model.categories[0];
  if (!cat) return null;
  return {
    href: basePath(`/library/category/${cat.slug}`),
    label: cat.name,
  };
}

export function ResourceBreadcrumbs({ model }: { model: DetailReaderModel }) {
  const search = useSearch();
  const parsed = useMemo(
    () => parseFromParam(new URLSearchParams(search).get("from")),
    [search],
  );

  const third = useMemo(() => {
    if (parsed) {
      return {
        href: basePath(fromParamHref(parsed)),
        label: resolveFromLabel(parsed.kind, parsed.slug, model),
      };
    }
    return defaultCategoryCrumb(model);
  }, [parsed, model]);

  return (
    <nav className="post-detail-breadcrumbs" aria-label="Breadcrumb">
      <ol className="post-detail-breadcrumbs-list">
        <li>
          <Link href={basePath("/")}>Home</Link>
        </li>
        <li aria-hidden="true">›</li>
        <li>
          <Link href={basePath("/library")}>Resource Library</Link>
        </li>
        {third ? (
          <>
            <li aria-hidden="true">›</li>
            <li>
              <Link href={third.href}>{third.label}</Link>
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}
