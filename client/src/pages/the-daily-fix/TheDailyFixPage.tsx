import { ArrowRight, BookOpen, Dumbbell, UtensilsCrossed, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadMe, type MeState } from "@/lib/session";
import { ArchiveBrowser } from "./ArchiveBrowser";
import { isAuthUiHost } from "./authHost";
import { CommentThread } from "./CommentThread";
import { DayPanel } from "./DayPanel";
import { HeroMark, useHeroGlass } from "./HeroGlass";
import {
  fetchIsoForRoute,
  loadDailyFixDay,
  prefetchDailyFixWindow,
  seedFromDfInitial,
  syncLoadFromCache,
  type DailyFixLoadState,
} from "./data";
import { fetchDailyFixComments, type CommentsLoadState } from "./comments";
import { Leaderboard } from "./Leaderboard";
import "./daily-fix.css";
import {
  bsiTodayIso,
  consumeLegacyHashInBrowser,
  dailyFixCanonicalUrl,
  dailyFixHref,
  dateFromIso,
  FIRST_FIX_ISO,
  formatDayLabel,
  missingIsoFromSearch,
  normalizeDailyFixPath,
  outOfRangeLocation,
  parseDailyFixLocation,
  parseDailyFixRoute,
  yymmddFromIso,
} from "./model";

const JAKARTA_ID = "daily-fix-jakarta-font";
const JAKARTA_HREF =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap";

const FIX_EPOCH = dateFromIso(FIRST_FIX_ISO);

type DailyFixParams = {
  date?: string;
  pillar?: string;
  yy?: string;
  mm?: string;
  dd?: string;
};

function daysSinceFixStart(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = Math.round((today.getTime() - FIX_EPOCH.getTime()) / 86_400_000);
  return Math.max(0, elapsed);
}

function loadJakartaSans() {
  if (document.getElementById(JAKARTA_ID)) return;
  const link = document.createElement("link");
  link.id = JAKARTA_ID;
  link.rel = "stylesheet";
  link.href = JAKARTA_HREF;
  document.head.appendChild(link);
}

function jumpTo(id: string) {
  const node = document.getElementById(id);
  if (!node) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const top = node.getBoundingClientRect().top + window.scrollY - 96;
  window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
}

