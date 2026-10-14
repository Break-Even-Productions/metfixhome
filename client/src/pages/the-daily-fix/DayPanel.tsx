import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { Link } from "wouter";
import { DayContent } from "./DayContent";
import type { DailyFixLoadState } from "./data";
import {
  addCalendarDays,
  dailyFixHref,
  dayParts,
  formatDayLabel,
  isCloserScheduledDay,
  pillarLabel,
  plainText,
  readMinutes,
  recentDateStrip,
  type DailyFixDay,
  type DailyFixRouteKind,
  type Pillar,
} from "./model";

type DayPanelProps = {
  /** Route request ISO (today for bare; URL ISO for dated). */
  requestedIso: string;
  /** Calendar highlight / prev-next anchor: response date when loaded. */
  panelIso: string;
  todayIso: string;
  routeKind: DailyFixRouteKind;
  pillar: Pillar;
  pillarExplicit: boolean;
  load: DailyFixLoadState;
  onOpenArchive: () => void;
};

function UnavailableCopy() {
  return (
    <div className="df-status" role="status">
      <h3>Not available</h3>
    </div>
  );
}

function InvalidCopy() {
  return (
    <div className="df-status" role="alert">
      <h3>That day isn’t a Daily Fix date</h3>
      <p>
        Use <code>/the-daily-fix</code> for today, or <code>/the-daily-fix/YYMMDD</code> for a
        calendar day. Pillars use <code>?tab=body</code> or <code>?tab=brain</code> (belly is the
        default with no param).
      </p>
    </div>
  );
}

function DaySkeleton() {
  return (
    <div className="df-skeleton" aria-hidden="true">
      <div className="df-skeleton-title" />
      <div className="df-skeleton-image" />
      <div className="df-skeleton-line" />
      <div className="df-skeleton-line df-skeleton-line-short" />
      <div className="df-skeleton-line" />
    </div>
  );
}

function PillarTab({
  pillar,
  active,
  title,
  excerpt,
  meta,
  href,
}: {
  pillar: Pillar;
  active: boolean;
  title: string;
  excerpt: string;
  meta: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      replace
      role="tab"
      id={`fix-tab-${pillar}`}
      aria-selected={active}
      aria-controls={`fix-panel-${pillar}`}
      className="df-tab"
    >
      <span className="df-tab-label">{pillarLabel(pillar)}</span>
      <span className="df-tab-title">{title}</span>
      {excerpt ? <span className="df-tab-excerpt">{excerpt}</span> : null}
      <span className="df-tab-meta">{meta}</span>
    </Link>
  );
}

const PILLAR_KIND: Record<Pillar, string> = {
  belly: "Recipe",
  body: "Workout",
  brain: "Reading",
};

function tabCopy(load: DailyFixLoadState, pillar: Pillar) {
  const kind = PILLAR_KIND[pillar];
  if (load.status === "loading") return { title: kind, excerpt: "", meta: "Loading" };
  if (load.status !== "loaded") return { title: kind, excerpt: "", meta: "Unavailable" };
  const { day } = load;
  if (pillar === "belly") {
    return {
      title: day.belly.title,
      excerpt: plainText(day.belly.excerpt),
      meta: [kind, day.belly.protein_name].filter(Boolean).join(" · "),
    };
  }
  if (pillar === "body") {
    return { title: day.body.title, excerpt: plainText(day.body.excerpt), meta: kind };
  }
  const minutes = readMinutes(day.brain.html);
  return {
    title: day.brain.title,
    excerpt: plainText(day.brain.excerpt),
    meta: [kind, minutes ? `${minutes} min read` : null].filter(Boolean).join(" · "),
  };
}

