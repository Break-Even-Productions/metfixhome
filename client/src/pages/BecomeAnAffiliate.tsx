/*
 * BecomeAnAffiliate.tsx
 * F1 style parity — cream / ink / gold tokens (Playfair + Plus Jakarta)
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Dumbbell,
  Globe,
  Heart,
  MapPin,
  Shield,
  Star,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import CopyrightText from "@/components/CopyrightText";
import { CmsLink } from "@/components/CmsLink";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAffiliatePage } from "@/hooks/useSanityContent";
import type { AffiliateBenefitIcon } from "@/data/fallbackAffiliate";
import { HighlightedHeadlineText } from "@/lib/highlightedText";
import "./become-an-affiliate.css";

const AFFILIATE_HERO_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663584830808/YwiuoEuxWg23nCV8GiFWnu/mfv3-community-Pq4JjmJNpqXxFJcxmJVrVW.webp";

const BENEFIT_ICONS: Record<AffiliateBenefitIcon, React.ReactNode> = {
  book: <BookOpen size={22} />,
  users: <Users size={22} />,
  award: <Award size={22} />,
  dumbbell: <Dumbbell size={22} />,
  globe: <Globe size={22} />,
  "map-pin": <MapPin size={22} />,
  check: <Check size={22} />,
  shield: <Shield size={22} />,
  star: <Star size={22} />,
  heart: <Heart size={22} />,
};

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

function Reveal({
  children,
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const cls =
    direction === "left" ? "reveal-left" : direction === "right" ? "reveal-right" : "reveal";
  return (
    <div ref={ref} className={cls} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="course-card" style={{ height: "100%" }}>
        <div style={{ color: "var(--color-accent-text)", marginBottom: "1.25rem" }}>{icon}</div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: "1rem",
            color: "var(--color-ink)",
            marginBottom: "0.5rem",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.875rem",
            lineHeight: 1.7,
            color: "var(--color-muted)",
            fontWeight: 300,
          }}
        >
          {desc}
        </div>
      </div>
    </Reveal>
  );
}

function StepRow({
  num,
  title,
  desc,
  delay,
}: {
  num: string;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div
        style={{
          display: "flex",
          gap: "2rem",
          paddingTop: "2rem",
          paddingBottom: "2rem",
          borderBottom: "1px solid var(--color-line)",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
            color: "var(--color-accent-text)",
            minWidth: "2.5rem",
            paddingTop: "0.2rem",
            flexShrink: 0,
          }}
        >
          {num}
        </div>
        <div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: "1.05rem",
              color: "var(--color-ink)",
              marginBottom: "0.4rem",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.875rem",
              lineHeight: 1.7,
              color: "var(--color-muted)",
              fontWeight: 300,
            }}
          >
            {desc}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default function BecomeAnAffiliate() {
  usePageMeta({
    title: "Become a MetFix Affiliate — Metabolic Health for Your Gym",
    description:
      "Apply to become a MetFix affiliate gym. Get metabolic health education, programming, course access, and revenue share — join a global network fighting chronic disease.",
  });
  const isDesktop = useIsDesktop(900);
  const { page } = useAffiliatePage();
  const applyUrl = page.application.url || page.hero.primaryCta.href;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="affiliate-page page-stack">
      {/* ═══ HERO ══════════════════════════════════════════════════ */}
      <section
        className="section-card section-card--hero"
        style={{
          position: "relative",
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0 }}>
          <img
            src={AFFILIATE_HERO_IMG}
            alt="MetFix Affiliate Community"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 35%",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(105deg, rgba(23, 21, 18,0.97) 0%, rgba(23, 21, 18,0.88) 50%, rgba(23, 21, 18,0.4) 100%)",
            }}
          />
        </div>
        <div
          className="container affiliate-hero-content"
          style={{ position: "relative", zIndex: 1, paddingTop: "3rem", paddingBottom: "3.5rem" }}
        >
          <div style={{ maxWidth: "700px" }}>
            <Reveal>
              <div className="rule">
                <span className="label-mono">{page.hero.eyebrow}</span>
              </div>
              <h1
                className="display-serif"
                style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", marginBottom: "1.75rem" }}
              >
                <HighlightedHeadlineText headline={page.hero.headline} />
              </h1>
              <p
                style={{
                  fontSize: "clamp(1rem, 1.5vw, 1.15rem)",
                  lineHeight: 1.8,
                  color: "color-mix(in srgb, var(--color-cream) 72%, transparent)",
                  maxWidth: "560px",
                  marginBottom: "3rem",
                  fontWeight: 300,
                }}
              >
                {page.hero.subtext}
              </p>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <CmsLink cta={{ ...page.hero.primaryCta, href: applyUrl }} className="btn-primary">
                  {page.hero.primaryCta.label} <ArrowRight size={15} />
                </CmsLink>
                <CmsLink cta={page.hero.secondaryCta} className="btn-outline btn-outline--on-ink">
                  {page.hero.secondaryCta.label}
                </CmsLink>
              </div>
            </Reveal>
            <div style={{ marginTop: "4rem", display: "flex", gap: "3rem", flexWrap: "wrap" }}>
              {page.hero.stats.map((s) => (
                <div key={s.label}>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontWeight: 700,
                      fontSize: "1.4rem",
                      color: "var(--color-cream)",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.12em",
                      color: "color-mix(in srgb, var(--color-cream) 55%, transparent)",
                      textTransform: "uppercase",
                      marginTop: "0.2rem",
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHAT IT MEANS ══════════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-paper)", borderTop: "1px solid var(--color-line)" }}>
        <div className="container section-pad">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: "5rem",
              alignItems: "start",
            }}
          >
            <Reveal direction="left">
              <div>
                <div className="rule">
                  <span className="label-mono">{page.whatItMeans.eyebrow}</span>
                </div>
                <h2
                  className="display-serif"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "1.5rem" }}
                >
                  <HighlightedHeadlineText headline={page.whatItMeans.headline} />
                </h2>
                {page.whatItMeans.body.map((paragraph, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: "1rem",
                      lineHeight: 1.8,
                      color: i === 0 ? "var(--color-muted)" : "var(--color-muted)",
                      marginBottom: i === 0 ? "1.5rem" : 0,
                      fontWeight: 300,
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </Reveal>
            <Reveal direction="right">
              <div>
                <div
                  style={{
                    marginBottom: "1.75rem",
                    paddingBottom: "1.75rem",
                    borderBottom: "1px solid var(--color-line)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontWeight: 700,
                        fontSize: "2.5rem",
                        color: "var(--color-accent-text)",
                        lineHeight: 1,
                      }}
                    >
                      {page.whatItMeans.price}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.6rem",
                          letterSpacing: "0.12em",
                          color: "var(--color-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        {page.whatItMeans.pricePeriod}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.6rem",
                          letterSpacing: "0.12em",
                          color: "var(--color-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        {page.whatItMeans.priceNote}
                      </span>
                    </div>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.82rem",
                      lineHeight: 1.65,
                      color: "var(--color-muted)",
                      fontWeight: 300,
                    }}
                  >
                    {page.whatItMeans.priceDescription}
                  </p>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.58rem",
                    letterSpacing: "0.12em",
                    color: "var(--color-accent-text)",
                    textTransform: "uppercase",
                    marginBottom: "1.25rem",
                  }}
                >
                  {page.whatItMeans.includesLabel}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {page.whatItMeans.includes.map((item, i) => (
                    <div
                      key={`${item}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "1rem",
                        padding: "1rem 1.5rem",
                        background: i % 2 === 0 ? "var(--color-cream)" : "var(--color-paper)",
                        borderLeft: "2px solid var(--color-accent)",
                      }}
                    >
                      <div style={{ color: "var(--color-accent-text)", flexShrink: 0, marginTop: "0.1rem" }}>
                        <Check size={13} />
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.875rem",
                          color: "var(--color-ink)",
                          lineHeight: 1.5,
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
        </div>
      </section>

      {/* ═══ BENEFITS ═══════════════════════════════════════════════ */}
      <section className="section-card section-card--paper"
        id="what-you-get"
        style={{ background: "var(--color-cream)", borderTop: "1px solid var(--color-line)" }}
      >
        <div className="container section-pad">
          <Reveal>
            <div className="rule">
              <span className="label-mono">{page.benefits.eyebrow}</span>
            </div>
            <h2
              className="display-serif"
              style={{
                fontSize: "clamp(2rem, 4vw, 3.5rem)",
                marginBottom: "1rem",
                maxWidth: "700px",
              }}
            >
              <HighlightedHeadlineText headline={page.benefits.headline} />
            </h2>
            <p
              style={{
                fontSize: "1rem",
                lineHeight: 1.75,
                color: "var(--color-muted)",
                maxWidth: "560px",
                marginBottom: "3.5rem",
                fontWeight: 300,
              }}
            >
              {page.benefits.subtext}
            </p>
          </Reveal>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: "1px",
              background: "var(--color-line)",
            }}
          >
            {page.benefits.items.map((item, i) => (
              <BenefitCard
                key={`${item.title}-${i}`}
                icon={BENEFIT_ICONS[item.icon] || BENEFIT_ICONS.book}
                title={item.title}
                desc={item.description}
                delay={i * 80}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ REQUIREMENTS ═══════════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-paper)", borderTop: "1px solid var(--color-line)" }}>
        <div className="container section-pad">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: "5rem",
              alignItems: "start",
            }}
          >
            <Reveal direction="left">
              <div>
                <div className="rule">
                  <span className="label-mono">{page.whoQualifies.eyebrow}</span>
                </div>
                <h2
                  className="display-serif"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "1.5rem" }}
                >
                  <HighlightedHeadlineText headline={page.whoQualifies.headline} />
                </h2>
                {page.whoQualifies.body.map((paragraph, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: i === 0 ? "1rem" : "0.9rem",
                      lineHeight: 1.8,
                      color: i === 0 ? "var(--color-muted)" : "var(--color-muted)",
                      marginBottom: i === 0 ? "1.5rem" : 0,
                      fontWeight: 300,
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
                <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <CmsLink cta={page.whoQualifies.primaryCta} className="btn-gold">
                    {page.whoQualifies.primaryCta.label} <ArrowRight size={13} />
                  </CmsLink>
                  <CmsLink
                    cta={page.whoQualifies.secondaryCta}
                    className="btn-outline"
                    style={{ fontSize: "0.75rem" }}
                  >
                    {page.whoQualifies.secondaryCta.label}
                  </CmsLink>
                </div>
              </div>
            </Reveal>
            <Reveal direction="right">
              <div>
                <div style={{ borderTop: "1px solid var(--color-line)" }}>
                  {page.whoQualifies.requirements.map((req, i) => (
                    <div
                      key={`${req.title}-${i}`}
                      style={{
                        display: "flex",
                        gap: "1.5rem",
                        padding: "1.75rem 0",
                        borderBottom: "1px solid var(--color-line)",
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          width: "1.5rem",
                          height: "1.5rem",
                          borderRadius: "50%",
                          background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: "0.1rem",
                        }}
                      >
                        <Check size={10} style={{ color: "var(--color-accent-text)" }} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontWeight: 600,
                            fontSize: "0.95rem",
                            color: "var(--color-ink)",
                            marginBottom: "0.35rem",
                          }}
                        >
                          {req.title}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "0.85rem",
                            lineHeight: 1.7,
                            color: "var(--color-muted)",
                            fontWeight: 300,
                          }}
                        >
                          {req.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-cream)", borderTop: "1px solid var(--color-line)" }}>
        <div className="container section-pad">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: "5rem",
              alignItems: "start",
            }}
          >
            <Reveal>
              <div>
                <div className="rule">
                  <span className="label-mono">{page.process.eyebrow}</span>
                </div>
                <h2
                  className="display-serif"
                  style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "1rem" }}
                >
                  <HighlightedHeadlineText headline={page.process.headline} />
                </h2>
                <p
                  style={{
                    fontSize: "1rem",
                    lineHeight: 1.75,
                    color: "var(--color-muted)",
                    fontWeight: 300,
                  }}
                >
                  {page.process.subtext}
                </p>
              </div>
            </Reveal>
            <div>
              <div style={{ borderTop: "1px solid var(--color-line)" }}>
                {page.process.steps.map((step, i) => (
                  <StepRow
                    key={`${step.title}-${i}`}
                    num={String(i + 1).padStart(2, "0")}
                    title={step.title}
                    desc={step.description}
                    delay={i * 80}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIAL ════════════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-paper)", borderTop: "1px solid var(--color-line)" }}>
        <div className="container section-pad">
          <Reveal>
            <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.2em",
                  color: "var(--color-accent-text)",
                  textTransform: "uppercase",
                  marginBottom: "2rem",
                }}
              >
                {page.networkQuote.eyebrow}
              </div>
              <blockquote className="testimonial-quote" style={{ marginBottom: "2rem" }}>
                {page.networkQuote.quote}
              </blockquote>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.6rem",
                  letterSpacing: "0.1em",
                  color: "var(--color-muted)",
                  textTransform: "uppercase",
                }}
              >
                {page.networkQuote.attribution}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ APPLICATION ════════════════════════════════════════════ */}
      <section className="section-card section-card--paper"
        id="affiliate-form"
        style={{ background: "var(--color-cream-2)", borderTop: "1px solid var(--color-line)" }}
      >
        <div className="container" style={{ paddingTop: "6rem", paddingBottom: "6rem" }}>
          <div style={{ marginBottom: "3rem" }}>
            <div className="rule">
              <span className="label-mono">{page.application.eyebrow}</span>
            </div>
            <h2
              className="display-serif"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "0.75rem" }}
            >
              <HighlightedHeadlineText headline={page.application.headline} />
            </h2>
            <p
              style={{
                fontSize: "0.95rem",
                lineHeight: 1.75,
                color: "var(--color-muted)",
                maxWidth: "560px",
                fontWeight: 300,
              }}
            >
              {page.application.subtext}
            </p>
          </div>

          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            {page.application.buttonLabel} <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════ */}
      <footer
        style={{
          background: "var(--color-cream-2)",
          borderTop: "1px solid var(--color-line)",
          paddingTop: "3rem",
          paddingBottom: "2.5rem",
        }}
        className="footer-mobile-pad"
      >
        <div className="container">
          <div
            className="affiliate-footer-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 800,
                  fontSize: "1rem",
                  letterSpacing: "0.15em",
                  color: "var(--color-ink)",
                  textTransform: "uppercase",
                }}
              >
                MetFix
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.5rem",
                  letterSpacing: "0.18em",
                  color: "var(--color-accent-text)",
                  textTransform: "uppercase",
                }}
              >
                The Metabolic Fix
              </div>
            </div>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <Link
                href="/"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8rem",
                  color: "var(--color-muted)",
                  textDecoration: "none",
                }}
              >
                ← Back to Home
              </Link>
              <a
                href="https://brokenscience.org/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8rem",
                  color: "var(--color-muted)",
                  textDecoration: "none",
                }}
              >
                Broken Science Initiative
              </a>
            </div>
            <CopyrightText variant="compact" />
          </div>
        </div>
      </footer>

      {/* Sticky mobile CTA bar */}
      <div
        className="aff-sticky-cta"
        style={{
          display: isDesktop ? "none" : "flex",
        }}
      >
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ flex: 1, justifyContent: "center", fontSize: "0.85rem" }}
        >
          {page.application.stickyButtonLabel || page.hero.primaryCta.label}{" "}
          <ArrowRight size={14} />
        </a>
        <Link href="/" className="aff-sticky-home">
          Home
        </Link>
      </div>
    </div>
  );
}