export default function TheDailyFixPage({
  params: routeParams,
}: {
  params?: DailyFixParams;
}) {
  // Legacy hash → ?tab= before first pillar read (no Belly flash).
  useState(() => consumeLegacyHashInBrowser());
  const hookParams = useParams<DailyFixParams>();
  const params = routeParams ?? hookParams;
  const [location, setLocation] = useLocation();
  // wouter's useSearch subscribes to push/replaceState (C4 tab clicks).
  const search = useSearch();
  const urlRoute = parseDailyFixRoute({
    date: params.date,
    pillar: params.pillar,
    yy: params.yy,
    mm: params.mm,
    dd: params.dd,
    search,
  });
  // One BSI-today sample for this mount lifetime (prefetch + bare fetch share it).
  const [todayIso] = useState(() => bsiTodayIso());
  // Unpublished or pre-launch days render where the canonical-URL effect is about to send them.
  const outOfRange =
    urlRoute.kind === "day" && urlRoute.iso ? outOfRangeLocation(urlRoute.iso, todayIso, search) : null;
  const route = outOfRange ? parseDailyFixLocation(outOfRange) : urlRoute;
  const fetchIso = fetchIsoForRoute(route.kind, route.iso, todayIso);
  const allowCloser = route.kind === "today";
  // Panel request key: bare uses today; dated uses URL ISO. Highlight uses response date when loaded.
  const requestedIso = route.kind === "day" && route.iso ? route.iso : todayIso;
  const routeKey = `${route.kind}:${fetchIso ?? "none"}`;

  // `?missing=` comes from the edge redirect; outOfRange covers in-app and dev navigation.
  const missingIso = outOfRange ? urlRoute.iso : missingIsoFromSearch(search);
  const missingKind =
    missingIso && missingIso > todayIso ? "future" : missingIso && missingIso < FIRST_FIX_ISO ? "early" : null;
  const [notice, setNotice] = useState<{ iso: string; kind: "future" | "early"; routeKey: string } | null>(
    null,
  );
  if (missingIso && missingKind && (notice?.iso !== missingIso || notice.routeKey !== routeKey)) {
    setNotice({ iso: missingIso, kind: missingKind, routeKey });
  } else if (!missingKind && notice && notice.routeKey !== routeKey) {
    setNotice(null);
  }

  const [load, setLoad] = useState<DailyFixLoadState>(() => {
    if (fetchIso) {
      const seeded = seedFromDfInitial(fetchIso, allowCloser);
      if (seeded) return { status: "loaded", day: seeded };
    }
    return syncLoadFromCache(route.kind, fetchIso);
  });
  const [loadKey, setLoadKey] = useState(routeKey);
  const [commentsLoad, setCommentsLoad] = useState<CommentsLoadState>(() =>
    route.kind === "invalid" ? { status: "unavailable" } : { status: "loading" },
  );
  // Start signed_out so the `/me` miss does not re-render and cancel day nav (CC1 C5).
  const [me, setMe] = useState<MeState>({ status: "signed_out" });
  const heroRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const glassReady = useHeroGlass(heroRef, barRef, markRef);
  const [reduceMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  // Sync from cache on route change — no skeleton flash when the day is already loaded.
  if (routeKey !== loadKey) {
    setLoadKey(routeKey);
    setLoad(syncLoadFromCache(route.kind, fetchIso));
  }

  useEffect(() => {
    loadJakartaSans();
  }, []);

  // R5 / C6.1: one `/me` per app load. Skip setState when still signed_out (CC1 C5).
  // AU25.2: preview hosts never hit /api/auth/*.
  useEffect(() => {
    if (!isAuthUiHost()) return;
    let active = true;
    void loadMe().then((next) => {
      if (!active) return;
      setMe((prev) => {
        if (prev.status === "signed_out" && next.status === "signed_out") return prev;
        if (
          prev.status === "signed_in" &&
          next.status === "signed_in" &&
          prev.public_name === next.public_name &&
          prev.moderator === next.moderator
        ) {
          return prev;
        }
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, []);

  // Normalize path/query (date forms, path pillars, bad tabs) via shared normalizer.
  // Canonicalize from the address bar (not stale `route` params) so in-app Link
  // navigations are not reverted when comments/`/me` re-render (CC1/C5).
  // Out-of-range days still rewrite the bar (2a-iv) before that pass.
  useEffect(() => {
    if (route.kind === "invalid") return;
    if (outOfRange) {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== outOfRange) {
        setLocation(outOfRange, { replace: true });
      }
      return;
    }
    const pathname = window.location.pathname;
    const searchNow = window.location.search;
    const normalized = normalizeDailyFixPath(pathname, searchNow);
    if (normalized.kind === "redirect") {
      setLocation(normalized.location, { replace: true });
      return;
    }
    const fromBar = parseDailyFixLocation(`${pathname}${searchNow}`);
    if (fromBar.kind === "invalid") return;
    const next = dailyFixCanonicalUrl(fromBar, searchNow);
    const current = `${pathname}${searchNow}`;
    if (next !== current) {
      setLocation(next, { replace: true });
    }
  }, [route, location, search, setLocation, outOfRange]);

  useEffect(() => {
    if (route.kind === "invalid" || !fetchIso) {
      setLoad({ status: "invalid" });
      return;
    }

    let active = true;
    // df-initial already seeded shown day — skip network for that ISO.
    const cached = syncLoadFromCache(route.kind, fetchIso);
    if (cached.status === "loaded") {
      setLoad(cached);
      return () => {
        active = false;
      };
    }
    setLoad(cached);

    void loadDailyFixDay(fetchIso, { allowCloser }).then((next) => {
      if (!active) return;
      setLoad(next);
    });

    return () => {
      active = false;
    };
  }, [fetchIso, route.kind, allowCloser]);

  // R23 / C6.2: start comments in parallel when the date is known (dated routes).
  // Bare today with closer-day resolution waits for the loaded day so we never
  // GET comments for TODAY when the day remaps (page.mount: not.toContain(TODAY)).
  const loadedCommentIso = load.status === "loaded" ? load.day.date : null;
  const commentIso =
    route.kind === "invalid" || load.status === "invalid" || load.status === "unavailable"
      ? null
      : route.kind === "today" && allowCloser
        ? loadedCommentIso
        : (loadedCommentIso ?? fetchIso);
  useEffect(() => {
    if (!commentIso) {
      setCommentsLoad({ status: "unavailable" });
      return;
    }
    const controller = new AbortController();
    setCommentsLoad({ status: "loading" });
    void fetchDailyFixComments(commentIso, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setCommentsLoad(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCommentsLoad({ status: "unavailable" });
      });
    return () => controller.abort();
  }, [commentIso]);

  // Prefetch −1/−2 only on bare today route (Q1), after today's load is kicked off.
  useEffect(() => {
    if (route.kind !== "today") return;
    prefetchDailyFixWindow(todayIso);
  }, [todayIso, route.kind]);

  const title = "Daily Fix · MetFix";
  const description =
    load.status === "loaded" ? `${load.day.belly.title} Daily Fix` : undefined;
  usePageMeta({ title, description });

  // Calendar / day label follow the response date when loaded (bare closer-day).
  const panelIso = load.status === "loaded" ? load.day.date : requestedIso;
  const tabPhoto =
    load.status === "loaded"
      ? (load.day[route.pillar].photo_url ?? load.day.belly.photo_url ?? load.day.brain.photo_url)
      : null;
  // Hold the last photo through day loads so the search panel doesn't flash.
  const [backdrop, setBackdrop] = useState(tabPhoto);
  if (tabPhoto && tabPhoto !== backdrop) setBackdrop(tabPhoto);

  const masthead = useMemo(
    () =>
      [
        { pillar: "belly" as const, label: "Belly", detail: "Recipe", icon: UtensilsCrossed },
        { pillar: "body" as const, label: "Body", detail: "Workout", icon: Dumbbell },
        { pillar: "brain" as const, label: "Brain", detail: "Reading", icon: BookOpen },
      ] as const,
    [],
  );

  return (
    <main className="daily-fix-page">
      <div className="df-stack">
        <section id="daily-fix" className="df-card">
          <div ref={heroRef} className={glassReady ? "df-hero is-glass" : "df-hero"}>
            <video
              className="df-hero-video"
              src="/hero.mp4"
              poster="/hero-poster.jpg"
              autoPlay={!reduceMotion}
              muted
              loop
              playsInline
              preload="auto"
              aria-label="MetFix in real life"
            />
            <div className="df-hero-shade" aria-hidden="true" />
            <HeroMark markRef={markRef} glassReady={glassReady} />
            <div className="df-hero-copy">
              <h1>
                <span>Eat.</span>
                <span>Move.</span>
                <span>
                  <em>Think.</em>
                </span>
              </h1>
              <p className="df-hero-lede">
                {daysSinceFixStart().toLocaleString("en-US")} free recipes, workouts, and readings —
                and counting.
              </p>
              <div className="df-hero-actions">
                <button type="button" className="df-btn df-btn-accent" onClick={() => jumpTo("todays-fix")}>
                  Get today’s fix
                  <span aria-hidden="true">↓</span>
                </button>
                <button type="button" className="df-btn df-btn-ghost" onClick={() => jumpTo("daily-fix-subscribe")}>
                  Subscribe free
                </button>
              </div>
            </div>
            <nav ref={barRef} className="df-masthead" aria-label="Today's recipe, workout, and reading">
              {masthead.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.pillar}
                    href={dailyFixHref(todayIso, panelIso, item.pillar)}
                    onClick={() => jumpTo("todays-fix")}
                  >
                    <span className="df-masthead-icon">
                      <Icon className="h-4 w-4" strokeWidth={2.35} />
                    </span>
                    <span className="df-masthead-text">
                      <span style={{ display: "block", fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                        {item.label}
                      </span>
                      <span className="df-masthead-detail">
                        {load.status === "loaded" ? load.day[item.pillar].title : item.detail}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </section>

        <section id="todays-fix" className="df-card">
          <div className="df-pad">
            <DayPanel
              requestedIso={requestedIso}
              panelIso={panelIso}
              todayIso={todayIso}
              routeKind={route.kind}
              pillar={route.pillar}
              pillarExplicit={route.pillarExplicit}
              load={load}
              onOpenArchive={() => jumpTo("daily-fix-archive")}
              notice={
                notice ? (
                  <div className="df-notice" role="status">
                    <p>
                      {notice.kind === "future"
                        ? `${formatDayLabel(notice.iso)} isn’t published yet. Here’s today’s fix.`
                        : `Dates before ${yymmddFromIso(FIRST_FIX_ISO)} don’t exist. This is the first Daily Fix.`}
                    </p>
                    {notice.kind === "early" ? (
                      <Link className="df-notice-link" href={dailyFixHref(todayIso, todayIso, route.pillar)}>
                        Jump to today
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="df-notice-close"
                      aria-label="Dismiss"
                      onClick={() => setNotice(null)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : null
              }
            />
            {route.kind !== "invalid" ? (
              <>
                <Leaderboard
                  dateIso={commentIso}
                  pillar={route.pillar}
                  signedIn={me.status === "signed_in"}
                />
                <CommentThread
                  load={commentsLoad}
                  pillar={route.pillar}
                  dateIso={commentIso}
                  viewerDisplayName={me.status === "signed_in" ? me.public_name : null}
                  moderator={me.status === "signed_in" ? me.moderator : false}
                  onCommentsChanged={setCommentsLoad}
                />
              </>
            ) : null}
          </div>
        </section>

        <section id="daily-fix-archive" className="df-card df-card-open">
          <div className="df-pad">
            <ArchiveBrowser todayIso={todayIso} backdrop={backdrop} onOpen={() => jumpTo("todays-fix")} />
          </div>
        </section>

        <section id="daily-fix-subscribe" className="df-card df-card-ink">
          <div className="df-pad">
            <div className="df-subscribe">
              <p className="df-pill">Free forever</p>
              <h2>
                Get your <em>Daily Fix.</em>
              </h2>
              <p>In your inbox every morning. A recipe, a workout, a read.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Email address</span>
                  <input type="email" name="email" autoComplete="email" placeholder="you@email.com" />
                </label>
                <button type="submit" className="df-btn df-btn-accent">
                  Join
                </button>
              </form>
              <p className="df-fine">Unsubscribe anytime. A MetFix product by The Broken Science Initiative.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
