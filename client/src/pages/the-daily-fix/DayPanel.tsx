import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayContent } from "./DayContent";
import type { DailyFixLoadState } from "./data";
import {
  addCalendarDays,
  bsiTodayIso,
  dailyFixPath,
  dayParts,
  formatDayLabel,
  isCloserScheduledDay,
  pillarLabel,
  recentDateStrip,
  type DailyFixDay,
  type Pillar,
} from "./model";

type DayPanelProps = {
  requestedIso: string;
  pillar: Pillar;
  pillarInUrl: boolean;
  load: DailyFixLoadState;
  onSelect: (date: string, pillar: Pillar | null) => void;
  onOpenArchive: () => void;
};

function UnavailableCopy() {
  return (
    <div className="df-status" role="status">
      <h3>Daily Fix content isn’t available on this site yet</h3>
      <p>
        This page is a static GitHub Pages app. It cannot safely load a live Daily Fix day, so it does
        not guess, show sample recipes, or call WordPress from the browser. When a credentialed caller
        exists outside this bundle, this layout will show that day’s belly, body, and brain.
      </p>
    </div>
  );
}

function InvalidCopy() {
  return (
    <div className="df-status" role="alert">
      <h3>That day isn’t a Daily Fix date</h3>
      <p>
        Use <code>/the-daily-fix</code> for today, or <code>/the-daily-fix/YYYY-MM-DD</code> for a
        calendar day. Six-digit codes and hash routes are not used here.
      </p>
    </div>
  );
}

function PillarTab({
  pillar,
  active,
  title,
  meta,
  onSelect,
}: {
  pillar: Pillar;
  active: boolean;
  title: string;
  meta: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`fix-tab-${pillar}`}
      aria-selected={active}
      aria-controls={`fix-panel-${pillar}`}
      className="df-tab"
      onClick={onSelect}
    >
      <span className="df-tab-label">{pillarLabel(pillar)}</span>
      <span className="df-tab-title">{title}</span>
      <span className="df-tab-meta">{meta}</span>
    </button>
  );
}

function tabCopy(load: DailyFixLoadState, pillar: Pillar) {
  if (load.status !== "loaded") {
    if (pillar === "belly") return { title: "Recipe", meta: "Unavailable" };
    if (pillar === "body") return { title: "Workout", meta: "Unavailable" };
    return { title: "Reading", meta: "Unavailable" };
  }
  const { day } = load;
  if (pillar === "belly") return { title: day.belly.title, meta: "Recipe" };
  if (pillar === "body") return { title: day.body.title, meta: "Workout" };
  return { title: day.brain.title, meta: "Reading" };
}

export function DayPanel({
  requestedIso,
  pillar,
  pillarInUrl,
  load,
  onSelect,
  onOpenArchive,
}: DayPanelProps) {
  const todayIso = bsiTodayIso();
  const day: DailyFixDay | null = load.status === "loaded" ? load.day : null;
  const displayIso = day?.date ?? requestedIso;
  const isToday = requestedIso === todayIso;
  const older = addCalendarDays(requestedIso, -1);
  const newer = addCalendarDays(requestedIso, 1);
  const newerDisabled = newer > todayIso;
  const strip = recentDateStrip(todayIso);
  const closer = day && isCloserScheduledDay(day, requestedIso);

  return (
    <div>
      <div className="df-row">
        <div>
          <p className="df-kicker">{isToday ? "Today’s fix" : "This day"}</p>
          <h2 className="df-heading">{formatDayLabel(displayIso)}</h2>
        </div>
        <div className="df-actions">
          <button type="button" className="df-btn df-btn-ghost" onClick={() => onSelect(older, pillarInUrl ? pillar : null)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <button
            type="button"
            className="df-btn df-btn-ghost"
            disabled={newerDisabled}
            onClick={() => !newerDisabled && onSelect(newer, pillarInUrl ? pillar : null)}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="df-btn df-btn-ink" onClick={onOpenArchive}>
            Archive
          </button>
        </div>
      </div>

      <div className="df-strip" aria-label="Recent days">
        {strip.map((iso) => {
          const parts = dayParts(iso);
          const active = iso === requestedIso;
          return (
            <button
              key={iso}
              type="button"
              aria-current={active ? "date" : undefined}
              className="df-chip"
              onClick={() => onSelect(iso, pillarInUrl ? pillar : null)}
            >
              <span className="df-chip-dow">{parts.weekdayShort}</span>
              <span className="df-chip-day">{parts.day}</span>
            </button>
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
              meta={copy.meta}
              onSelect={() => onSelect(requestedIso, item)}
            />
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`fix-panel-${pillar}`}
        aria-labelledby={`fix-tab-${pillar}`}
        className="df-panel"
      >
        {closer ? (
          <p className="df-disclaimer">
            Showing {formatDayLabel(day.date)}, the closest scheduled Daily Fix to the day you asked
            for.
          </p>
        ) : null}
        {load.status === "invalid" ? <InvalidCopy /> : null}
        {load.status === "unavailable" ? <UnavailableCopy /> : null}
        {load.status === "loaded" && day ? <DayContent day={day} pillar={pillar} /> : null}
      </div>
      <p className="sr-only">{dailyFixPath(requestedIso, pillarInUrl ? pillar : null)}</p>
    </div>
  );
}
