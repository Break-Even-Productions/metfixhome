import type { ReactNode } from "react";
import { Link } from "wouter";
import { basePath } from "@/const";

/** Faded barbell used as the Body section background mark. */
export function BodyWatermark() {
  return (
    <svg
      className="account-body-watermark"
      viewBox="0 0 128 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="6" width="10" height="36" rx="2" />
      <rect x="14" y="12" width="7" height="24" rx="1.5" />
      <rect x="23" y="21" width="82" height="6" rx="1.5" />
      <rect x="107" y="12" width="7" height="24" rx="1.5" />
      <rect x="116" y="6" width="10" height="36" rx="2" />
    </svg>
  );
}

export function BodyPanel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={["dash-panel", "dash-panel--body", className].filter(Boolean).join(" ")}>
      <BodyWatermark />
      {children}
    </div>
  );
}

const BODY_LINKS = [
  { id: "prs", href: "/account/benchmarks", label: "PR tracking" },
  { id: "workouts", href: "/account/workouts", label: "Workout feed" },
  { id: "coaching", href: "/account/coaching", label: "Coaching" },
] as const;

export function BodyNav({ current }: { current: (typeof BODY_LINKS)[number]["id"] }) {
  return (
    <nav className="account-body-nav" aria-label="Body">
      {BODY_LINKS.map((link) =>
        link.id === current ? (
          <span key={link.id} className="account-body-nav__current" aria-current="page">
            {link.label}
          </span>
        ) : (
          <Link key={link.id} href={basePath(link.href)} className="account-body-nav__link">
            {link.label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function FeedSkeleton({ label }: { label: string }) {
  return (
    <div className="dash-feed-skel" aria-busy="true" aria-label={label}>
      <span className="dash-skel dash-skel--title" />
      <span className="dash-skel dash-feed-skel__row" />
      <span className="dash-skel dash-feed-skel__row" />
      <span className="dash-skel dash-feed-skel__row" />
      <span className="dash-skel dash-feed-skel__row dash-feed-skel__row--short" />
    </div>
  );
}
