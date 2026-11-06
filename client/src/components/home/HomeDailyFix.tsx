/**
 * Condensed Daily Fix teaser — liquid-glass product crop above Classes.
 * Stageshow framing: one hard crop, real words on Eat/Move/Think + today's
 * pillar titles, filler bars until the day loads, glass mark + masthead.
 */
import { BookOpen, Dumbbell, UtensilsCrossed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useReducedMotion } from "framer-motion";
import {
  loadDailyFixDay,
  type DailyFixLoadState,
} from "@/pages/the-daily-fix/data";
import {
  bsiTodayIso,
  dailyFixHref,
  formatDayLabel,
  type DailyFixDay,
  type Pillar,
} from "@/pages/the-daily-fix/model";
import { AsteriskFallback, useHomeHeroGlass } from "./HomeHeroGlass";
import { Reveal } from "./Reveal";
import { SectionCard } from "./SectionCard";

const PILLARS = [
  { pillar: "belly" as const, label: "Belly", detail: "Recipe", Icon: UtensilsCrossed },
  { pillar: "body" as const, label: "Body", detail: "Workout", Icon: Dumbbell },
  { pillar: "brain" as const, label: "Brain", detail: "Reading", Icon: BookOpen },
] as const;

function pillarTitle(
  load: DailyFixLoadState,
  day: DailyFixDay | null,
  pillar: Pillar,
  fallback: string,
): string | null {
  if (load.status === "loading") return null;
  if (!day) return fallback;
  const title = day[pillar].title?.trim();
  return title || fallback;
}

function backdropFor(day: DailyFixDay | null): string | null {
  if (!day) return null;
  return day.belly.photo_url ?? day.brain.photo_url ?? day.body.photo_url ?? null;
}

export function HomeDailyFix() {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLDivElement>(null);

  const [load, setLoad] = useState<DailyFixLoadState>({ status: "loading" });
  const todayIso = bsiTodayIso();
  const day = load.status === "loaded" ? load.day : null;
  const panelIso = day?.date ?? todayIso;
  const photoSrc = backdropFor(day) ?? "/hero-poster.jpg";
  const glassReady = useHomeHeroGlass(heroRef, barRef, markRef, photoSrc);
  const usePhoto = Boolean(backdropFor(day));

  useEffect(() => {
    let cancelled = false;
    void loadDailyFixDay(todayIso, { allowCloser: true }).then((next) => {
      if (!cancelled) setLoad(next);
    });
    return () => {
      cancelled = true;
    };
  }, [todayIso]);

  return (
    <SectionCard id="home-daily-fix" tone="ink" className="home-df">
      <div
        ref={heroRef}
        className={`home-df-hero${glassReady ? " is-glass" : ""}`}
      >
        {usePhoto ? (
          <img
            key={photoSrc}
            src={photoSrc}
            alt=""
            width={1600}
            height={900}
            decoding="async"
            loading="lazy"
            className="home-df-media"
          />
        ) : (
          <video
            className="home-df-media"
            src="/hero.mp4"
            poster="/hero-poster.jpg"
            autoPlay={!reduce}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="MetFix in real life"
          />
        )}
        <div className="home-df-shade" aria-hidden="true" />

        <div
          ref={markRef}
          className="masthead-mark"
          data-config='{"shape":1}'
          role="img"
          aria-label="MetFix"
        >
          {glassReady ? null : <AsteriskFallback />}
        </div>

        <Reveal className="home-df-copy">
          <p className="home-df-eyebrow">The Daily Fix</p>
          <p className="home-df-title" aria-hidden="true">
            <span>Eat.</span>
            <span>Move.</span>
            <span>
              <em>Think.</em>
            </span>
          </p>
          <h2 className="sr-only">The Daily Fix — Eat. Move. Think.</h2>
          <p className="home-df-lede">
            {day
              ? formatDayLabel(day.date)
              : "Free recipes, workouts, and readings — every day."}
          </p>
          <div className="home-df-actions">
            <Link href="/the-daily-fix" className="home-df-cta">
              Get today&apos;s fix
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Reveal>

        <nav
          ref={barRef}
          className="masthead-bar home-df-masthead"
          aria-label="Today's recipe, workout, and reading"
        >
          {PILLARS.map(({ pillar, label, detail, Icon }) => {
            const title = pillarTitle(load, day, pillar, detail);
            return (
              <Link
                key={pillar}
                href={dailyFixHref(todayIso, panelIso, pillar)}
                className="home-df-pillar"
              >
                <span className="home-df-pillar-icon">
                  <Icon className="h-4 w-4" strokeWidth={2.35} aria-hidden="true" />
                </span>
                <span className="home-df-pillar-text">
                  <span className="home-df-pillar-label">{label}</span>
                  {title ? (
                    <span className="home-df-pillar-detail">{title}</span>
                  ) : (
                    <span className="home-df-pillar-skel" aria-hidden="true" />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </SectionCard>
  );
}
