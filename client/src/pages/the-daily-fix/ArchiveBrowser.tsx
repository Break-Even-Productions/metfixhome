import { ArrowRight, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadDailyFixArchive } from "./data";
import {
  dailyFixHref,
  dayParts,
  formatDayLabel,
  pillarLabel,
  wpThumbnailUrl,
  yymmddFromIso,
  type DailyFixArchiveEntry,
  type Pillar,
} from "./model";

const WEEK = 7;
const PAGE_SIZE = 12;
const PILLARS: Pillar[] = ["belly", "body", "brain"];
const ALL_PROTEINS = "all";

type Section = "all" | Pillar;

type ArchiveState =
  | { status: "idle" | "loading" | "unavailable" }
  | { status: "loaded"; days: DailyFixArchiveEntry[] };

type ArchiveBrowserProps = {
  todayIso: string;
  /** Photo of the pillar currently open above; cropped in behind the search panel. */
  backdrop: string | null;
  onOpen: () => void;
};

type Indexed = { entry: DailyFixArchiveEntry; date: string } & Record<Pillar, string>;

function indexEntry(entry: DailyFixArchiveEntry): Indexed {
  const lower = (...parts: Array<string | null>) => parts.filter(Boolean).join(" ").toLowerCase();
  return {
    entry,
    date: formatDayLabel(entry.date).toLowerCase(),
    belly: lower(entry.belly.title, entry.belly.protein, entry.belly.excerpt),
    body: lower(entry.body.title, entry.body.excerpt),
    brain: lower(entry.brain.title, entry.brain.excerpt, entry.brain.button),
  };
}

function ArchiveThumb({ photo }: { photo: string | null }) {
  const [src, setSrc] = useState(photo ? (wpThumbnailUrl(photo) ?? photo) : null);
  if (!src) return null;
  return (
    <img
      className="df-archive-thumb"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      width={56}
      height={40}
      onError={() => setSrc(src === photo ? null : photo)}
    />
  );
}

function ArchiveCard({
  entry,
  pillars,
  todayIso,
  onOpen,
}: {
  entry: DailyFixArchiveEntry;
  pillars: Pillar[];
  todayIso: string;
  onOpen: () => void;
}) {
  const parts = dayParts(entry.date);
  const sameYear = entry.date.slice(0, 4) === todayIso.slice(0, 4);
  const items: Record<Pillar, { title: string; meta: string | null; photo: string | null }> = {
    belly: { title: entry.belly.title, meta: entry.belly.protein, photo: entry.belly.photo },
    body: { title: entry.body.title, meta: entry.body.excerpt || null, photo: entry.body.photo },
    brain: {
      title: entry.brain.title,
      meta: entry.brain.button,
      photo: entry.brain.photo,
    },
  };
  return (
    <li className="df-archive-card">
      <p className="df-archive-card-head">
        <span>
          {parts.weekdayShort} · {parts.monthShort} {parts.day}
          {sameYear ? null : `, ${parts.year}`}
        </span>
        <span className="df-archive-card-code">{yymmddFromIso(entry.date)}</span>
      </p>
      {pillars.map((pillar) => {
        const item = items[pillar];
        return (
          <Link
            key={pillar}
            href={dailyFixHref(todayIso, entry.date, pillar)}
            className="df-archive-item"
            onClick={onOpen}
          >
            <span className="df-archive-item-label">{pillarLabel(pillar)}</span>
            <span className="df-archive-item-text">
              <span className="df-archive-title">{item.title}</span>
              {item.meta ? <span className="df-archive-meta">{item.meta}</span> : null}
            </span>
            <ArchiveThumb photo={item.photo ?? null} />
            <ArrowRight className="df-archive-arrow" aria-hidden="true" />
          </Link>
        );
      })}
    </li>
  );
}

