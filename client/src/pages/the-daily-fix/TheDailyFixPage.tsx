import { BookOpen, Dumbbell, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ArchiveBrowser } from "./ArchiveBrowser";
import { DayPanel } from "./DayPanel";
import { fetchDailyFixDay, fetchIsoForRoute, type DailyFixLoadState } from "./data";
import "./daily-fix.css";
import {
  bsiTodayIso,
  dailyFixCanonicalUrl,
  dailyFixHref,
  parseDailyFixRoute,
} from "./model";

const JAKARTA_ID = "daily-fix-jakarta-font";
const JAKARTA_HREF =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap";

const FIX_EPOCH = new Date(2025, 1, 10);

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

function useDocumentHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    window.addEventListener("pushState", sync);
    window.addEventListener("replaceState", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("pushState", sync);
      window.removeEventListener("replaceState", sync);
    };
  }, []);
  return hash;
}

export default function TheDailyFixPage({
  params: routeParams,
}: {
  params?: DailyFixParams;
}) {
  const hookParams = useParams<DailyFixParams>();
  const params = routeParams ?? hookParams;
  const [location, setLocation] = useLocation();
  const hash = useDocumentHash();
  const route = parseDailyFixRoute({
    date: params.date,
    pillar: params.pillar,
    yy: params.yy,
    mm: params.mm,
    dd: params.dd,
    hash,
  });
  const todayIso = bsiTodayIso();
  const requestedIso = route.kind === "day" && route.iso ? route.iso : todayIso;
  const fetchIso = fetchIsoForRoute(route.kind, route.iso, todayIso);
  const [load, setLoad] = useState<DailyFixLoadState>(() =>
    route.kind === "invalid" ? { status: "invalid" } : { status: "loading" },
  );

  useEffect(() => {
    loadJakartaSans();
  }, []);

  useEffect(() => {
    if (route.kind === "invalid") return;
    const next = dailyFixCanonicalUrl(route, window.location.search);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      setLocation(next, { replace: true });
    }
  }, [route, location, hash, setLocation]);

  useEffect(() => {
    if (route.kind === "invalid" || !fetchIso) {
      setLoad({ status: "invalid" });
      return;
    }
    const controller = new AbortController();
    setLoad({ status: "loading" });
    void fetchDailyFixDay(fetchIso, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setLoad(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "unavailable" });
      });
    return () => controller.abort();
  }, [fetchIso, route.kind]);

  const title = "Daily Fix · MetFix";
  const description =
    load.status === "loaded" ? `${load.day.belly.title} Daily Fix` : undefined;
  usePageMeta({ title, description });

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
          <div className="df-hero">
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
            <nav className="df-masthead" aria-label="Today's recipe, workout, and reading">
              {masthead.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.pillar}
                    href={dailyFixHref(todayIso, requestedIso, item.pillar)}
                    onClick={() => jumpTo("todays-fix")}
                  >
                    <span className="df-masthead-icon">
                      <Icon className="h-4 w-4" strokeWidth={2.35} />
                    </span>
                    <span>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
                        {item.label}
                      </span>
                      <span style={{ display: "block", marginTop: 2, fontSize: 12, opacity: 0.8 }}>
                        {item.detail}
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
              pillar={route.pillar}
              pillarExplicit={route.pillarExplicit}
              load={load}
              onOpenArchive={() => jumpTo("daily-fix-archive")}
            />
          </div>
        </section>

        <section id="daily-fix-archive" className="df-card df-card-open">
          <div className="df-pad">
            <ArchiveBrowser onOpen={() => jumpTo("todays-fix")} />
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
