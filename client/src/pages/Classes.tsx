/*
 * Classes.tsx — MetFix Courses Page (Redesigned)
 * Design: "Earned Authority" — #0A0A0A bg, #C9A96E gold, #EFEFEF text
 * Layout: sticky course nav → compact card grid → expandable detail panels
 * Course content is editable in Sanity (with local fallbacks).
 */
import { useEffect, useRef, useState } from "react";
import { assetUrl } from "@/const";
import CopyrightText from "@/components/CopyrightText";
import type { Course } from "@/lib/contentTypes";
import { useCourses } from "@/hooks/useSanityContent";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ArrowRight, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Link } from "wouter";

function useIsDesktop(breakpoint = 900) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= breakpoint : true
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
      { threshold: 0.04 }
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

  return (
    <div
      id={course.id}
      style={{
        background: isExpanded ? "rgba(201,169,110,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isExpanded ? "rgba(201,169,110,0.25)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: "2px",
        transition: "border-color 0.3s, background 0.3s",
        overflow: "hidden",
      }}
    >
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
                <span
                  style={{
                    fontFamily: "'DM Mono'",
                    fontSize: "0.6rem",
                    letterSpacing: "0.12em",
                    color: course.tagColor,
                    textTransform: "uppercase" as const,
                  }}
                >
                  {course.tag}
                </span>
              )}
              {course.isAffiliateFree && (
                <span
                  style={{
                    fontFamily: "'DM Mono'",
                    fontSize: "0.55rem",
                    letterSpacing: "0.1em",
                    color: "#C9A96E",
                    textTransform: "uppercase" as const,
                    padding: "0.15rem 0.5rem",
                    border: "1px solid rgba(201,169,110,0.3)",
                    borderRadius: "1px",
                  }}
                >
                  Included for Affiliates
                </span>
              )}
              {course.requiredForAffiliation && (
                <span
                  style={{
                    fontFamily: "'DM Mono'",
                    fontSize: "0.55rem",
                    letterSpacing: "0.1em",
                    color: "#EFEFEF",
                    background: "rgba(201,169,110,0.15)",
                    textTransform: "uppercase" as const,
                    padding: "0.15rem 0.5rem",
                    border: "1px solid rgba(201,169,110,0.4)",
                    borderRadius: "1px",
                  }}
                >
                  Required for Affiliation
                </span>
              )}
            </div>
            <h3
              style={{
                fontFamily: "'Playfair Display'",
                fontSize: "clamp(1.2rem, 2vw, 1.5rem)",
                color: "#EFEFEF",
                fontWeight: 700,
                margin: "0 0 0.4rem",
              }}
            >
              {course.title}
            </h3>
            {course.audience && (
              <div
                style={{
                  fontFamily: "'DM Sans'",
                  fontSize: "0.8rem",
                  color: "rgba(239,239,239,0.5)",
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
                      style={{
                        fontFamily: "'Playfair Display'",
                        fontSize: "1.1rem",
                        color: "#C9A96E",
                        fontWeight: 700,
                      }}
                    >
                      {s.value}
                    </span>
                    <span
                      style={{
                        fontFamily: "'DM Mono'",
                        fontSize: "0.55rem",
                        letterSpacing: "0.1em",
                        color: "rgba(239,239,239,0.45)",
                        textTransform: "uppercase" as const,
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
              flexDirection: "column" as const,
              alignItems: "flex-end",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            {course.price && (
              <div
                style={{
                  fontFamily: "'Playfair Display'",
                  fontSize: "1.1rem",
                  color: isComing ? "rgba(239,239,239,0.35)" : "#EFEFEF",
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
                onClick={onExpand}
                style={{
                  fontFamily: "'DM Mono'",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  color: isExpanded ? "#C9A96E" : "rgba(239,239,239,0.65)",
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.12)",
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  transition: "color 0.2s, border-color 0.2s",
                  borderColor: isExpanded
                    ? "rgba(201,169,110,0.4)"
                    : "rgba(255,255,255,0.12)",
                }}
              >
                {isExpanded ? "Less" : "Details"}
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showStart && (
                <a
                  href={enrollHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "'DM Mono'",
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    color: "#0A0A0A",
                    background: "#C9A96E",
                    border: "1px solid #C9A96E",
                    padding: "0.5rem 1rem",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
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
                  style={{
                    fontFamily: "'DM Mono'",
                    fontSize: "0.65rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    color: "rgba(239,239,239,0.5)",
                    background: "none",
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "0.5rem 1rem",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  {notifyLabel} <ArrowRight size={11} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "1.75rem 2rem 2rem",
            animation: "fadeIn 0.25s ease",
          }}
        >
          {course.details && (
            <p
              style={{
                fontFamily: "'DM Sans'",
                fontSize: "0.92rem",
                color: "rgba(239,239,239,0.75)",
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
              <div
                style={{
                  fontFamily: "'DM Mono'",
                  fontSize: "0.6rem",
                  letterSpacing: "0.15em",
                  color: "rgba(239,239,239,0.4)",
                  textTransform: "uppercase" as const,
                  marginBottom: "1rem",
                }}
              >
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
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'DM Mono'",
                        fontSize: "0.6rem",
                        color: "#C9A96E",
                        minWidth: "1.5rem",
                        paddingTop: "0.15rem",
                        flexShrink: 0,
                      }}
                    >
                      {m.number}
                    </span>
                    <div>
                      <div
                        style={{
                          fontFamily: "'DM Sans'",
                          fontSize: "0.85rem",
                          color: "#EFEFEF",
                          fontWeight: 500,
                          marginBottom: "0.2rem",
                        }}
                      >
                        {m.title}
                      </div>
                      {m.description && (
                        <div
                          style={{
                            fontFamily: "'DM Sans'",
                            fontSize: "0.78rem",
                            color: "rgba(239,239,239,0.55)",
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
                style={{ padding: "0.875rem 2rem", fontSize: "0.78rem" }}
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
                style={{ padding: "0.875rem 2rem", fontSize: "0.78rem" }}
              >
                {notifyLabel === "Notify Me" ? "Get Notified at Launch" : notifyLabel}{" "}
                <ArrowRight size={14} />
              </a>
            )}
            {course.isAffiliateFree && (
              <span
                style={{
                  fontFamily: "'DM Mono'",
                  fontSize: "0.6rem",
                  letterSpacing: "0.1em",
                  color: "#C9A96E",
                  textTransform: "uppercase" as const,
                }}
              >
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
    <div
      style={{
        background: "#0A0A0A",
        color: "#EFEFEF",
        minHeight: "100vh",
        overflowX: "hidden",
        maxWidth: "100vw",
      }}
    >
      <section
        style={{
          paddingTop: "6rem",
          paddingBottom: "2.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
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
              style={{
                fontFamily: "'DM Sans'",
                fontSize: "0.95rem",
                color: "rgba(239,239,239,0.65)",
                maxWidth: "520px",
                lineHeight: 1.75,
                marginBottom: "1.25rem",
              }}
            >
              Every course is built on the same framework: metabolic science that works in the
              real world. Start free. Go as deep as your practice requires.
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                background: "rgba(201,169,110,0.07)",
                border: "1px solid rgba(201,169,110,0.2)",
                borderRadius: "2px",
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Mono'",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  color: "#C9A96E",
                  textTransform: "uppercase" as const,
                }}
              >
                MetFix affiliates access all specialty courses at no cost and earn revenue share
                when clients purchase through them.{" "}
              </span>
              <Link
                href="/become-an-affiliate"
                style={{
                  fontFamily: "'DM Mono'",
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  color: "#C9A96E",
                  textDecoration: "underline",
                }}
              >
                Learn more
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div style={{ position: "sticky", top: "4.5rem", zIndex: 90 }}>
        <div
          style={{
            background: "rgba(10,10,10,0.97)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            overflowX: "auto",
            whiteSpace: "nowrap" as const,
            position: "relative",
          }}
        >
          <div
            className="course-tab-fade"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: "3.5rem",
              zIndex: 1,
              background: "linear-gradient(to right, transparent, rgba(10,10,10,0.97))",
              pointerEvents: "none",
            }}
          />
          <div
            className="container course-tab-bar-container"
            style={{ display: "flex", gap: "0", padding: "0" }}
          >
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => scrollTo(c.id)}
                style={{
                  fontFamily: "'DM Mono'",
                  fontSize: "0.62rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  whiteSpace: "nowrap" as const,
                  padding: "1rem 1.25rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: activeSection === c.id ? "#C9A96E" : "rgba(239,239,239,0.55)",
                  borderBottom:
                    activeSection === c.id ? "2px solid #C9A96E" : "2px solid transparent",
                  transition: "color 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== c.id) e.currentTarget.style.color = "rgba(239,239,239,0.85)";
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== c.id) e.currentTarget.style.color = "rgba(239,239,239,0.55)";
                }}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section style={{ padding: "3rem 0 6rem" }}>
        <div
          className="container"
          style={{ display: "flex", flexDirection: "column" as const, gap: "1rem" }}
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

      <section
        style={{
          padding: "5rem 0",
          background: "#080808",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
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
                  style={{
                    fontFamily: "'DM Sans'",
                    fontSize: "0.92rem",
                    color: "rgba(239,239,239,0.7)",
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
                  style={{ padding: "1rem 2.5rem", fontSize: "0.8rem" }}
                >
                  See what you get as a MetFix affiliate <ArrowRight size={14} />
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.875rem" }}>
                {[
                  "Access to all MetFix online courses at no cost",
                  "Complete Resource Library: live streams, journal clubs, articles, whiteboards, book reports",
                  "Special meal planning features and client tracking on the MetFix app",
                  "Revenue sharing when clients purchase courses through your gym",
                  "Affiliate listing on the MetFix gym finder map",
                  "Priority registration for Foundations Seminars",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <span style={{ color: "#C9A96E", flexShrink: 0, marginTop: "0.1rem" }}>·</span>
                    <span
                      style={{
                        fontFamily: "'DM Sans'",
                        fontSize: "0.88rem",
                        color: "rgba(239,239,239,0.72)",
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

      <footer
        style={{
          background: "#080808",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingTop: "2rem",
          paddingBottom: "2rem",
        }}
        className="footer-mobile-pad"
      >
        <div className="container">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap" as const,
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
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" as const }}>
              <Link
                href="/"
                style={{
                  fontFamily: "'DM Sans'",
                  fontSize: "0.8rem",
                  color: "rgba(239,239,239,0.55)",
                  textDecoration: "none",
                }}
              >
                Home
              </Link>
              <a
                href="https://brokenscience.org/metfix/seminar-calendar/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "'DM Sans'",
                  fontSize: "0.8rem",
                  color: "rgba(239,239,239,0.55)",
                  textDecoration: "none",
                }}
              >
                Foundations Seminar
              </a>
              <Link
                href="/become-an-affiliate"
                style={{
                  fontFamily: "'DM Sans'",
                  fontSize: "0.8rem",
                  color: "rgba(239,239,239,0.55)",
                  textDecoration: "none",
                }}
              >
                Become an Affiliate
              </Link>
              <a
                href="https://brokenscience.org/login/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "'DM Sans'",
                  fontSize: "0.8rem",
                  color: "rgba(239,239,239,0.55)",
                  textDecoration: "none",
                }}
              >
                Login
              </a>
            </div>
            <CopyrightText variant="compact" />
          </div>
        </div>
      </footer>

      <div
        style={{
          display: isDesktop ? "none" : "flex",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: "rgba(10,10,10,0.97)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "0.875rem 1.5rem",
          paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom))",
          gap: "0.75rem",
          alignItems: "center",
        }}
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
        <Link
          href="/become-an-affiliate"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.625rem 1rem",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(239,239,239,0.7)",
            textDecoration: "none",
            fontFamily: "'DM Mono'",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Affiliate
        </Link>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 480px) {
          .course-card-header { flex-direction: column !important; }
          .course-card-header > div:last-child { align-items: flex-start !important; }
        }
      `}</style>
    </div>
  );
}