export function DayPanel({
  requestedIso,
  panelIso,
  todayIso,
  routeKind,
  pillar,
  pillarExplicit,
  load,
  onOpenArchive,
}: DayPanelProps) {
  const day: DailyFixDay | null = load.status === "loaded" ? load.day : null;
  const displayIso = day?.date ?? panelIso;
  const isTodayRequest = requestedIso === todayIso && routeKind === "today";
  const older = addCalendarDays(panelIso, -1);
  const newer = addCalendarDays(panelIso, 1);
  const newerDisabled = newer > todayIso;
  const strip = recentDateStrip(todayIso);
  // Closer-day disclaimer only on bare /the-daily-fix — never on dated URLs.
  const closer =
    routeKind === "today" && day != null && isCloserScheduledDay(day, requestedIso);
  const keptPillar = pillarExplicit ? pillar : null;
  const loading = load.status === "loading";

  const stripRef = useRef<HTMLDivElement>(null);
  const stripCenteredRef = useRef(false);
  useLayoutEffect(() => {
    const stripEl = stripRef.current;
    if (!stripEl) return;
    const chip =
      stripEl.querySelector<HTMLElement>('[aria-current="date"]') ??
      stripEl.querySelector<HTMLElement>(".df-chip:last-of-type");
    if (!chip) return;
    const stripBox = stripEl.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const left =
      stripEl.scrollLeft + chipBox.left - stripBox.left - (stripBox.width - chipBox.width) / 2;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    stripEl.scrollTo({
      left,
      behavior: stripCenteredRef.current && !reduce ? "smooth" : "auto",
    });
    stripCenteredRef.current = true;
  }, [panelIso]);

  return (
    <div>
      <div className="df-row">
        <div>
          <p className="df-kicker">{isTodayRequest && !closer ? "Today’s fix" : "This day"}</p>
          <h2 className="df-heading">{formatDayLabel(displayIso)}</h2>
        </div>
        <div className="df-actions">
          <Link href={dailyFixHref(todayIso, older, keptPillar)} className="df-btn df-btn-ghost">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Link>
          {newerDisabled ? (
            <span className="df-btn df-btn-ghost" aria-disabled="true" style={{ opacity: 0.35 }}>
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : (
            <Link href={dailyFixHref(todayIso, newer, keptPillar)} className="df-btn df-btn-ghost">
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <button type="button" className="df-btn df-btn-ink" onClick={onOpenArchive}>
            Archive
          </button>
        </div>
      </div>

      <div ref={stripRef} className="df-strip" aria-label="Recent days">
        {strip.map((iso) => {
          const parts = dayParts(iso);
          const active = iso === panelIso;
          return (
            <Link
              key={iso}
              href={dailyFixHref(todayIso, iso, keptPillar)}
              aria-current={active ? "date" : undefined}
              className="df-chip"
            >
              <span className="df-chip-dow">{parts.weekdayShort}</span>
              <span className="df-chip-day">{parts.day}</span>
            </Link>
          );
        })}
      </div>

      <div className="df-tabs" role="tablist" aria-label="Belly, body, and brain">
        {(["belly", "body", "brain"] as const).map((item) => {
          const copy = tabCopy(load, item);
          return (
            <PillarTab
              key={item}
              pillar={item}
              active={pillar === item}
              title={copy.title}
              excerpt={copy.excerpt}
              meta={copy.meta}
              href={dailyFixHref(todayIso, panelIso, item)}
            />
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`fix-panel-${pillar}`}
        aria-labelledby={`fix-tab-${pillar}`}
        className="df-panel"
        aria-busy={loading ? "true" : undefined}
      >
        {closer ? (
          <p className="df-disclaimer">
            Showing {formatDayLabel(day.date)}, the closest scheduled Daily Fix to the day you asked
            for.
          </p>
        ) : null}
        {load.status === "invalid" ? <InvalidCopy /> : null}
        {loading ? (
          <div role="status">
            <span className="sr-only">Loading</span>
            <DaySkeleton />
          </div>
        ) : null}
        {load.status === "unavailable" ? <UnavailableCopy /> : null}
        {load.status === "loaded" && day ? (
          <DayContent key={day.date} day={day} pillar={pillar} />
        ) : null}
      </div>
      <p className="sr-only">{dailyFixHref(todayIso, panelIso, keptPillar)}</p>
    </div>
  );
}
