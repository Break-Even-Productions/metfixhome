import { useRef, type ReactNode } from "react";
import { DashAsteriskFallback, useDashHeroGlass } from "./DashHeroGlass";

export type ToolHeroStat = {
  label: string;
  value: string;
  note?: string;
};

type Props = {
  photo: string;
  photoFallback?: string;
  chips: ReactNode;
  title: string;
  lede: string;
  cta?: ReactNode;
  stats: ToolHeroStat[];
};

/** Rounded liquid-glass tool hero shared by meals + benchmarks pages. */
export function ToolHero({
  photo,
  photoFallback,
  chips,
  title,
  lede,
  cta,
  stats,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const glassReady = useDashHeroGlass(rootRef, barRef, markRef, photo);

  return (
    <section
      ref={rootRef}
      className={`dash-tool-hero${glassReady ? " is-glass" : ""}`}
      aria-label={title}
    >
      <div className="dash-tool-hero__media" aria-hidden="true">
        <img
          src={photo}
          alt=""
          className="dash-tool-hero__photo"
          onError={
            photoFallback
              ? (e) => {
                  (e.currentTarget as HTMLImageElement).src = photoFallback;
                }
              : undefined
          }
        />
        <div className="dash-tool-hero__shade" />
      </div>
      <div
        ref={markRef}
        className="dash-tool-hero__mark"
        data-config='{"shape":1}'
        role="img"
        aria-label="MetFix"
      >
        {glassReady ? null : <DashAsteriskFallback className="dash-greet__mark-fallback" />}
      </div>
      <div className="dash-tool-hero__copy">
        <div className="dash-tool-hero__chips">{chips}</div>
        <h1 className="dash-tool-hero__title">{title}</h1>
        <p className="dash-tool-hero__lede">{lede}</p>
        {cta}
      </div>
      <div
        ref={barRef}
        className="dash-tool-hero__stats"
        data-config='{"cornerRadius":28}'
        role="group"
        aria-label="Summary"
      >
        {stats.map((s) => (
          <div key={s.label} className="dash-tool-hero__stat">
            <p className="dash-greet__stat-label">{s.label}</p>
            <p className="dash-greet__stat-value">{s.value}</p>
            {s.note ? <p className="dash-greet__stat-note">{s.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
