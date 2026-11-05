/*
 * Classes.tsx — MetFix Courses Page
 * F1 style parity — cream / ink / gold (Playfair + Plus Jakarta)
 * Layout: sticky course nav → expandable detail cards
 * Course content comes from the local catalog.
 */
import { useEffect, useRef, useState } from "react";
import { assetUrl } from "@/const";
import CopyrightText from "@/components/CopyrightText";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import type { Course } from "@/lib/contentTypes";
import { useCourses } from "@/hooks/useSiteContent";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ArrowRight, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import "./classes.css";

function useIsDesktop(breakpoint = 900) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= breakpoint : true,
  );
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isDesktop;
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("visible");
          obs.disconnect();
        }
      },
      { threshold: 0.04 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function CourseCard({
  course,
  onExpand,
  isExpanded,
}: {
  course: Course;
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const isComing = course.comingSoon;
  const enrollHref = course.landingPageUrl || "";
  const showStart = course.ctaType === "start" && Boolean(enrollHref);
  const showNotify = course.ctaType === "notify" && Boolean(enrollHref);
  const startLabel = course.startButtonLabel || "Start Here";
  const notifyLabel = course.notifyButtonLabel || "Notify Me";
  const tagColor = isComing ? "var(--color-muted)" : "var(--color-accent-text)";

  return (
    <div id={course.id} className={`cls-course-card${isExpanded ? " is-expanded" : ""}`}>
      <div style={{ padding: "1.75rem 2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
          className="course-card-header"
        >
          <div style={{ flex: 1, minWidth: "min(100%, 200px)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "0.6rem",
                flexWrap: "wrap",
              }}
            >
              {course.tag && (
                <span className="cls-label" style={{ color: tagColor }}>
                  {course.tag}
                </span>
              )}
              {course.isAffiliateFree && (
                <span className="cls-pill">Included for Affiliates</span>
              )}
              {course.requiredForAffiliation && (
                <span className="cls-pill cls-pill--ink">Required for Affiliation</span>
              )}
            </div>
            <h3
              className="cls-serif"
              style={{
                fontSize: "clamp(1.2rem, 2vw, 1.5rem)",
                color: "var(--color-ink)",
                fontWeight: 700,
                margin: "0 0 0.4rem",
              }}
            >
              {course.title}
            </h3>
            {course.audience && (
              <div
                className="cls-sans"
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-muted)",
                  marginBottom: "1rem",
                }}
              >
                {course.audience}
              </div>
            )}
            {course.stats.length > 0 && (
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                {course.stats.map((s, i) => (
                  <div key={`${s.label}-${i}`}>
                    <span
                      className="cls-serif"
                      style={{
                        fontSize: "1.1rem",
                        color: "var(--color-accent-text)",
                        fontWeight: 700,
                      }}
                    >
                      {s.value}
                    </span>
                    <span
                      className="cls-label"
                      style={{
                        color: "var(--color-muted)",
                        marginLeft: "0.35rem",
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            {course.price && (
              <div
                className="cls-serif"
                style={{
                  fontSize: "1.1rem",
                  color: isComing ? "var(--color-muted)" : "var(--color-ink)",
                  fontWeight: 700,
                }}
              >
                {course.price}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={onExpand}
                className={`cls-btn-ghost${isExpanded ? " is-active" : ""}`}
              >
                {isExpanded ? "Less" : "Details"}
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showStart && (
                <a
                  href={enrollHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cls-btn-solid"
                >
                  {startLabel}
                  <ExternalLink size={11} />
                </a>
              )}
              {showNotify && (
                <a
                  href={enrollHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cls-btn-ghost"
                >
                  {notifyLabel} <ArrowRight size={11} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="cls-expand-panel">
          {course.details && (
            <p
              className="cls-sans"
              style={{
                fontSize: "0.92rem",
                color: "color-mix(in srgb, var(--color-ink) 78%, transparent)",
                lineHeight: 1.8,
                marginBottom: "1.75rem",
                maxWidth: "680px",
                whiteSpace: "pre-wrap",
              }}
            >
              {course.details}
            </p>
          )}

          {course.modules.length > 0 && (
            <div>
              <div className="cls-label" style={{ marginBottom: "1rem", color: "var(--color-muted)" }}>
                Curriculum
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
                  gap: "0",
                }}
              >
                {course.modules.map((m, i) => (
                  <div
                    key={`${m.number}-${i}`}
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      padding: "0.75rem 1rem 0.75rem 0",
                      borderBottom: "1px solid var(--color-line)",
                    }}
                  >
                    <span
                      className="cls-sans"
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: "var(--color-accent-text)",
                        minWidth: "1.5rem",
                        paddingTop: "0.15rem",
                        flexShrink: 0,
                      }}
                    >
                      {m.number}
                    </span>
                    <div>
                      <div
                        className="cls-sans"
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--color-ink)",
                          fontWeight: 600,
                          marginBottom: "0.2rem",
                        }}
                      >
                        {m.title}
                      </div>
                      {m.description && (
                        <div
                          className="cls-sans"
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--color-muted)",
                            lineHeight: 1.5,
                          }}
                        >
                          {m.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "1.75rem",
              display: "flex",
              gap: "1rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {showStart && (
              <a
                href={enrollHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ padding: "0.875rem 2rem", fontSize: "0.85rem" }}
              >
                {startLabel}
                <ArrowRight size={14} />
              </a>
            )}
            {showNotify && (
              <a
                href={enrollHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
                style={{ padding: "0.875rem 2rem", fontSize: "0.85rem" }}
              >
                {notifyLabel === "Notify Me" ? "Get Notified at Launch" : notifyLabel}{" "}
                <ArrowRight size={14} />
              </a>
            )}
            {course.isAffiliateFree && (
              <span className="cls-label">
                Included for Affiliates · Revenue Share Available
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Classes() {
  usePageMeta({
    title: "MetFix Courses — Metabolic Health Education for Coaches & Affiliates",
    description:
      "Browse MetFix courses for coaches, gym owners, and affiliates. Metabolic health curriculum built to elevate your practice and help clients reverse chronic disease.",
  });
  const isDesktop = useIsDesktop(900);
  const { courses } = useCourses();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (courses.length > 0 && !activeSection) {
      setActiveSection(courses[0].id);
    }
  }, [courses, activeSection]);

  useEffect(() => {
    const fn = () => {
      for (const course of [...courses].reverse()) {
        const el = document.getElementById(course.id);
        if (el && el.getBoundingClientRect().top <= 200) {
          setActiveSection(course.id);
          return;
        }
      }
      if (courses[0]) setActiveSection(courses[0].id);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [courses]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setExpanded(id);
  };

  const toggleExpand = (id: string) => setExpanded(expanded === id ? null : id);
  const freeCourse = courses.find((c) => c.ctaType === "start" && c.landingPageUrl);

  return (
    <div className="classes-page page-stack">
      <section className="section-card section-card--ink" style={{ padding: "3rem 0 2.5rem" }}>
        <div className="container">
          <Reveal>
            <div className="rule">
              <span className="label-mono">All Courses</span>
            </div>
            <h1
              className="display-serif"
              style={{
                fontSize: "clamp(2rem, 4vw, 3.25rem)",
                maxWidth: "600px",
                marginBottom: "1rem",
              }}
            >
              The MetFix{" "}
              <span className="display-serif-italic text-gold">Curriculum</span>
            </h1>
            <p
              className="cls-sans"
              style={{
                fontSize: "0.95rem",
                color: "color-mix(in srgb, var(--color-cream) 72%, transparent)",
                maxWidth: "520px",
                lineHeight: 1.75,
                marginBottom: "1.25rem",
              }}
            >
              Every course is built on the same framework: metabolic science that works in the
              real world. Start free. Go as deep as your practice requires.
            </p>
            <div className="cls-affiliate-note">
              <span>
                MetFix affiliates access all specialty courses at no cost and earn revenue share
                when clients purchase through them.{" "}
              </span>
              <Link href="/become-an-affiliate">Learn more</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div
        style={{
          position: "sticky",
          top: "var(--global-nav-offset, 4.5rem)",
          zIndex: 90,
          paddingInline: 0,
        }}
      >
        <div className="cls-tab-bar">
          <div className="cls-tab-fade" />
          <div
            className="container course-tab-bar-container"
            style={{ display: "flex", gap: "0", padding: "0" }}
          >
            {courses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => scrollTo(c.id)}
                className={`cls-tab${activeSection === c.id ? " is-active" : ""}`}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="section-card section-card--paper" style={{ padding: "2.5rem 0 3.5rem" }}>
        <div
          className="container"
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {courses.map((course, i) => (
            <Reveal key={course.id} delay={i * 40}>
              <CourseCard
                course={course}
                isExpanded={expanded === course.id}
                onExpand={() => toggleExpand(course.id)}
              />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section-card section-card--cream" style={{ padding: "4rem 0" }}>
        <div className="container">
          <Reveal>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
                gap: "4rem",
                alignItems: "center",
              }}
            >
              <div>
                <div className="rule">
                  <span className="label-mono">For Affiliates</span>
                </div>
                <h2
                  className="display-serif"
                  style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", marginBottom: "1rem" }}
                >
                  As an affiliate, you get{" "}
                  <span className="display-serif-italic text-gold">free access</span> to the full
                  curriculum.
                </h2>
                <p
                  className="cls-sans cls-muted"
                  style={{
                    fontSize: "0.92rem",
                    lineHeight: 1.8,
                    marginBottom: "2rem",
                  }}
                >
                  MetFix affiliates get free access to all online courses, the full resource
                  library, and special tools on the MetFix app — plus revenue sharing when clients
                  purchase courses through your gym.
                </p>
                <Link
                  href="/become-an-affiliate"
                  className="btn-primary"
                  style={{ padding: "1rem 2.5rem", fontSize: "0.85rem" }}
                >
                  See what you get as a MetFix affiliate <ArrowRight size={14} />
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {[
                  "Access to all MetFix online courses at no cost",
                  "Complete Resource Library: live streams, journal clubs, articles, whiteboards, book reports",
                  "Special meal planning features and client tracking on the MetFix app",
                  "Revenue sharing when clients purchase courses through your gym",
                  "Affiliate listing on the MetFix gym finder map",
                  "Priority registration for Foundations Seminars",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <span
                      style={{ color: "var(--color-accent-text)", flexShrink: 0, marginTop: "0.1rem" }}
                    >
                      ·
                    </span>
                    <span
                      className="cls-sans"
                      style={{
                        fontSize: "0.88rem",
                        color: "color-mix(in srgb, var(--color-ink) 78%, transparent)",
                        lineHeight: 1.6,
                      }}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* WJ18: exactly one UpgradePrompt (B6 = unlocked doubles only). */}
      <section className="section-card section-card--paper" style={{ padding: "4rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="rule">
              <span className="label-mono">Membership</span>
            </div>
            <UpgradePrompt
              title="Unlock MetFix courses"
              body="Start your free month for full course access including MetFix Essentials, or manage billing if you already have an account."
            />
          </Reveal>
        </div>
      </section>

      <footer
        className="section-card section-card--cream-2 footer-mobile-pad"
        style={{ paddingTop: "2rem", paddingBottom: "2rem" }}
      >
        <div className="container">
          <div
            className="classes-footer-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <Link
              href="/"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <img
                src={assetUrl("/metfix-lockup.png")}
                alt="MetFix"
                style={{ height: "2.25rem", width: "auto", display: "block" }}
              />
            </Link>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <Link href="/" className="cls-footer-link">
                Home
              </Link>
              <a
                href="https://brokenscience.org/metfix/seminar-calendar/"
                target="_blank"
                rel="noopener noreferrer"
                className="cls-footer-link"
              >
                Foundations Seminar
              </a>
              <Link href="/become-an-affiliate" className="cls-footer-link">
                Become an Affiliate
              </Link>
              <a
                href="https://brokenscience.org/login/"
                target="_blank"
                rel="noopener noreferrer"
                className="cls-footer-link"
              >
                Login
              </a>
            </div>
            <CopyrightText variant="compact" />
          </div>
        </div>
      </footer>

      <div
        className="cls-sticky-cta"
        style={{ display: isDesktop ? "none" : "flex" }}
      >
        <a
          href={freeCourse?.landingPageUrl || "https://whatis.metfix.org/"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ flex: 1, justifyContent: "center", fontSize: "0.85rem" }}
        >
          Take the Free Class <ArrowRight size={14} />
        </a>
        <Link href="/become-an-affiliate" className="cls-sticky-affiliate">
          Affiliate
        </Link>
      </div>
    </div>
  );
}