function SearchBackdrop({ src }: { src: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return null;
  return (
    <img
      key={src}
      className="df-search-backdrop"
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      onError={() => setFailed(src)}
    />
  );
}

export function ArchiveBrowser({ todayIso, backdrop, onOpen }: ArchiveBrowserProps) {
  const [text, setText] = useState("");
  const [section, setSection] = useState<Section>("all");
  const [protein, setProtein] = useState<string | null>(null);
  const [state, setState] = useState<ArchiveState>({ status: "idle" });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const rootRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let active = true;
    const start = () => {
      setState({ status: "loading" });
      void loadDailyFixArchive().then((days) => {
        if (!active) return;
        setState(days ? { status: "loaded", days } : { status: "unavailable" });
      });
    };
    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => {
        active = false;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(root);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [attempt]);

  const indexed = useMemo(() => (state.status === "loaded" ? state.days.map(indexEntry) : []), [state]);
  const proteins = useMemo(
    () =>
      Array.from(new Set(indexed.map((row) => row.entry.belly.protein).filter((p): p is string => Boolean(p)))).sort(),
    [indexed],
  );
  const pillars = section === "all" ? PILLARS : [section];
  const query = text.trim().toLowerCase();
  const filtering = Boolean(query || protein);

  const matches = useMemo(() => {
    const terms = query.split(/\s+/).filter(Boolean);
    const searched = section === "all" ? PILLARS : [section];
    return indexed
      .filter((row) => !protein || row.entry.belly.protein === protein)
      .filter((row) => {
        if (terms.length === 0) return true;
        const haystack = [row.date, ...searched.map((pillar) => row[pillar])].join(" ");
        return terms.every((term) => haystack.includes(term));
      })
      .map((row) => row.entry);
  }, [indexed, query, protein, section]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, protein, section]);
  const shown = filtering ? matches.slice(0, visible) : matches.slice(0, WEEK);

  let status = `The past week · search all ${matches.length} days`;
  if (query) {
    status = `${matches.length} ${matches.length === 1 ? "day matches" : "days match"} “${text.trim()}”`;
    if (protein) status += ` · ${protein}`;
  } else if (protein) {
    status = `${matches.length} ${matches.length === 1 ? "day" : "days"} · ${protein}`;
  }

  return (
    <div ref={rootRef}>
      <div className="df-archive-head">
        <div className="df-archive-copy">
          <p className="df-kicker">The archive</p>
          <h2>Every day of the fix.</h2>
          <p>Each day is a recipe, a workout, and a reading. Search every one since the first fix.</p>
        </div>
      </div>

      <div className="df-search">
        <SearchBackdrop src={backdrop} />
        <div className="df-search-inner">
          <label htmlFor="daily-fix-search">Search</label>
          <div className="df-search-row">
            <div className="df-search-field">
              <Search className="df-search-icon" aria-hidden="true" />
              <input
                id="daily-fix-search"
                type="search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Search recipes, workouts, or readings"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="df-filter-pill df-protein-trigger">
                {protein ?? "Protein"}
                <ChevronDown className="df-share-icon" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="df-share-menu df-protein-menu">
                <DropdownMenuRadioGroup
                  value={protein ?? ALL_PROTEINS}
                  onValueChange={(value) => setProtein(value === ALL_PROTEINS ? null : value)}
                >
                  <DropdownMenuRadioItem value={ALL_PROTEINS}>All proteins</DropdownMenuRadioItem>
                  {proteins.map((name) => (
                    <DropdownMenuRadioItem key={name} value={name}>
                      {name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="df-filter-row" role="group" aria-label="Show sections">
            {(["all", ...PILLARS] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="df-filter-pill"
                aria-pressed={section === value}
                onClick={() => setSection(value)}
              >
                {value === "all" ? "All days" : pillarLabel(value)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {state.status === "loaded" ? (
        <div className="df-archive-results">
          <p className="df-muted" role="status">
            {status}
          </p>
          {shown.length > 0 ? (
            <ul className="df-archive-list">
              {shown.map((entry) => (
                <ArchiveCard key={entry.date} entry={entry} pillars={pillars} todayIso={todayIso} onOpen={onOpen} />
              ))}
            </ul>
          ) : null}
          {filtering && matches.length > visible ? (
            <button
              type="button"
              className="df-btn df-btn-ghost df-archive-more"
              onClick={() => setVisible((count) => count + PAGE_SIZE)}
            >
              Show more
            </button>
          ) : null}
        </div>
      ) : null}

      {state.status === "idle" || state.status === "loading" ? (
        <div className="df-archive-results" role="status" aria-busy="true">
          <span className="sr-only">Loading the archive</span>
          <ul className="df-archive-list" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="df-skeleton-line df-archive-skeleton" />
            ))}
          </ul>
        </div>
      ) : null}

      {state.status === "unavailable" ? (
        <div className="df-panel" role="status">
          <div className="df-status">
            <h3>The archive didn’t load</h3>
            <p>Something went wrong reaching the Daily Fix archive.</p>
            <button
              type="button"
              className="df-btn df-btn-ink"
              style={{ marginTop: "1.25rem" }}
              onClick={() => setAttempt((count) => count + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
