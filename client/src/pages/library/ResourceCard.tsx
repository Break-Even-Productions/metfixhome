import {
  Clapperboard,
  FileText,
  Lock,
  Play,
  Presentation,
  Radio,
  type LucideIcon,
} from "lucide-react";
import {
  isLockedCard,
  isProfessionalTagged,
  parseFromParam,
  type LibraryResource,
} from "@shared/library";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** MetFix asterisk — Daily Fix mark when no free jumping-jack / Vitruvian icon fits. */
function MetfixAsteriskIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1 -1 2 2"
      aria-hidden
      className="library-card-type-icon library-card-type-icon--asterisk"
    >
      <rect x={-0.727} y={-0.091} width={1.454} height={0.182} fill="currentColor" />
      <rect
        x={-0.727}
        y={-0.091}
        width={1.454}
        height={0.182}
        fill="currentColor"
        transform="rotate(45)"
      />
      <rect
        x={-0.727}
        y={-0.091}
        width={1.454}
        height={0.182}
        fill="currentColor"
        transform="rotate(-45)"
      />
      <rect x={-0.091} y={0} width={0.182} height={0.727} fill="currentColor" />
      <rect
        x={-0.091}
        y={-0.636}
        width={0.182}
        height={0.364}
        rx={0.091}
        fill="currentColor"
      />
    </svg>
  );
}

type TypeVisual = {
  label: string;
  Icon?: LucideIcon;
  asterisk?: boolean;
};

function typeVisual(r: LibraryResource): TypeVisual {
  const slug = (r.content_types[0]?.slug ?? "").toLowerCase();
  const name = r.content_types[0]?.name;

  if (
    r.type === "daily_fix" ||
    r.daily_fix_date ||
    slug === "daily-fix" ||
    slug === "daily_fix"
  ) {
    return { label: name || "Daily Fix", asterisk: true };
  }
  if (slug === "videos" || slug === "video") {
    return { label: name || "Videos", Icon: Clapperboard };
  }
  if (slug === "webinars" || slug === "webinar" || slug === "live-streams" || slug === "livestream") {
    return { label: name || "Live Stream", Icon: Radio };
  }
  if (slug === "whiteboards" || slug === "whiteboard") {
    return { label: name || "Whiteboard", Icon: Presentation };
  }
  if (
    slug === "articles" ||
    slug === "posts" ||
    slug === "post" ||
    r.type === "post" ||
    r.type === "page"
  ) {
    return { label: name || (r.type === "page" ? "Page" : "Posts"), Icon: FileText };
  }
  if (r.type === "event") {
    return { label: name || "Event", Icon: Play };
  }
  if (r.type === "course") {
    return { label: name || "Course", Icon: Presentation };
  }
  if (r.type === "exclusive_resource") {
    return { label: name || "Exclusive", Icon: FileText };
  }
  if (r.type === "infographic") {
    return { label: name || "Infographic", Icon: Presentation };
  }
  if (name) return { label: name, Icon: FileText };
  return { label: String(r.type).replace(/_/g, " "), Icon: FileText };
}

type ResourceCardProps = {
  resource: LibraryResource;
  onOpenLocked: (r: LibraryResource) => void;
  /** Breadcrumb context `?from=` (PL9 / TX7). */
  from?: string;
};

function hrefWithFrom(href: string, from?: string): string {
  if (!from) return href;
  const valid = parseFromParam(from) ? from : null;
  if (!valid) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(valid)}`;
}

export function ResourceCard({ resource, onOpenLocked, from }: ResourceCardProps) {
  const locked = isLockedCard(resource);
  const exclusive = isProfessionalTagged(resource);
  const showLock = locked || exclusive;
  const baseHref = resource.daily_fix_date
    ? `/the-daily-fix/${resource.daily_fix_date.replace(/-/g, "").slice(2)}`
    : resource.type === "daily_fix"
      ? "/the-daily-fix"
      : `/library/${resource.type}/${resource.id}`;
  const href = hrefWithFrom(baseHref, from);

  const visual = typeVisual(resource);
  const TypeIcon = visual.Icon;
  const dateLabel = formatDate(resource.date);
  const category = resource.categories[0]?.name;

  const body = (
    <>
      <div className="library-card-media">
        {resource.composite && (resource.composite.brain || resource.composite.belly) ? (
          <div className="library-dfx-composite" aria-hidden>
            {resource.composite.belly ? (
              <div className="library-dfx-half library-dfx-half-left">
                <img
                  src={resource.composite.belly}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}
            {resource.composite.brain ? (
              <div className="library-dfx-half library-dfx-half-right">
                <img
                  src={resource.composite.brain}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}
            <div className="library-dfx-mark">
              {resource.composite.body ? (
                <img
                  src={resource.composite.body}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <MetfixAsteriskIcon size={28} />
              )}
            </div>
          </div>
        ) : resource.image ? (
          <img
            src={resource.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="library-card-badge">
          {visual.asterisk ? (
            <MetfixAsteriskIcon size={11} />
          ) : TypeIcon ? (
            <TypeIcon className="library-card-type-icon" size={12} strokeWidth={2.25} aria-hidden />
          ) : null}
          {visual.label}
        </span>
        {showLock ? (
          <span className="library-card-lock" aria-label="Exclusive content">
            <Lock size={12} strokeWidth={2.25} aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="library-card-body">
        {exclusive ? <span className="library-card-pro">Professional</span> : null}
        {(dateLabel || category) && (
          <div className="library-card-meta">
            {dateLabel ? <time dateTime={resource.date}>{dateLabel}</time> : null}
            {dateLabel && category ? (
              <span className="library-card-meta-sep" aria-hidden>
                •
              </span>
            ) : null}
            {category ? <span>{category}</span> : null}
          </div>
        )}
        {resource.topics.length > 0 ? (
          <div className="library-card-topics">
            {resource.topics.slice(0, 2).map((t) => (
              <span key={t.id} className="library-card-topic">
                {t.name}
              </span>
            ))}
          </div>
        ) : null}
        <h3 className="library-card-title">{resource.title}</h3>
        {resource.excerpt ? (
          <p className="library-card-excerpt">{resource.excerpt}</p>
        ) : null}
        {resource.author ? (
          <p className="library-card-byline">By {resource.author}</p>
        ) : null}
      </div>
    </>
  );

  if (locked) {
    return (
      <button
        type="button"
        className="library-card"
        onClick={() => onOpenLocked(resource)}
        aria-label={`Locked: ${resource.title}. Open join options.`}
      >
        {body}
      </button>
    );
  }

  return (
    <a className="library-card" href={href}>
      {body}
    </a>
  );
}
