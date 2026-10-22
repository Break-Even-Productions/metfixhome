import {
  isLockedCard,
  isProfessionalTagged,
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

function typeLabel(r: LibraryResource): string {
  const ct = r.content_types[0]?.name;
  if (ct) return ct;
  if (r.type === "course") return "Course";
  if (r.type === "event") return "Event";
  if (r.type === "daily_fix") return "Daily Fix";
  if (r.type === "webinars" as string) return "Live Stream";
  return r.type.replace(/_/g, " ");
}

type ResourceCardProps = {
  resource: LibraryResource;
  onOpenLocked: (r: LibraryResource) => void;
};

export function ResourceCard({ resource, onOpenLocked }: ResourceCardProps) {
  const locked = isLockedCard(resource);
  const pro = isProfessionalTagged(resource);
  const href =
    resource.type === "daily_fix" && resource.daily_fix_date
      ? `/the-daily-fix/${resource.daily_fix_date.replace(/-/g, "").slice(2)}`
      : `/library/${resource.type}/${resource.id}`;

  const body = (
    <>
      <div className="library-card-media">
        {resource.image ? (
          <img
            src={resource.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="library-card-badge">{typeLabel(resource)}</span>
        {locked || pro ? (
          <span className="library-card-lock" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-7-2a2 2 0 1 1 4 0v2h-4V6zm7 14H7V10h10v10z" />
            </svg>
          </span>
        ) : null}
      </div>
      {pro ? <span className="library-card-pro">Professional</span> : null}
      <div className="library-card-meta">
        <time dateTime={resource.date}>{formatDate(resource.date)}</time>
        {resource.categories[0] ? <span>{resource.categories[0].name}</span> : null}
        {resource.author ? <span>By {resource.author}</span> : null}
      </div>
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
