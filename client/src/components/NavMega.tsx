/**
 * Desktop mega drawer + mobile submenu for Courses, Programs, and About.
 * Copy matches mia-metfix; hrefs point at pages this site actually has.
 */
import type { ReactNode } from "react";
import { FALLBACK_HOME_COURSES } from "@/data/fallbackHome";

export type NavMegaKind = "courses" | "programs" | "about";

export type NavMegaLink = {
  title: string;
  headline: string;
  href: string;
};

export const NAV_COURSE_LINKS: readonly NavMegaLink[] = FALLBACK_HOME_COURSES.filter(
  (course) => course.href && course.href !== "#",
).map((course) => ({
  title: course.name,
  headline: course.desc,
  href: course.href,
}));

export const NAV_PROGRAM_LINKS: readonly NavMegaLink[] = [
  {
    title: "Become a MetFix Coach",
    headline: "Train and certify in metabolic health coaching.",
    href: "/#for-coaches",
  },
  {
    title: "Become a MetFix Affiliate",
    headline: "Bring MetFix to your gym or community.",
    href: "/become-an-affiliate",
  },
  {
    title: "Build a Gym",
    headline: "Buy equipment for a sponsored gym.",
    href: "https://brokenscience.org/shop/",
  },
  {
    title: "Become a Medical Society Member",
    headline: "Join the clinicians shaping the protocol.",
    href: "/#for-clinicians",
  },
  {
    title: "Create a Course",
    headline: "Share your expertise with the MetFix library.",
    href: "/#membership-section",
  },
];

export const NAV_ABOUT_LINKS: readonly NavMegaLink[] = [
  {
    title: "What is MetFix",
    headline: "The problem, the response, and how the model works.",
    href: "https://whatis.metfix.org/",
  },
  {
    title: "Advisory Board",
    headline: "Clinicians, researchers, and practitioners shaping MetFix.",
    href: "/#experts",
  },
  {
    title: "Leadership",
    headline: "The people leading MetFix.",
    href: "/#about",
  },
  {
    title: "Seminar Staff",
    headline: "The coaches who teach MetFix in the room.",
    href: "/affiliate-seminars",
  },
];

export const NAV_SEE_ALL_COURSES = { title: "See all", href: "/courses" } as const;
export const NAV_HOST_SEMINAR = { title: "Host a Seminar", href: "/affiliate-seminars" } as const;

export function megaKindForLabel(label: string): NavMegaKind | null {
  switch (label.trim().toLowerCase()) {
    case "courses":
      return "courses";
    case "programs":
      return "programs";
    case "about":
      return "about";
    default:
      return null;
  }
}

export function linksForMega(kind: NavMegaKind): readonly NavMegaLink[] {
  switch (kind) {
    case "courses":
      return NAV_COURSE_LINKS;
    case "programs":
      return NAV_PROGRAM_LINKS;
    case "about":
      return NAV_ABOUT_LINKS;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

function showsHostSeminar(kind: NavMegaKind): boolean {
  switch (kind) {
    case "courses":
    case "programs":
      return true;
    case "about":
      return false;
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

type NavMegaPanelProps = {
  kind: NavMegaKind;
  renderLink: (link: NavMegaLink, className: string) => ReactNode;
};

export function NavMegaPanel({ kind, renderLink }: NavMegaPanelProps) {
  const links = linksForMega(kind);
  const cards = kind === "programs";

  return (
    <div className="global-nav__mega-inner">
      <div className={cards ? "global-nav__mega-grid global-nav__mega-grid--cards" : "global-nav__mega-grid"}>
        {links.map((link) =>
          renderLink(link, cards ? "global-nav__mega-card" : "global-nav__mega-link"),
        )}
      </div>
      {kind === "courses" || showsHostSeminar(kind) ? (
        <div className="global-nav__mega-footer">
          {kind === "courses"
            ? renderLink(
                { title: `${NAV_SEE_ALL_COURSES.title} →`, headline: "", href: NAV_SEE_ALL_COURSES.href },
                "global-nav__mega-seeall",
              )
            : null}
          {showsHostSeminar(kind)
            ? renderLink(
                { title: `${NAV_HOST_SEMINAR.title} →`, headline: "", href: NAV_HOST_SEMINAR.href },
                "global-nav__mega-cta",
              )
            : null}
        </div>
      ) : null}
    </div>
  );
}
