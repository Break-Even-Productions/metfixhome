/**
 * AffiliateSeminars.tsx — F1 style parity (cream / ink / gold)
 * Real seminar data from brokenscience.org/metfix/foundations/
 */

import { ArrowRight, Calendar, MapPin, ExternalLink, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import CopyrightText from "@/components/CopyrightText";
import { usePageMeta } from "@/hooks/usePageMeta";
import "./affiliate-seminars.css";

function useIsDesktop(breakpoint = 900) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= breakpoint : true);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isDesktop;
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el); return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, direction = "up" }: {
  children: React.ReactNode; delay?: number; direction?: "up" | "left" | "right";
}) {
  const { ref, visible } = useInView();
  const cls = direction === "left" ? "reveal-left" : direction === "right" ? "reveal-right" : "reveal";
  return (
    <div ref={ref} className={`${cls} ${visible ? "visible" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const SEMINARS_2026 = [
  {
    id: 1,
    date: "Jun 13–14, 2026",
    city: "Sacramento, CA",
    country: "USA",
    venue: "MetFix Pace",
    status: "open",
    registerUrl: "https://brokenscience.org/event/metfix-seminar-metfix-pace-in-sacramento-ca/",
  },
  {
    id: 2,
    date: "Aug 15–16, 2026",
    city: "Thurgau, Switzerland",
    country: "Switzerland",
    venue: "MetFix Pinecone Country",
    status: "open",
    registerUrl: "https://brokenscience.org/event/metfix-seminar-metfix-pinecone-country/",
  },
  {
    id: 3,
    date: "Sep 12–13, 2026",
    city: "Columbus, OH",
    country: "USA",
    venue: "Rogue Fitness",
    status: "open",
    registerUrl: "https://brokenscience.org/event/metfix-seminar-rogue-fitness-2/",
  },
  {
    id: 4,
    date: "Oct 10–11, 2026",
    city: "Bornem, Belgium",
    country: "Belgium",
    venue: "Rogue Europe",
    status: "open",
    registerUrl: "https://brokenscience.org/event/metfix-seminar-rogue-europe/",
  },
  {
    id: 5,
    date: "Nov 7–8, 2026",
    city: "Jacksonville, FL",
    country: "USA",
    venue: "MetFix JAX",
    status: "open",
    registerUrl: "https://brokenscience.org/event/metfix-seminar-metfix-jax-2/",
  },
  {
    id: 6,
    date: "Dec 5–6, 2026",
    city: "London, United Kingdom",
    country: "International",
    venue: "MetFix London Bridge",
    status: "open",
    registerUrl: "https://brokenscience.org/event/metfix-seminar-metfix-london-bridge-4/",
  },
];

const SYLLABUS_MODULES = [
  {
    num: "01",
    title: "What is MetFix?",
    desc: "Outlines the problem with our global health crisis and emphasizes MetFix as the ideal education for the individual, coach, or medical professional seeking to counter it. By defining health in objective terms and providing evidence-based nutrition and exercise protocols, this lecture leaves you with a pragmatic approach to optimize your health.",
  },
  {
    num: "02",
    title: "Food and Diet",
    desc: "Introducing the biochemical foundations of the course, this lecture explores energy, how we acquire it, and what form it has in our cells. It covers the basics of nutrition such as macronutrients, dives deeper to reveal commonly unknown facts about food, and finishes with some practical examples of successful diets.",
  },
  {
    num: "03",
    title: "The Mitochondria",
    desc: "This lecture focuses on the health of the mitochondria by defining metabolic flexibility and outlining its strength as a predictive model of health. You will also learn the role mitochondria play in metabolism and the various metabolic pathways of the cell.",
  },
  {
    num: "04",
    title: "Insulin / ROS Hypothesis",
    desc: "Explores the control system our cells have put in place to maintain homeostasis. An exploration of hormones and ancient cellular signalling that reveals the dangers of excess sugar and seed oil intake in our diet.",
  },
  {
    num: "05",
    title: "Chronic Disease",
    desc: "Links metabolic dysfunction to the most prevalent modern diseases: type 2 diabetes, cancer, heart disease, and Alzheimer's. Focuses on hyperinsulinemia and mitochondrial dysfunction as root causes.",
  },
  {
    num: "06",
    title: "Health Benefits of Exercise",
    desc: "Details how constantly varied, high-intensity functional movement improves mitochondrial health, builds resilience, and buffers against disease. Explains why exercise is critical, but not sufficient, without dietary change.",
  },
  {
    num: "07",
    title: "Behavior Change",
    desc: "Covers the addictive nature of sugar, the role of dopamine in habit formation, and the societal forces working against healthy choices. Coaches learn how to foster long-term change through education, empathy, and structured client relationships, using community and exercise as vehicles for transformation.",
  },
  {
    num: "08",
    title: "Program and Scaling for Special Populations",
    desc: "Discusses how to successfully implement a special populations health class in your practice and common pitfalls trainers have in dealing with morbidly obese, frail, and sick populations. This section of the course also includes practical breakout sessions to hone exercise scaling and modification skills.",
  },
];

function SyllabusAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      {SYLLABUS_MODULES.map((mod, i) => (
        <div
          key={i}
          style={{ borderBottom: i < SYLLABUS_MODULES.length - 1 ? "1px solid var(--color-line)" : "none" }}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "1rem",
              padding: "0.85rem 0", background: "none", border: "none", cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.55rem", color: "var(--color-accent-text)", letterSpacing: "0.1em", minWidth: "1.5rem", flexShrink: 0 }}>{mod.num}</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", color: open === i ? "var(--color-accent-text)" : "var(--color-ink)", lineHeight: 1.4, flex: 1, transition: "color 0.2s" }}>{mod.title}</span>
            <ChevronDown
              size={14}
              style={{
                color: "var(--color-accent)", flexShrink: 0,
                transform: open === i ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s ease",
              }}
            />
          </button>
          <div style={{
            overflow: "hidden",
            maxHeight: open === i ? "200px" : "0",
            transition: "max-height 0.3s ease",
          }}>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: "0.85rem", lineHeight: 1.75,
              color: "var(--color-muted)", paddingBottom: "1rem",
              paddingLeft: "2.5rem", margin: 0,
            }}>{mod.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const WHAT_TO_EXPECT = [
  {
    num: "01",
    title: "Framework",
    desc: "Deep immersion in the MetFix methodology: metabolic dysfunction, bioenergetics, and the clinical frameworks that separate MetFix coaches from the rest. Lectures, case studies, and group discussion.",
  },
  {
    num: "02",
    title: "Application",
    desc: "Hands-on practical application. Real client scenarios, programming design, biomarker interpretation, and the tools you'll use every day in your coaching practice.",
  },
  {
    num: "03",
    title: "Community & Network",
    desc: "You'll leave with more than a certification. You'll leave with a network of coaches who share your mission. MetFix affiliates support each other, refer clients, and collaborate on programming.",
  },
  {
    num: "04",
    title: "Certification & Next Steps",
    desc: "Foundations completion is highly recommended for any affiliate or serious coach. You'll receive your certificate and a clear roadmap for launching MetFix programming in your facility.",
  },
  {
    num: "05",
    title: "Spark",
    desc: "The implementation master guide to apply all you've learned in your seminar. Spark is your step-by-step playbook for launching MetFix programming with your clients from day one. It provides everything from emails to share with leads or current members, lectures to give, white board talks, tracking tools, etc. We walk you through implementation of the seminar material so you can jump right in. Free to Affiliates.",
  },
];

export default function AffiliateSeminars() {
  usePageMeta({
    title: "MetFix Foundations Seminars — In-Person Metabolic Health Training",
    description:
      "Find MetFix Foundations Seminars near you. Two-day in-person training for coaches and gym owners on the metabolic health framework behind MetFix affiliation.",
  });
  const isDesktop = useIsDesktop(900);
  const [scrolled, setScrolled] = useState(false);
  const [filter, setFilter] = useState<"all" | "USA" | "International">("all");

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const filtered = SEMINARS_2026.filter(s => {
    if (filter === "all") return true;
    if (filter === "USA") return s.country === "USA";
    return s.country !== "USA" && s.country !== "";
  });

  return (
    <div className="seminars-page page-stack">

      {/* ═══ NAV ══════════════════════════════════════════════════ */}

      {/* ═══ HERO ═════════════════════════════════════════════════ */}
      <section className="section-card section-card--paper affiliate-seminars-hero" style={{
        background: "var(--color-paper)",
        paddingTop: "3rem",
        paddingBottom: "3.5rem",
        position: "relative",
        overflow: "hidden",
      }}>
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "4rem", alignItems: "center" }}>
            <div>
              <Reveal>
                <div className="rule">
                  <span className="label-mono">In-Person Capstone</span>
                </div>
                <h1 className="display-serif" style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", marginBottom: "1.25rem" }}>
                  Foundations{" "}
                  <span className="display-serif-italic text-gold">Seminar.</span>
                </h1>
                <p style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "var(--color-muted)", marginBottom: "2rem", fontWeight: 300, maxWidth: "520px" }}>
                  The two-day weekend capstone. Hands-on, practical, transformative. Held at MetFix affiliate gyms worldwide. Coaches who complete Foundations leave with the tools, the framework, and the community to change their practice and their community's health.
                </p>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <a href="#calendar" className="btn-primary">
                    View 2026 Calendar <ArrowRight size={14} />
                  </a>
                  <Link href="/become-an-affiliate" className="btn-outline">
                    See what you get as a MetFix affiliate
                  </Link>
                </div>
              </Reveal>
            </div>
            <Reveal direction="right" delay={100}>
              <div style={{ border: "1px solid var(--color-line)", background: "var(--color-paper)", padding: "2.5rem" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.6rem", letterSpacing: "0.15em", color: "var(--color-accent-text)", textTransform: "uppercase", marginBottom: "1.5rem" }}>Syllabus — 2 Powerful Days of Learning</div>
                <SyllabusAccordion />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ LECTURE VIDEO ══════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-cream-2)", borderBottom: "1px solid var(--color-line)", overflow: "hidden" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <Reveal>
            <div className="rule" style={{ marginBottom: "1.5rem" }}>
              <span className="label-mono">Inside the Seminar</span>
            </div>
            <h2 className="display-serif" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", marginBottom: "0.75rem", lineHeight: 1.1 }}>
              Watch a live{" "}
              <span className="display-serif-italic text-gold">lecture.</span>
            </h2>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.75, color: "var(--color-muted)", maxWidth: "520px", marginBottom: "3rem", fontWeight: 300 }}>
              This is the real thing — a full lecture from an actual Foundations Seminar. Get a feel for the depth, the science, and the teaching style before you register.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", border: "1px solid var(--color-line)" }}>
              <iframe
                src="https://www.youtube.com/embed/9Ss4spDtgq0?rel=0&modestbranding=1&color=white"
                title="MetFix Foundations Seminar — Live Lecture"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ VIDEO TESTIMONIALS ════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-cream-2)", borderBottom: "1px solid var(--color-line)", overflow: "hidden" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <Reveal>
            <div className="rule" style={{ marginBottom: "1.5rem" }}>
              <span className="label-mono">What Past Attendees Are Saying</span>
            </div>
            <h2 className="display-serif" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", marginBottom: "0.75rem", lineHeight: 1.1 }}>
              From coaches to{" "}
              <span className="display-serif-italic text-gold">physicians worldwide.</span>
            </h2>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.75, color: "var(--color-muted)", maxWidth: "520px", marginBottom: "3.5rem", fontWeight: 300 }}>
              Foundations is making a measurable difference. Here is what participants have to say.
            </p>
          </Reveal>

          {/* Featured large video — first testimonial */}
          {(() => {
            const featured = { id: "XH_cwT9dMcM", name: "Theresa Sbarra", gym: "MetFix Victor, NY", quote: "It was really cool to understand the mechanisms and biomechanical processes behind why science doesn't make you healthy." };
            return (
              <Reveal>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", marginBottom: "1.5rem", border: "1px solid var(--color-line)", background: "var(--color-paper)", overflow: "hidden" }}>
                  <div style={{ position: "relative", paddingBottom: "50%", height: 0, overflow: "hidden" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${featured.id}?rel=0&modestbranding=1&color=white`}
                      title={featured.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    />
                  </div>
                  <div className="featured-caption" style={{ padding: "2rem 2.5rem", borderTop: "1px solid var(--color-line)", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1.05rem", color: "var(--color-ink)", lineHeight: 1.65, flex: 1, minWidth: "200px", margin: 0 }}>
                      &ldquo;{featured.quote}&rdquo;
                    </p>
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.65rem", letterSpacing: "0.12em", color: "var(--color-accent-text)", textTransform: "uppercase" }}>{featured.name}</div>
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.55rem", letterSpacing: "0.1em", color: "var(--color-muted)", textTransform: "uppercase", marginTop: "0.3rem" }}>{featured.gym}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })()}

          {/* Three smaller videos below */}
          <div className="video-testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "var(--color-line)" }}>
            {[
              { id: "BKJR8l5sZ0s", name: "Jen Crichton, MD", gym: "Petra Health MetFix, Canada", quote: "As a physician, there is no better feeling than leading someone back to their best metabolic health." },
              { id: "jq-gVWs3ZSs", name: "Liang Kong", gym: "CrossFit Kongfusion, China", quote: "We're only on the first day, but it already broke my mind." },
              { id: "tQH39Lt3Fb8", name: "MetFix Attendee", gym: "Foundations Seminar", quote: "Two days that change how you coach, train, and think about health." },
            ].map((v, i) => (
              <Reveal key={i} delay={i * 80}>
                <div style={{ background: "var(--color-paper)", display: "flex", flexDirection: "column" }}>
                  <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", flexShrink: 0 }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${v.id}?rel=0&modestbranding=1&color=white`}
                      title={v.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    />
                  </div>
                  <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid var(--color-line)", flex: 1 }}>
                    <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "0.875rem", color: "var(--color-ink)", lineHeight: 1.6, marginBottom: "0.875rem" }}>
                      &ldquo;{v.quote}&rdquo;
                    </p>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.6rem", letterSpacing: "0.12em", color: "var(--color-accent-text)", textTransform: "uppercase" }}>{v.name}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.55rem", letterSpacing: "0.1em", color: "var(--color-muted)", textTransform: "uppercase", marginTop: "0.25rem" }}>{v.gym}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      {/* ═══ WHAT TO EXPECT ═══════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-paper)", borderBottom: "1px solid var(--color-line)" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <Reveal>
            <div className="rule"><span className="label-mono">What to Expect</span></div>
            <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "3.5rem" }}>
              Two days that{" "}
              <span className="display-serif-italic text-gold">change everything.</span>
            </h2>
          </Reveal>
          {/* Vertical list — number | title + description side by side */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {WHAT_TO_EXPECT.map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "3rem 1fr 2fr",
                  gap: "2rem",
                  padding: "2rem 0",
                  borderBottom: i < WHAT_TO_EXPECT.length - 1 ? "1px solid var(--color-line)" : "none",
                  alignItems: "start",
                }} className="expect-row">
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.6rem", letterSpacing: "0.15em", color: "var(--color-accent-text)", textTransform: "uppercase", paddingTop: "0.25rem" }}>{item.num}</span>
                  <h3 className="display-serif" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", lineHeight: 1.3, margin: 0 }}>{item.title}</h3>
                  <p className="expect-desc" style={{ fontSize: "0.9rem", lineHeight: 1.8, color: "var(--color-muted)", fontWeight: 300, margin: 0 }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CALENDAR ═════════════════════════════════════════════ */}
      <section className="section-card section-card--paper" id="calendar" style={{ background: "var(--color-cream-2)", borderBottom: "1px solid var(--color-line)" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <Reveal>
            <div className="rule"><span className="label-mono">2026 Schedule</span></div>
            <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "1rem" }}>
              Find a seminar{" "}
              <span className="display-serif-italic text-gold">near you.</span>
            </h2>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.75, color: "var(--color-muted)", maxWidth: "520px", marginBottom: "2.5rem", fontWeight: 300 }}>
              Foundations Seminars are held at MetFix affiliate gyms worldwide. Each seminar is limited in size to ensure a hands-on, high-quality experience.
            </p>
          </Reveal>

          {/* Filter tabs */}
          <Reveal delay={80}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2.5rem", flexWrap: "wrap" }}>
              {(["all", "USA", "International"] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`sem-filter-btn${filter === f ? " is-active" : ""}`}
                >
                  {f === "all" ? "All Locations" : f}
                </button>
              ))}
            </div>
          </Reveal>

          {/* Seminar list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--color-line)" }}>
            {filtered.map((s, i) => (
              <Reveal key={s.id} delay={i * 50}>
                <div className="seminar-row" style={{
                  background: "var(--color-paper)",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: "2rem",
                  alignItems: "center",
                  padding: "1.75rem 2rem",
                  transition: "background 0.2s",
                }}>
                  {/* Date */}
                  <div className="seminar-date" style={{ minWidth: "140px", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <Calendar size={12} style={{ color: "var(--color-accent-text)", flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-serif)", fontWeight: 700, fontSize: "0.95rem", color: "var(--color-ink)" }}>{s.date}</span>
                    </div>
                    <div style={{
                      display: "inline-block",
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.5rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "0.2rem 0.5rem",
                      background: s.status === "open" ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "var(--color-line)",
                      color: s.status === "open" ? "var(--color-accent-text)" : "var(--color-muted)",
                      border: s.status === "open" ? "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)" : "1px solid var(--color-line)",
                    }}>
                      {s.status === "open" ? "Registration Open" : "Announced"}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="seminar-location">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <MapPin size={12} style={{ color: "var(--color-muted)", flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1rem", color: "var(--color-ink)" }}>{s.city}</span>
                    </div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-muted)", fontWeight: 300, paddingLeft: "1.25rem" }}>
                      @ {s.venue}
                    </div>
                  </div>

                  {/* CTA */}
                  <a
                    href={s.registerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline seminar-cta"
                    style={{ fontSize: "0.75rem", padding: "0.6rem 1.25rem", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    Register <ExternalLink size={11} />
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={100}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.58rem", letterSpacing: "0.1em", color: "var(--color-muted)", textTransform: "uppercase", marginTop: "1.5rem" }}>
              More dates announced throughout the year · Check back for updates
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ PREREQUISITES ════════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-paper)", borderBottom: "1px solid var(--color-line)" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "4rem", alignItems: "center" }}>
            <Reveal direction="left">
              <div>
                <div className="rule"><span className="label-mono">Before You Attend</span></div>
                <h2 className="display-serif" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", marginBottom: "1.25rem" }}>
                  Foundations is{" "}
                  <span className="display-serif-italic text-gold">a critical step in your education.</span>
                </h2>
                <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "var(--color-muted)", marginBottom: "2rem", fontWeight: 300 }}>
                  To get the most out of Foundations, we recommend completing the MetFix online curriculum first. The seminar is designed to apply and deepen what you've already learned, not to introduce it it for the first time.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: "2.5rem" }}>
                  {[
                    { step: "01", label: "What Is MetFix?", note: "Free, start here", href: "https://whatis.metfix.org/" },
                    { step: "02", label: "MetFix Essentials", note: "Core online curriculum", href: "/classes" },
                    { step: "03", label: "Specialty Track", note: "Choose your focus area", href: "/classes" },
                    { step: "04", label: "Daily Fix & Community", note: "Ongoing education", href: "/the-daily-fix" },
                    { step: "05", label: "Foundations Seminar", note: "You are here", href: "#calendar", active: true },
                    { step: "06", label: "Spark", note: "Implementation master guide", href: "/classes" },
                  ].map((item, i) => (
                    <a key={i} href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", gap: "1rem",
                        padding: "0.875rem 1rem",
                        background: item.active ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "var(--color-cream)",
                        border: item.active ? "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)" : "1px solid var(--color-line)",
                        textDecoration: "none",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = "var(--color-cream-2)"; }}
                      onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = "var(--color-cream)"; }}
                    >
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.6rem", letterSpacing: "0.1em", color: item.active ? "var(--color-accent-text)" : "var(--color-muted)", minWidth: "1.5rem" }}>{item.step}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.9rem", color: item.active ? "var(--color-ink)" : "var(--color-muted)" }}>{item.label}</div>
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--color-muted)", fontWeight: 300 }}>{item.note}</div>
                      </div>
                      {item.active && <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.55rem", letterSpacing: "0.1em", color: "var(--color-accent-text)", textTransform: "uppercase" }}>↓ Register</span>}
                    </a>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal direction="right" delay={100}>
              <div className="sem-panel" style={{ position: "relative", overflow: "hidden", minHeight: "400px", padding: "2rem", display: "flex", alignItems: "flex-end" }}>
                <div>
                  <blockquote style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1.1rem", color: "var(--color-ink)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                    "Foundations didn't just teach me. It changed how I think about every client I've ever worked with."
                  </blockquote>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.55rem", letterSpacing: "0.12em", color: "var(--color-accent-text)", textTransform: "uppercase" }}>MetFix Coach, Columbus, OH</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ HOST A SEMINAR ═══════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-cream-2)", borderBottom: "1px solid var(--color-line)" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "4rem", alignItems: "center" }}>
            <Reveal direction="left">
              <div>
                <div className="rule"><span className="label-mono">Host a Seminar</span></div>
                <h2 className="display-serif" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", marginBottom: "1.25rem" }}>
                  Bring Foundations{" "}
                  <span className="display-serif-italic text-gold">to your gym.</span>
                </h2>
                <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "var(--color-muted)", marginBottom: "2rem", fontWeight: 300 }}>
                  MetFix affiliate gyms can apply to host a Foundations Seminar. Hosting puts your facility on the global MetFix map, drives coach traffic to your gym, and positions you as a hub for metabolic health education in your community.
                </p>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.75, color: "var(--color-muted)", marginBottom: "2.5rem", fontWeight: 300 }}>
                  Hosting is available exclusively to MetFix affiliates. If you're not yet an affiliate, start there.
                </p>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <Link href="/become-an-affiliate" className="btn-primary">
                    See what you get as a MetFix affiliate <ArrowRight size={14} />
                  </Link>
                  <a href="mailto:courses@metfix.org" className="btn-outline">
                    Contact Us
                  </a>
                </div>
              </div>
            </Reveal>
            <Reveal direction="right" delay={100}>
              <div>
              <div style={{ padding: "2rem", border: "1px solid var(--color-line)", background: "var(--color-paper)" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.6rem", letterSpacing: "0.15em", color: "var(--color-accent-text)", textTransform: "uppercase", marginBottom: "1.5rem" }}>Host Benefits</div>
                {[
                  "Listed on the global MetFix seminar calendar",
                  "Coaches travel to your facility from your region",
                  "Positioned as a metabolic health education hub",
                  "MetFix instructor support and curriculum materials",
                  "Revenue share online classes sold through your affiliate link",
                  "Find 10 participants and we will come to you",
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.875rem" }}>
                    <span style={{ color: "var(--color-accent-text)", flexShrink: 0, marginTop: "0.1rem", fontSize: "0.8rem" }}>✓</span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--color-muted)", lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
      {/* ═══ BOTTOM CTA ═══════════════════════════════════════════ */}
      <section className="section-card section-card--paper" style={{ background: "var(--color-cream)" }}>
        <div className="container" style={{ paddingTop: "6rem", paddingBottom: "6rem", textAlign: "center" }}>
          <Reveal>
            <div className="rule" style={{ justifyContent: "center" }}><span className="label-mono">Ready to Attend?</span></div>
            <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", marginBottom: "1rem" }}>
              Start with the{" "}
              <span className="display-serif-italic text-gold">free class.</span>
            </h2>
            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "var(--color-muted)", maxWidth: "480px", margin: "0 auto 2.5rem", fontWeight: 300 }}>
              Every Foundations attendee starts with What Is MetFix? The free foundational course that sets the stage for everything that follows.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <a href="https://whatis.metfix.org/" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ padding: "1rem 2.5rem" }}>
                Take the Free Class <ArrowRight size={15} />
              </a>
              <a href="#calendar" className="btn-outline" style={{ padding: "1rem 2rem" }}>
                View 2026 Dates
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ STICKY MOBILE CTA BAR ══════════════════════════════ */}
      <div
        className="sem-sticky-cta"
        style={{
          display: isDesktop ? "none" : "flex",
        }}
      >
        <a href="https://brokenscience.org/metfix/foundations/" target="_blank" rel="noopener noreferrer"
          className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: "0.85rem" }}>
          Register for Foundations <ExternalLink size={13} />
        </a>
        <Link href="/become-an-affiliate" className="sem-sticky-link">
          Affiliate
        </Link>
      </div>

      {/* ═══ FOOTER (inline until F2 SiteFooter) ═══════════════════ */}
      <footer
        style={{
          background: "var(--color-cream-2)",
          borderTop: "1px solid var(--color-line)",
          paddingTop: "2.5rem",
          paddingBottom: "2rem",
        }}
        className="footer-mobile-pad"
      >
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.15em", color: "var(--color-ink)", textTransform: "uppercase" }}>MetFix</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.5rem", letterSpacing: "0.18em", color: "var(--color-accent-text)", textTransform: "uppercase" }}>The Metabolic Fix</div>
            </div>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <Link href="/" style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-muted)", textDecoration: "none" }}>← Home</Link>
              <Link href="/classes" style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-muted)", textDecoration: "none" }}>All Courses</Link>
              <Link href="/become-an-affiliate" style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-muted)", textDecoration: "none" }}>Become an Affiliate</Link>
            </div>
            <CopyrightText variant="compact" />
          </div>
        </div>
      </footer>
    </div>
  );
}
