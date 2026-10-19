/**
 * AffiliateSeminars.tsx - MetFix "Earned Authority" Design System
 * Real seminar data from brokenscience.org/metfix/foundations/
 */

import { ArrowRight, Calendar, MapPin, ExternalLink, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import CopyrightText from "@/components/CopyrightText";
import { usePageMeta } from "@/hooks/usePageMeta";

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
          style={{ borderBottom: i < SYLLABUS_MODULES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "1rem",
              padding: "0.85rem 0", background: "none", border: "none", cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ fontFamily: "'DM Mono'", fontSize: "0.55rem", color: "rgba(201,169,110,0.5)", letterSpacing: "0.1em", minWidth: "1.5rem", flexShrink: 0 }}>{mod.num}</span>
            <span style={{ fontFamily: "'DM Sans'", fontSize: "0.9rem", color: open === i ? "#C9A96E" : "rgba(239,239,239,0.8)", lineHeight: 1.4, flex: 1, transition: "color 0.2s" }}>{mod.title}</span>
            <ChevronDown
              size={14}
              style={{
                color: "rgba(201,169,110,0.6)", flexShrink: 0,
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
              fontFamily: "'DM Sans'", fontSize: "0.85rem", lineHeight: 1.75,
              color: "rgba(239,239,239,0.5)", paddingBottom: "1rem",
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
    <div style={{ background: "#0A0A0A", color: "#EFEFEF", minHeight: "100vh", overflowX: "hidden", maxWidth: "100vw" }}>

      {/* ═══ NAV ══════════════════════════════════════════════════ */}

      {/* ═══ HERO ═════════════════════════════════════════════════ */}
      <section className="affiliate-seminars-hero" style={{
        background: "#0A0A0A",
        paddingTop: "9rem",
        paddingBottom: "5rem",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Seminar photo background */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('/manus-storage/seminar-photo_03aede9d.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center 40%",
          opacity: 0.22,
          pointerEvents: "none",
        }} />
        {/* Dark gradient overlay — stronger on left so text stays readable */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(to right, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.6) 55%, rgba(10,10,10,0.3) 100%)",
          pointerEvents: "none",
        }} />
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
                <p style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "rgba(239,239,239,0.6)", marginBottom: "2rem", fontWeight: 300, maxWidth: "520px" }}>
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
              <div style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#0D0D0D", padding: "2.5rem" }}>
                <div style={{ fontFamily: "'DM Mono'", fontSize: "0.6rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "1.5rem" }}>Syllabus — 2 Powerful Days of Learning</div>
                <SyllabusAccordion />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ LECTURE VIDEO ══════════════════════════════════════ */}
      <section style={{ background: "#050505", borderBottom: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <Reveal>
            <div className="rule" style={{ marginBottom: "1.5rem" }}>
              <span className="label-mono">Inside the Seminar</span>
            </div>
            <h2 className="display-serif" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", marginBottom: "0.75rem", lineHeight: 1.1 }}>
              Watch a live{" "}
              <span className="display-serif-italic text-gold">lecture.</span>
            </h2>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.75, color: "rgba(239,239,239,0.45)", maxWidth: "520px", marginBottom: "3rem", fontWeight: 300 }}>
              This is the real thing — a full lecture from an actual Foundations Seminar. Get a feel for the depth, the science, and the teaching style before you register.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
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
      <section style={{ background: "#050505", borderBottom: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <Reveal>
            <div className="rule" style={{ marginBottom: "1.5rem" }}>
              <span className="label-mono">What Past Attendees Are Saying</span>
            </div>
            <h2 className="display-serif" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", marginBottom: "0.75rem", lineHeight: 1.1 }}>
              From coaches to{" "}
              <span className="display-serif-italic text-gold">physicians worldwide.</span>
            </h2>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.75, color: "rgba(239,239,239,0.45)", maxWidth: "520px", marginBottom: "3.5rem", fontWeight: 300 }}>
              Foundations is making a measurable difference. Here is what participants have to say.
            </p>
          </Reveal>

          {/* Featured large video — first testimonial */}
          {(() => {
            const featured = { id: "XH_cwT9dMcM", name: "Theresa Sbarra", gym: "MetFix Victor, NY", quote: "It was really cool to understand the mechanisms and biomechanical processes behind why science doesn't make you healthy." };
            return (
              <Reveal>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", marginBottom: "1.5rem", border: "1px solid rgba(255,255,255,0.08)", background: "#0D0D0D", overflow: "hidden" }}>
                  <div style={{ position: "relative", paddingBottom: "50%", height: 0, overflow: "hidden" }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${featured.id}?rel=0&modestbranding=1&color=white`}
                      title={featured.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    />
                  </div>
                  <div className="featured-caption" style={{ padding: "2rem 2.5rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "'Playfair Display'", fontStyle: "italic", fontSize: "1.05rem", color: "rgba(239,239,239,0.85)", lineHeight: 1.65, flex: 1, minWidth: "200px", margin: 0 }}>
                      &ldquo;{featured.quote}&rdquo;
                    </p>
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: "0.65rem", letterSpacing: "0.12em", color: "#C9A96E", textTransform: "uppercase" }}>{featured.name}</div>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: "0.55rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.3)", textTransform: "uppercase", marginTop: "0.3rem" }}>{featured.gym}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })()}

          {/* Three smaller videos below */}
          <div className="video-testimonials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
            {[
              { id: "BKJR8l5sZ0s", name: "Jen Crichton, MD", gym: "Petra Health MetFix, Canada", quote: "As a physician, there is no better feeling than leading someone back to their best metabolic health." },
              { id: "jq-gVWs3ZSs", name: "Liang Kong", gym: "CrossFit Kongfusion, China", quote: "We're only on the first day, but it already broke my mind." },
              { id: "tQH39Lt3Fb8", name: "MetFix Attendee", gym: "Foundations Seminar", quote: "Two days that change how you coach, train, and think about health." },
            ].map((v, i) => (
              <Reveal key={i} delay={i * 80}>
                <div style={{ background: "#0D0D0D", display: "flex", flexDirection: "column" }}>
                  <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", flexShrink: 0 }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${v.id}?rel=0&modestbranding=1&color=white`}
                      title={v.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    />
                  </div>
                  <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.06)", flex: 1 }}>
                    <p style={{ fontFamily: "'Playfair Display'", fontStyle: "italic", fontSize: "0.875rem", color: "rgba(239,239,239,0.75)", lineHeight: 1.6, marginBottom: "0.875rem" }}>
                      &ldquo;{v.quote}&rdquo;
                    </p>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: "0.6rem", letterSpacing: "0.12em", color: "#C9A96E", textTransform: "uppercase" }}>{v.name}</div>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: "0.55rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.3)", textTransform: "uppercase", marginTop: "0.25rem" }}>{v.gym}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      {/* ═══ WHAT TO EXPECT ═══════════════════════════════════════ */}
      <section style={{ background: "#0D0D0D", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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
                  borderBottom: i < WHAT_TO_EXPECT.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  alignItems: "start",
                }} className="expect-row">
                  <span style={{ fontFamily: "'DM Mono'", fontSize: "0.6rem", letterSpacing: "0.15em", color: "rgba(201,169,110,0.5)", textTransform: "uppercase", paddingTop: "0.25rem" }}>{item.num}</span>
                  <h3 className="display-serif" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", lineHeight: 1.3, margin: 0 }}>{item.title}</h3>
                  <p className="expect-desc" style={{ fontSize: "0.9rem", lineHeight: 1.8, color: "rgba(239,239,239,0.5)", fontWeight: 300, margin: 0 }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CALENDAR ═════════════════════════════════════════════ */}
      <section id="calendar" style={{ background: "#080808", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <Reveal>
            <div className="rule"><span className="label-mono">2026 Schedule</span></div>
            <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "1rem" }}>
              Find a seminar{" "}
              <span className="display-serif-italic text-gold">near you.</span>
            </h2>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.75, color: "rgba(239,239,239,0.45)", maxWidth: "520px", marginBottom: "2.5rem", fontWeight: 300 }}>
              Foundations Seminars are held at MetFix affiliate gyms worldwide. Each seminar is limited in size to ensure a hands-on, high-quality experience.
            </p>
          </Reveal>

          {/* Filter tabs */}
          <Reveal delay={80}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2.5rem", flexWrap: "wrap" }}>
              {(["all", "USA", "International"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    fontFamily: "'DM Mono'",
                    fontSize: "0.6rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    padding: "0.5rem 1.25rem",
                    border: filter === f ? "1px solid #C9A96E" : "1px solid rgba(255,255,255,0.12)",
                    background: filter === f ? "rgba(201,169,110,0.1)" : "transparent",
                    color: filter === f ? "#C9A96E" : "rgba(239,239,239,0.4)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {f === "all" ? "All Locations" : f}
                </button>
              ))}
            </div>
          </Reveal>

          {/* Seminar list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
            {filtered.map((s, i) => (
              <Reveal key={s.id} delay={i * 50}>
                <div className="seminar-row" style={{
                  background: "#080808",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: "2rem",
                  alignItems: "center",
                  padding: "1.75rem 2rem",
                  transition: "background 0.2s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0D0D0D")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#080808")}
                >
                  {/* Date */}
                  <div className="seminar-date" style={{ minWidth: "140px", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <Calendar size={12} style={{ color: "#C9A96E", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "0.95rem", color: "#EFEFEF" }}>{s.date}</span>
                    </div>
                    <div style={{
                      display: "inline-block",
                      fontFamily: "'DM Mono'",
                      fontSize: "0.5rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "0.2rem 0.5rem",
                      background: s.status === "open" ? "rgba(201,169,110,0.1)" : "rgba(255,255,255,0.05)",
                      color: s.status === "open" ? "#C9A96E" : "rgba(239,239,239,0.3)",
                      border: s.status === "open" ? "1px solid rgba(201,169,110,0.25)" : "1px solid rgba(255,255,255,0.08)",
                    }}>
                      {s.status === "open" ? "Registration Open" : "Announced"}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="seminar-location">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <MapPin size={12} style={{ color: "rgba(239,239,239,0.3)", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: "1rem", color: "#EFEFEF" }}>{s.city}</span>
                    </div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: "0.8rem", color: "rgba(239,239,239,0.4)", fontWeight: 300, paddingLeft: "1.25rem" }}>
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
            <p style={{ fontFamily: "'DM Mono'", fontSize: "0.58rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.2)", textTransform: "uppercase", marginTop: "1.5rem" }}>
              More dates announced throughout the year · Check back for updates
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ PREREQUISITES ════════════════════════════════════════ */}
      <section style={{ background: "#0D0D0D", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "4rem", alignItems: "center" }}>
            <Reveal direction="left">
              <div>
                <div className="rule"><span className="label-mono">Before You Attend</span></div>
                <h2 className="display-serif" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", marginBottom: "1.25rem" }}>
                  Foundations is{" "}
                  <span className="display-serif-italic text-gold">a critical step in your education.</span>
                </h2>
                <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(239,239,239,0.6)", marginBottom: "2rem", fontWeight: 300 }}>
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
                        background: item.active ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)",
                        border: item.active ? "1px solid rgba(201,169,110,0.25)" : "1px solid rgba(255,255,255,0.05)",
                        textDecoration: "none",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                    >
                      <span style={{ fontFamily: "'DM Mono'", fontSize: "0.6rem", letterSpacing: "0.1em", color: item.active ? "#C9A96E" : "rgba(239,239,239,0.3)", minWidth: "1.5rem" }}>{item.step}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: "0.9rem", color: item.active ? "#EFEFEF" : "rgba(239,239,239,0.7)" }}>{item.label}</div>
                        <div style={{ fontFamily: "'DM Sans'", fontSize: "0.75rem", color: "rgba(239,239,239,0.3)", fontWeight: 300 }}>{item.note}</div>
                      </div>
                      {item.active && <span style={{ fontFamily: "'DM Mono'", fontSize: "0.55rem", letterSpacing: "0.1em", color: "#C9A96E", textTransform: "uppercase" }}>↓ Register</span>}
                    </a>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal direction="right" delay={100}>
              <div style={{ position: "relative", overflow: "hidden", minHeight: "400px" }}>
                <img
                  src="/manus-storage/seminar-group-photo_92821568.jpeg"
                  alt="Foundations Seminar attendees"
                  style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,10,0.8) 0%, rgba(10,10,10,0.2) 60%)" }} />
                <div style={{ position: "absolute", bottom: "2rem", left: "2rem", right: "2rem" }}>
                  <blockquote style={{ fontFamily: "'Playfair Display'", fontStyle: "italic", fontSize: "1.1rem", color: "#EFEFEF", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                    "Foundations didn't just teach me. It changed how I think about every client I've ever worked with."
                  </blockquote>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: "0.55rem", letterSpacing: "0.12em", color: "#C9A96E", textTransform: "uppercase" }}>MetFix Coach, Columbus, OH</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ HOST A SEMINAR ═══════════════════════════════════════ */}
      <section style={{ background: "#080808", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "4rem", alignItems: "center" }}>
            <Reveal direction="left">
              <div>
                <div className="rule"><span className="label-mono">Host a Seminar</span></div>
                <h2 className="display-serif" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", marginBottom: "1.25rem" }}>
                  Bring Foundations{" "}
                  <span className="display-serif-italic text-gold">to your gym.</span>
                </h2>
                <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(239,239,239,0.6)", marginBottom: "2rem", fontWeight: 300 }}>
                  MetFix affiliate gyms can apply to host a Foundations Seminar. Hosting puts your facility on the global MetFix map, drives coach traffic to your gym, and positions you as a hub for metabolic health education in your community.
                </p>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.75, color: "rgba(239,239,239,0.4)", marginBottom: "2.5rem", fontWeight: 300 }}>
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
                {/* Classroom photo */}
                <div style={{ position: "relative", overflow: "hidden", marginBottom: "2rem", borderRadius: "2px" }}>
                  <img
                    src="/manus-storage/seminar-classroom2_0adda9c4.jpeg"
                    alt="MetFix Foundations Seminar classroom"
                    style={{ width: "100%", height: "320px", objectFit: "cover", objectPosition: "center 30%", display: "block" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,10,0.5) 0%, transparent 60%)" }} />
                </div>
              <div style={{ padding: "2rem", border: "1px solid rgba(255,255,255,0.08)", background: "#0D0D0D" }}>
                <div style={{ fontFamily: "'DM Mono'", fontSize: "0.6rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "1.5rem" }}>Host Benefits</div>
                {[
                  "Listed on the global MetFix seminar calendar",
                  "Coaches travel to your facility from your region",
                  "Positioned as a metabolic health education hub",
                  "MetFix instructor support and curriculum materials",
                  "Revenue share online classes sold through your affiliate link",
                  "Find 10 participants and we will come to you",
                ].map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.875rem" }}>
                    <span style={{ color: "#C9A96E", flexShrink: 0, marginTop: "0.1rem", fontSize: "0.8rem" }}>✓</span>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: "0.875rem", color: "rgba(239,239,239,0.65)", lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
      {/* ═══ BOTTOM CTA ═══════════════════════════════════════════ */}
      <section style={{ background: "#0A0A0A" }}>
        <div className="container" style={{ paddingTop: "6rem", paddingBottom: "6rem", textAlign: "center" }}>
          <Reveal>
            <div className="rule" style={{ justifyContent: "center" }}><span className="label-mono">Ready to Attend?</span></div>
            <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", marginBottom: "1rem" }}>
              Start with the{" "}
              <span className="display-serif-italic text-gold">free class.</span>
            </h2>
            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(239,239,239,0.5)", maxWidth: "480px", margin: "0 auto 2.5rem", fontWeight: 300 }}>
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
      <div style={{
        display: isDesktop ? "none" : "flex",
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        background: "rgba(10,10,10,0.97)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "0.875rem 1.5rem",
        paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom))",
        gap: "0.75rem", alignItems: "center",
      }}>
        <a href="https://brokenscience.org/metfix/foundations/" target="_blank" rel="noopener noreferrer"
          className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: "0.85rem" }}>
          Register for Foundations <ExternalLink size={13} />
        </a>
        <Link href="/become-an-affiliate"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.625rem 1rem", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(239,239,239,0.7)", textDecoration: "none", fontFamily: "'DM Mono'", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          Affiliate
        </Link>
      </div>

      {/* ═══ FOOTER ═══════════════════════════════════════════════ */}
      <footer style={{ background: "#080808", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "2.5rem", paddingBottom: "2rem" }} className="footer-mobile-pad">
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontFamily: "'DM Sans'", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.15em", color: "#EFEFEF", textTransform: "uppercase" }}>MetFix</div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: "0.5rem", letterSpacing: "0.18em", color: "#C9A96E", textTransform: "uppercase" }}>The Metabolic Fix</div>
            </div>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <Link href="/" style={{ fontFamily: "'DM Sans'", fontSize: "0.8rem", color: "rgba(239,239,239,0.4)", textDecoration: "none" }}>← Home</Link>
              <Link href="/classes" style={{ fontFamily: "'DM Sans'", fontSize: "0.8rem", color: "rgba(239,239,239,0.4)", textDecoration: "none" }}>All Courses</Link>
              <Link href="/become-an-affiliate" style={{ fontFamily: "'DM Sans'", fontSize: "0.8rem", color: "rgba(239,239,239,0.4)", textDecoration: "none" }}>Become an Affiliate</Link>
            </div>
            <CopyrightText variant="compact" />
          </div>
        </div>
      </footer>
      <style>{`
        /* ── Mobile ≤ 767px ─────────────────────────────────── */
        @media (max-width: 767px) {
          /* Hero */
          .affiliate-seminars-hero { padding-top: 6rem !important; padding-bottom: 3rem !important; }

          /* Video testimonials: 3-col → 1-col */
          .video-testimonials-grid { grid-template-columns: 1fr !important; }

          /* What to Expect rows: 3-col → 2-col (num + title), hide description */
          .expect-row { grid-template-columns: 2.5rem 1fr !important; gap: 1rem !important; padding: 1.25rem 0 !important; }
          .expect-row .expect-desc { display: none !important; }

          /* Seminar rows: 3-col → stacked 2-row */
          .seminar-row {
            grid-template-columns: 1fr auto !important;
            grid-template-rows: auto auto !important;
            gap: 0.75rem 1rem !important;
            padding: 1.25rem 1rem !important;
          }
          .seminar-date { grid-column: 1 / 2; grid-row: 1; min-width: 0 !important; }
          .seminar-location { grid-column: 1 / 2; grid-row: 2; }
          .seminar-cta { grid-column: 2 / 3; grid-row: 1 / 3; align-self: center; }

          /* Stats grid */
          .seminar-stats-grid { grid-template-columns: 1fr 1fr !important; }

          /* Featured video caption: stack vertically */
          .featured-caption { flex-direction: column !important; gap: 0.75rem !important; padding: 1.25rem !important; }
        }

        /* ── Small phones ≤ 480px ───────────────────────────── */
        @media (max-width: 480px) {
          .seminar-cta { font-size: 0.7rem !important; padding: 0.5rem 0.875rem !important; }
          .expect-row { padding: 1rem 0 !important; }
        }
      `}</style>
    </div>
  );
}
