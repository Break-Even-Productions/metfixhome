/**
 * MetFix Homepage — Strategic Funnel Rebuild
 * Funnel: Hero → Affiliate Outcomes → Free Class → Courses + Affiliation
 *         → Foundations → Emily Story → Resource Library → The Gap
 *         → Testimonials → Newsletter → FAQ → Footer
 *
 * RULES: No em-dashes. No inflated stats. No Daily Fix repetition.
 * Colors: #0A0A0A bg | #C9A96E gold | #EFEFEF text
 * Fonts: Playfair Display (display) · DM Sans (body) · DM Mono (labels)
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  ArrowRight,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { assetUrl, basePath, HOME_SCROLL_KEY, scrollToHomeSection } from "@/const";
import CopyrightText from "@/components/CopyrightText";
import { CmsLink } from "@/components/CmsLink";
import { HighlightedHeadlineText } from "@/lib/highlightedText";
import { useHomeContent } from "@/hooks/useSanityContent";
import { usePageMeta } from "@/hooks/usePageMeta";
import type { HomeTestimonial } from "@/lib/homeTypes";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";

// ─── Responsive hook ───────────────────────────────────────────
function useIsDesktop(breakpoint = 900) {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= breakpoint : true);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isDesktop;
}

// ─── Hero Image ────────────────────────────────────────────────
const HERO_IMG = assetUrl("/hero.png");

const COURSE_HERO_IMG = assetUrl("/what-is-metfix-course-hero.png");
const AFFILIATION_BG_IMG = assetUrl("/affiliation-bg.png");
const METFIX_MAP_URL = "https://brokenscience.org/metfix/metfix-map/";
const MAILCHIMP_NEWSLETTER_ACTION =
  "https://brokenscience.us13.list-manage.com/subscribe/post?u=473a65a0067d6101d3a6277c8&id=abdc550935&f_id=001a53eaf0";

// ─── Affiliate Outcome Stories ────────────────────────────────
const AFFILIATE_STORIES = [
  {
    headline: "A client left the doctor's office with their best blood work in years.",
    coach: "Rose City MetFix",
    location: "",
    tag: "Metabolic Reversal",
  },
  {
    headline: "250 pounds gone from two clients in under a year.",
    coach: "Dusty",
    location: "MetFix Affiliate",
    tag: "Body Composition",
    note: "* figures being confirmed",
  },
  {
    headline: "Classes filling with women navigating menopause through strength, not surrender.",
    coach: "Krish",
    location: "MetFix Affiliate",
    tag: "Women's Health",
  },
  {
    headline: "An entire school district. Health class. PE. Science. Two after-school clubs.",
    coach: "John N.",
    location: "MetFix Affiliate",
    tag: "Youth Education",
  },
  {
    headline: "Police departments cutting workers comp costs and early retirement by implementing MetFix.",
    coach: "Multiple Departments",
    location: "Law Enforcement",
    tag: "First Responders",
  },
  {
    headline: "Firehouses rebuilding community through family-style meals and shared suffering in workouts.",
    coach: "Fire Departments",
    location: "MetFix Affiliate",
    tag: "Fire Service",
  },
  {
    headline: "An ER doctor who affiliated because MetFix is the prescription he had been missing.",
    coach: "Dr. Luke Palmisano",
    location: "MetFix Affiliate",
    tag: "Medical",
  },
  {
    headline: "A nursing home. Live streams. Workouts. Meal planning. Together.",
    coach: "Albert Lu",
    location: "MetFix Affiliate",
    tag: "Senior Health",
  },
];

// ─── Intersection Observer Hook ────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── Counter Hook ──────────────────────────────────────────────
function useCounter(target: number, duration: number, start: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

// ─── Reveal Component ──────────────────────────────────────────
function Reveal({ children, className = "", delay = 0, direction = "up" }: {
  children: React.ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right";
}) {
  const { ref, visible } = useInView();
  const cls = direction === "left" ? "reveal-left" : direction === "right" ? "reveal-right" : "reveal";
  return (
    <div ref={ref} className={`${cls} ${visible ? "visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Animated Stat ─────────────────────────────────────────────
function AnimatedStat({ value, suffix, label, delay = 0 }: {
  value: number; suffix: string; label: string; delay?: number;
}) {
  const { ref, visible } = useInView(0.3);
  const count = useCounter(value, 1800, visible);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(2rem)",
      transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
    }}>
      <div style={{
        fontFamily: "'Playfair Display'",
        fontWeight: 700,
        fontSize: "clamp(3.5rem, 7vw, 6rem)",
        color: "#C9A96E",
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}>
        {count}{suffix}
      </div>
      <div style={{
        fontFamily: "'DM Mono'",
        fontSize: "0.75rem",
        letterSpacing: "0.18em",
        color: "rgba(239,239,239,0.75)",
        textTransform: "uppercase",
        marginTop: "0.7rem",
      }}>{label}</div>
    </div>
  );
}

// ─── Search Overlay ────────────────────────────────────────────

// ─── Side Rail ─────────────────────────────────────────────────
function SideRail({ visible }: { visible: boolean }) {
  return (
    <div className="hidden lg:flex" style={{
      position: "fixed", left: "1.5rem", top: "50%", transform: "translateY(-50%)",
      flexDirection: "column", gap: "1.25rem", zIndex: 50,
      opacity: visible ? 1 : 0, transition: "opacity 0.4s ease",
      pointerEvents: visible ? "auto" : "none",
    }}>
      {[
        { id: "outcomes", label: "Outcomes" },
        { id: "classes", label: "Classes" },
        { id: "affiliation", label: "Affiliate" },
        { id: "library", label: "Library" },
        { id: "about", label: "About" },
      ].map(({ id, label }) => (
        <a key={id} href={`#${id}`} style={{ display: "flex", alignItems: "center", gap: "0.7rem", textDecoration: "none", opacity: 0.35, transition: "opacity 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0.35")}>
          <div style={{ width: "1.5rem", height: "1px", background: "#C9A96E" }} />
          <span style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.18em", color: "#fdf6f6", textTransform: "uppercase" }}>{label}</span>
        </a>
      ))}
    </div>
  );
}

// ─── Testimonial Carousel ──────────────────────────────────────
function TestimonialCarousel({
  items,
  eyebrow,
}: {
  items: HomeTestimonial[];
  eyebrow: string;
}) {
  const [active, setActive] = useState(0);
  const total = items.length || 1;
  const go = (i: number) => setActive((i + total) % total);
  const t = items[active] || items[0];
  if (!t) return null;
  return (
    <section id="testimonials" style={{ background: "#080808", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6rem 0" }}>
      <div className="container">
        <div className="rule" style={{ marginBottom: "3rem" }}>
          <span className="label-mono">{eyebrow}</span>
        </div>
        <div className="testimonial-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3rem", alignItems: "center", minWidth: 0 }}>
          <div>
            <blockquote style={{
              fontFamily: "'Playfair Display'",
              fontStyle: "italic",
              fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
              color: "#fdf6f6",
              lineHeight: 1.5,
              margin: 0,
              marginBottom: "2rem",
            }}>
              "{t.quote}"
            </blockquote>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {t.photoUrl ? (
                <img
                  src={t.photoUrl}
                  alt={t.name}
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    objectFit: "cover",
                    border: "1px solid rgba(201,169,110,0.3)",
                  }}
                />
              ) : (
                <div style={{
                  width: "2.5rem", height: "2.5rem",
                  background: "rgba(201,169,110,0.15)",
                  border: "1px solid rgba(201,169,110,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "1rem", color: "#C9A96E",
                }}>
                  {t.name[0]}
                </div>
              )}
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: "0.95rem", color: "#fdf6f6" }}>{t.name}</div>
                <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.82)", textTransform: "uppercase", marginTop: "0.2rem" }}>{t.gym ? `${t.role} · ${t.gym}` : t.role}</div>
              </div>
            </div>
          </div>
          <div className="testimonial-controls" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
            <button onClick={() => go(active - 1)}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(239,239,239,0.8)", width: "2.5rem", height: "2.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.2s, color 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A96E"; (e.currentTarget as HTMLButtonElement).style.color = "#C9A96E"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,239,239,0.5)"; }}
              aria-label="Previous testimonial">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L1 6l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.25)", textTransform: "uppercase" }}>{active + 1}/{total}</div>
            <button onClick={() => go(active + 1)}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(239,239,239,0.8)", width: "2.5rem", height: "2.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.2s, color 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A96E"; (e.currentTarget as HTMLButtonElement).style.color = "#C9A96E"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,239,239,0.5)"; }}
              aria-label="Next testimonial">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.7rem", marginTop: "2.5rem" }}>
          {items.map((_, i) => (
            <button key={i} onClick={() => go(i)}
              style={{ width: i === active ? "2rem" : "0.7rem", height: "2px", background: i === active ? "#C9A96E" : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", transition: "width 0.3s ease, background 0.3s ease", padding: 0 }}
              aria-label={`Go to testimonial ${i + 1}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Outcomes Carousel ───────────────────────────────────────
function FoundationsVideoCarousel({
  videos,
  label,
}: {
  videos: string[];
  label: string;
}) {
  const [active, setActive] = useState(0);
  const total = videos.length || 1;
  const prev = () => setActive(i => (i - 1 + total) % total);
  const next = () => setActive(i => (i + 1) % total);
  if (!videos.length) return null;
  return (
    <div>
      <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "rgba(239,239,239,0.35)" }}>{active + 1} / {total}</span>
      </div>
      {/* Main video */}
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", background: "#111", borderRadius: "2px", marginBottom: "1rem" }}>
        <iframe
          key={active}
          src={videos[active]}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={`Foundations testimonial ${active + 1}`}
        />
      </div>
      {/* Controls + dot indicators */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={prev} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "#fdf6f6", width: "2.25rem", height: "2.25rem", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#C9A96E")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}>
          &#8592;
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {videos.map((_, i) => (
            <button key={i} onClick={() => setActive(i)} style={{ width: i === active ? "1.5rem" : "0.4rem", height: "0.4rem", borderRadius: "9999px", background: i === active ? "#C9A96E" : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
          ))}
        </div>
        <button onClick={next} style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", color: "#fdf6f6", width: "2.25rem", height: "2.25rem", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#C9A96E")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}>
          &#8594;
        </button>
      </div>
    </div>
  );
}

function OutcomesCarousel() {
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const total = AFFILIATE_STORIES.length;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (i: number) => {
    setFading(true);
    setTimeout(() => {
      setActive((i + total) % total);
      setFading(false);
    }, 300);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActive(prev => (prev + 1) % total);
        setFading(false);
      }, 300);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [total]);

  const story = AFFILIATE_STORIES[active];

  return (
    <section id="outcomes" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "5rem 0" }}>
      <div className="container">
        <Reveal>
          <div className="rule" style={{ marginBottom: "1.5rem" }}>
            <span className="label-mono">What MetFix Coaches Are Doing</span>
          </div>
          <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", marginBottom: "1rem", maxWidth: "640px" }}>
            This is what happens when coaches<br />
            <span className="display-serif-italic text-gold">understand metabolic health.</span>
          </h2>
          <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(239,239,239,0.82)", maxWidth: "520px", marginBottom: "3rem" }}>
            These are outcomes happening right now, in MetFix affiliate gyms around the world.
          </p>
        </Reveal>

        {/* Carousel */}
        <div style={{ position: "relative" }}>
          <div style={{
            opacity: fading ? 0 : 1,
            transition: "opacity 0.3s ease",
            borderLeft: "3px solid #C9A96E",
            paddingLeft: "2rem",
            minHeight: "8rem",
          }}>
            <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "1rem" }}>
              {story.tag}
            </div>
            <p style={{
              fontFamily: "'Playfair Display'",
              fontSize: "clamp(1.2rem, 2.2vw, 1.6rem)",
              lineHeight: 1.45,
              color: "#fdf6f6",
              margin: 0,
              marginBottom: "1.25rem",
              maxWidth: "720px",
            }}>
              {story.headline}
            </p>
            <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.82)", textTransform: "uppercase" }}>
              {story.location ? <>{story.coach} &middot; {story.location}</> : story.coach}
              {story.note && <span style={{ color: "rgba(239,239,239,0.75)", marginLeft: "0.7rem" }}>{story.note}</span>}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginTop: "2.5rem" }}>
            <button onClick={() => go(active - 1)}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(239,239,239,0.8)", width: "2.5rem", height: "2.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.2s, color 0.2s", flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A96E"; (e.currentTarget as HTMLButtonElement).style.color = "#C9A96E"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,239,239,0.5)"; }}
              aria-label="Previous outcome">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L1 6l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {AFFILIATE_STORIES.map((_, i) => (
                <button key={i} onClick={() => go(i)}
                  style={{ width: i === active ? "1.75rem" : "0.5rem", height: "2px", background: i === active ? "#C9A96E" : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", transition: "width 0.3s ease, background 0.3s ease", padding: 0 }}
                  aria-label={`Go to outcome ${i + 1}`} />
              ))}
            </div>
            <button onClick={() => go(active + 1)}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(239,239,239,0.8)", width: "2.5rem", height: "2.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.2s, color 0.2s", flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A96E"; (e.currentTarget as HTMLButtonElement).style.color = "#C9A96E"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,239,239,0.5)"; }}
              aria-label="Next outcome">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.7)", textTransform: "uppercase", marginLeft: "auto" }}>
              {active + 1} / {total}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
// ─── Main Component ────────────────────────────────────────────
export default function Home() {
  usePageMeta({
    title: "MetFix — Metabolic Health Affiliation for Gyms & Coaches",
    description:
      "MetFix is the metabolic health affiliation for gyms and coaches. Train with science that works, grow your practice, and join 130+ affiliate gyms fighting chronic disease.",
  });
  const isDesktop = useIsDesktop(900);
  const { home, homeCourses, testimonials, faqs } = useHomeContent();
  const heroRef = useRef<HTMLElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [railVisible, setRailVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { setHeroVisible(entry.isIntersecting); setRailVisible(!entry.isIntersecting); },
      { threshold: 0.1 }
    );
    if (heroRef.current) obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const pending = sessionStorage.getItem(HOME_SCROLL_KEY);
    if (pending) {
      sessionStorage.removeItem(HOME_SCROLL_KEY);
      requestAnimationFrame(() => scrollToHomeSection(pending));
      return;
    }
    if (window.location.hash === "#about") {
      requestAnimationFrame(() => scrollToHomeSection("about"));
    }
  }, []);



  return (
    <div style={{ background: "#0A0A0A", color: "#fdf6f6", minHeight: "100vh", overflowX: "hidden", maxWidth: "100vw" }}>

      {/* ═══ HERO ══════════════════════════════════════════════ */}
      <section ref={heroRef} className="hero-section" style={{ position: "relative", display: "flex", alignItems: "flex-end", overflow: "hidden", minHeight: "85vh" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={HERO_IMG} alt="" loading="eager" fetchPriority="high" decoding="sync" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.88) 50%, rgba(10,10,10,0.4) 100%)" }} />
        </div>
        <div className="container hero-container" style={{ position: "relative", zIndex: 1, paddingTop: "10rem", paddingBottom: "6rem" }}>
          <div style={{ maxWidth: "720px" }}>
            <div className="rule" style={{ marginBottom: "2rem" }}>
              <span className="label-mono">{home.hero.eyebrow}</span>
            </div>
            <h1 className="display-serif" style={{ fontSize: "clamp(2.2rem, 6vw, 5.5rem)", marginBottom: "1.5rem", lineHeight: 1.05 }}>
              <HighlightedHeadlineText headline={home.hero.headline} />
            </h1>
            <p style={{ fontSize: "clamp(1rem, 1.4vw, 1.15rem)", lineHeight: 1.8, color: "rgba(239,239,239,0.65)", maxWidth: "560px", marginBottom: "1rem", fontWeight: 300 }}>
              {home.hero.subtext}
            </p>
            <p style={{ fontSize: "clamp(0.85rem, 1.1vw, 0.95rem)", lineHeight: 1.6, color: "rgba(201,169,110,0.7)", maxWidth: "480px", marginBottom: "3rem", fontFamily: "'DM Mono'", letterSpacing: "0.05em" }}>
              {home.hero.statText}
            </p>
            <div className="hero-cta-stack" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
              <CmsLink cta={home.hero.primaryCta} className="btn-primary">
                {home.hero.primaryCta.label} <ArrowRight size={15} />
              </CmsLink>
              <CmsLink cta={home.hero.secondaryCta} className="btn-outline" />
            </div>
            {home.hero.tertiaryLink && (
              <CmsLink
                cta={home.hero.tertiaryLink}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.75)", textDecoration: "none", textTransform: "uppercase", transition: "color 0.2s", borderBottom: "1px solid rgba(239,239,239,0.15)", paddingBottom: "0.15rem" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#C9A96E")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,239,239,0.45)")}
              >
                {home.hero.tertiaryLink.label} <ArrowRight size={11} />
              </CmsLink>
            )}
          </div>
        </div>

      </section>
      <SideRail visible={railVisible} />
      {/* ═══ CDC CHRONIC DISEASE + 130 GYMS IMPACT ═══════════════ */}
      <section id="impact" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>

        {/* ── FULL-BLEED INTRO STATEMENT ── */}
        <Reveal>
          <div style={{ padding: "5rem 0 4rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="container">
              <div className="rule" style={{ marginBottom: "1.5rem" }}>
                <span className="label-mono">{home.problem.eyebrow}</span>
              </div>
              <p style={{ fontFamily: "'Playfair Display'", fontStyle: "italic", fontSize: "clamp(1.4rem, 2.5vw, 2rem)", lineHeight: 1.55, color: "rgba(239,239,239,0.75)", maxWidth: "780px", marginBottom: "0.5rem", whiteSpace: "pre-line" }}>
                {home.problem.quote}
              </p>
              <p style={{ fontFamily: "'DM Mono'", fontSize: "0.68rem", letterSpacing: "0.12em", color: "rgba(201,169,110,0.6)", textTransform: "uppercase" }}>
                {home.problem.sourceText}<a href={home.problem.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(201,169,110,0.85)", textDecoration: "underline", textUnderlineOffset: "3px" }}>{home.problem.sourceLinkLabel}</a>)
              </p>
            </div>
          </div>
        </Reveal>

        {/* ── AGE BREAKDOWN: FULL-WIDTH HORIZONTAL BARS ── */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { age: "Ages 65+", pct: 90, detail: "More than 90% have at least one chronic condition" },
            { age: "Ages 35–64", pct: 75, detail: "More than 75% have at least one condition" },
            { age: "Ages 18–34", pct: 60, detail: "60% have at least one condition" },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 80}>
              <div className="age-breakdown-row" style={{
                display: "grid",
                gridTemplateColumns: "min(140px, 25vw) 1fr auto",
                alignItems: "center",
                gap: "2rem",
                padding: "2rem 0",
                margin: "0 auto",
                maxWidth: "calc(100% - 4rem)",
                width: "min(1200px, 100%)",
                marginLeft: "auto",
                marginRight: "auto",
                borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <div style={{ fontFamily: "'DM Mono'", fontSize: "0.72rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase" as const }}>{item.age}</div>
                <div className="age-bar" style={{ position: "relative", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", inset: "0 auto 0 0",
                    width: `${item.pct}%`,
                    background: `linear-gradient(90deg, #C9A96E ${100 - item.pct}%, rgba(201,169,110,0.35) 100%)`,
                    borderRadius: "3px",
                    animation: "barGrow 1.6s cubic-bezier(0.16,1,0.3,1) forwards",
                    animationDelay: `${i * 0.15 + 0.3}s`,
                    transform: "scaleX(0)",
                    transformOrigin: "left",
                  }} />
                </div>
                <div style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "clamp(1.8rem, 3vw, 2.5rem)", color: "#C9A96E", lineHeight: 1, minWidth: "80px", textAlign: "right" as const }}>{item.pct}%</div>
              </div>
              <div style={{
                fontFamily: "'DM Sans'", fontSize: "0.8rem", color: "rgba(239,239,239,0.4)", lineHeight: 1.5,
                maxWidth: "min(1200px, calc(100% - 4rem))", margin: "0 auto",
                paddingBottom: i < 2 ? "0" : "0",
                paddingLeft: "0",
                marginBottom: i < 2 ? "0" : "0",
              }}>{item.detail}</div>
            </Reveal>
          ))}
        </div>

        {/* ── THE RESPONSE: 130+ GYMS ── */}
        <div style={{ background: "rgba(201,169,110,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div className="container" style={{ paddingTop: "5rem", paddingBottom: "5rem" }}>
            <div style={{ alignItems: "center" }} className="grid-responsive response-grid">

              {/* Left: narrative */}
              <Reveal direction="left">
                <div className="rule" style={{ marginBottom: "1.5rem" }}>
                  <span className="label-mono">The Response</span>
                </div>
                <h2 className="display-serif" style={{ fontSize: "clamp(1.8rem, 4vw, 3.5rem)", lineHeight: 1.05, marginBottom: "1.5rem" }}>
                  <span className="display-serif-italic text-gold">130+ affiliate gyms</span><br />
                  in year one are<br />
                  preventing and<br />
                  reversing these.
                </h2>
                <p style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "rgba(239,239,239,0.6)", marginBottom: "2rem", maxWidth: "420px" }}>
                  One community at a time, MetFix is leading by example, showing what's possible when coaches understand the science.
                </p>
                <Link href="/become-an-affiliate" className="btn-primary">
                  Join the Movement <ArrowRight size={15} />
                </Link>
              </Reveal>

              {/* Right: animated counter + mini stats */}
              <Reveal direction="right">
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "0" }}>
                  {/* Giant counter */}
                  <div style={{ padding: "3rem 2.5rem", border: "1px solid rgba(201,169,110,0.15)", borderBottom: "none", background: "#0A0A0A" }}>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: "0.68rem", letterSpacing: "0.18em", color: "rgba(201,169,110,0.6)", textTransform: "uppercase" as const, marginBottom: "0.75rem" }}>Affiliate Gyms · Year One</div>
                    <AnimatedStat value={130} suffix="+" label="" delay={300} />
                    <p style={{ fontFamily: "'DM Mono'", fontSize: "0.68rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.3)", textTransform: "uppercase" as const, marginTop: "1rem", marginBottom: 0 }}>
                      CrossFit boxes · Independent studios · Police depts · Fire stations · Federal Agencies
                    </p>
                  </div>
                  {/* Two mini stats */}
                  <div className="response-mini-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid rgba(201,169,110,0.15)" }}>
                    <div style={{ padding: "1.75rem 2rem", borderRight: "1px solid rgba(201,169,110,0.1)" }}>
                      <div style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "2.25rem", color: "#C9A96E", lineHeight: 1 }}>1 yr</div>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: "0.62rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.4)", textTransform: "uppercase" as const, marginTop: "0.5rem" }}>In Operation</div>
                    </div>
                    <div style={{ padding: "1.75rem 2rem" }}>
                      <div style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "2.25rem", color: "#C9A96E", lineHeight: 1 }}>100%</div>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: "0.62rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.4)", textTransform: "uppercase" as const, marginTop: "0.5rem" }}>Coach led programs</div>
                    </div>
                  </div>
                  {/* Tagline */}
                  <div style={{ padding: "1.25rem 2rem", border: "1px solid rgba(201,169,110,0.15)", borderTop: "none", background: "rgba(201,169,110,0.05)" }}>
                    <p style={{ fontFamily: "'DM Mono'", fontSize: "0.68rem", letterSpacing: "0.12em", color: "rgba(201,169,110,0.7)", textTransform: "uppercase" as const, margin: 0, textAlign: "center" as const }}>
                      The problem is urgent. The movement is growing. Join us.
                    </p>
                  </div>
                </div>
              </Reveal>

            </div>
          </div>
        </div>

      </section>
      {/* ═══ FREE CLASS PANEL ══════════════════════════════════════ */}
      <section id="classes" style={{ background: "#080808", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6rem 0" }}>
        <div className="container">
          <div style={{ alignItems: "center" }} className="grid-responsive">
            {/* Left: image */}
            <Reveal direction="left">
              <div style={{ position: "relative" }}>
                <img
                  src={COURSE_HERO_IMG}
                  alt="MetFix athlete performing overhead press"
                  style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", objectPosition: "center top", display: "block" }}
                />
                <div style={{
                  position: "absolute", top: "1.5rem", left: "1.5rem",
                  background: "#C9A96E", color: "#0A0A0A",
                  fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em",
                  textTransform: "uppercase", padding: "0.4rem 0.875rem", fontWeight: 600,
                }}>
                  Free Forever
                </div>
              </div>
            </Reveal>
            {/* Right: content */}
            <Reveal direction="right">
              <div className="rule" style={{ marginBottom: "1.5rem" }}>
                <span className="label-mono">Start Here</span>
              </div>
              <h2 className="display-serif" style={{ fontSize: "clamp(1.8rem, 4vw, 3.5rem)", marginBottom: "1.25rem", lineHeight: 1.1 }}>
                What Is <span className="display-serif-italic text-gold">MetFix?</span>
              </h2>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "rgba(239,239,239,0.65)", marginBottom: "1.5rem" }}>
                The framework that explains why fit people get sick, why decade-long gym members stay stuck, and what coaches can do about it. Six chapters. Fifteen lessons. About an hour.
              </p>
              {/* Two tracks */}
              <div className="two-track-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
                <div style={{ borderLeft: "2px solid #C9A96E", paddingLeft: "1rem" }}>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "0.7rem" }}>Member Track</div>
                  <p style={{ fontFamily: "'DM Sans'", fontSize: "0.9rem", color: "rgba(239,239,239,0.6)", lineHeight: 1.6, margin: 0 }}>
                    For individuals who want to understand and optimize their own metabolic health.
                  </p>
                </div>
                <div style={{ borderLeft: "2px solid rgba(201,169,110,0.35)", paddingLeft: "1rem" }}>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "0.7rem" }}>Coach Track</div>
                  <p style={{ fontFamily: "'DM Sans'", fontSize: "0.9rem", color: "rgba(239,239,239,0.6)", lineHeight: 1.6, margin: 0 }}>
                    For trainers, gym owners, and health professionals who want to apply this with clients.
                  </p>
                </div>
              </div>
              {/* Stats row */}
              <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap", marginBottom: "2.5rem", paddingBottom: "2rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { n: "6", label: "Chapters" },
                  { n: "15", label: "Lessons" },
                  { n: "~1hr", label: "Runtime" },
                  { n: "Free", label: "Forever" },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "1.75rem", color: "#C9A96E", lineHeight: 1 }}>{s.n}</div>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.82)", textTransform: "uppercase", marginTop: "0.3rem" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="hero-cta-stack" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <a href="https://whatis.metfix.org/" target="_blank" rel="noopener noreferrer" className="btn-primary">
                  Take the Free Class <ArrowRight size={15} />
                </a>
                <Link href="/classes" className="btn-outline">
                  View All Courses
                </Link>
              </div>
              <p style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.75)", textTransform: "uppercase", marginTop: "1rem" }}>
                Education you can't find anywhere else
              </p>
            </Reveal>
          </div>
        </div>
      </section>


      {/* ═══ EPIC FAILURES CTA ══════════════════════════════════════════════════ */}
      <section style={{ position: "relative", overflow: "hidden", padding: "5rem 0 6rem", textAlign: "center" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={HERO_IMG} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,10,0.92)" }} />
        </div>
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <Reveal>
            <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.2em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "1.5rem" }}>
              {home.playbook.eyebrow}
            </div>
            <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 5vw, 4.5rem)", lineHeight: 1.1, marginBottom: "1.5rem", maxWidth: "700px", margin: "0 auto 1.5rem" }}>
              <HighlightedHeadlineText headline={home.playbook.headline} />
            </h2>
          <div className="hero-cta-stack" style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <CmsLink cta={home.playbook.cta} className="btn-outline" />
            </div>
          </Reveal>
        </div>
      </section>
      <OutcomesCarousel />

      {/* ═══ SPECIALTY COURSES ════════════════════════════════════ */}
      <section id="courses" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="rule" style={{ marginBottom: "1.5rem" }}>
              <span className="label-mono">{home.specialtyTracks.eyebrow}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1.5rem", marginBottom: "3.5rem" }}>
              <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", lineHeight: 1.1, maxWidth: "480px" }}>
                <HighlightedHeadlineText headline={home.specialtyTracks.headline} />
              </h2>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "rgba(239,239,239,0.8)", maxWidth: "380px" }}>
                {home.specialtyTracks.subtext}
              </p>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
            {homeCourses.map((course, i) => (
              <Reveal key={i} delay={i * 50}>
                <div style={{
                  background: "#0A0A0A",
                  padding: "2rem",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  opacity: course.live || course.notify ? 1 : 0.55,
                  transition: "background 0.2s",
                  cursor: course.live || course.notify ? "pointer" : "default",
                }}
                  onMouseEnter={e => { if (course.live || course.notify) (e.currentTarget as HTMLDivElement).style.background = "rgba(201,169,110,0.04)"; }}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "#0A0A0A"}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
                    <span style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: course.live ? "#C9A96E" : "rgba(239,239,239,0.25)", textTransform: "uppercase" }}>{course.label}</span>
                    <span style={{
                      fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.1em",
                      color: course.live ? "#0A0A0A" : "rgba(239,239,239,0.25)",
                      background: course.live ? "#C9A96E" : "rgba(255,255,255,0.08)",
                      padding: "0.25rem 0.625rem", textTransform: "uppercase",
                    }}>{course.tag}</span>
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "1.25rem", color: "#fdf6f6", marginBottom: "0.875rem", lineHeight: 1.3 }}>{course.name}</h3>
                  <p style={{ fontFamily: "'DM Sans'", fontSize: "0.875rem", lineHeight: 1.7, color: "rgba(239,239,239,0.8)", flex: 1, marginBottom: "1.5rem" }}>{course.desc}</p>
                  {course.live ? (
                    <a href={course.href} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "#C9A96E", textDecoration: "none", textTransform: "uppercase", transition: "gap 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.gap = "0.7rem")}
                      onMouseLeave={e => (e.currentTarget.style.gap = "0.4rem")}>
                      Enroll <ChevronRight size={12} />
                    </a>
                  ) : course.notify ? (
                    <a href={course.href} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "#C9A96E", textDecoration: "none", textTransform: "uppercase", transition: "gap 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.gap = "0.7rem")}
                      onMouseLeave={e => (e.currentTarget.style.gap = "0.4rem")}>
                      Notify Me <ChevronRight size={12} />
                    </a>
                  ) : (
                    <span style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.75)", textTransform: "uppercase" }}>Coming Soon</span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AFFILIATION ══════════════════════════════════════════ */}
      <section id="affiliation" style={{ position: "relative", overflow: "hidden", padding: "7rem 0" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <img src={AFFILIATION_BG_IMG} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.92) 50%, rgba(10,10,10,0.6) 100%)" }} />
        </div>
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: "640px" }}>
            <Reveal>
              <div className="rule" style={{ marginBottom: "1.5rem" }}>
                <span className="label-mono">{home.affiliation.eyebrow}</span>
              </div>
              <h2 className="display-serif" style={{ fontSize: "clamp(1.8rem, 4vw, 3.5rem)", marginBottom: "1.25rem", lineHeight: 1.1 }}>
                <HighlightedHeadlineText headline={home.affiliation.headline} />
              </h2>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "rgba(239,239,239,0.65)", marginBottom: "1.25rem" }}>
                {home.affiliation.body}
              </p>
              <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(239,239,239,0.6)", marginBottom: "2rem" }}>
                {home.affiliation.supportingText}
              </p>
              <div style={{ display: "inline-flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "2rem", padding: "1rem 1.5rem", border: "1px solid rgba(201,169,110,0.25)", background: "rgba(201,169,110,0.04)" }}>
                <span style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "2rem", color: "#C9A96E" }}>{home.affiliation.monthlyPrice}</span>
                <span style={{ fontFamily: "'DM Mono'", fontSize: "0.65rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.45)", textTransform: "uppercase" }}>{home.affiliation.priceNote}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2.5rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {home.affiliation.benefits.map((item, i) => (
                  <li key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ color: "#C9A96E", fontFamily: "'DM Mono'", fontSize: "0.75rem", marginTop: "0.3rem", flexShrink: 0 }}>&#x2022;</span>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: "0.9rem", lineHeight: 1.65, color: "rgba(239,239,239,0.6)" }}>{item}</span>
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <CmsLink cta={home.affiliation.primaryCta} className="btn-primary">
                  {home.affiliation.primaryCta.label} <ArrowRight size={15} />
                </CmsLink>
                <CmsLink cta={home.affiliation.secondaryCta} className="btn-outline" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ FOUNDATIONS SEMINAR ══════════════════════════════════ */}
      <section id="foundations" style={{ background: "#080808", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6rem 0" }}>
        <div className="container">
          <div style={{ alignItems: "center" }} className="grid-responsive">
            <Reveal direction="left">
              <div className="rule" style={{ marginBottom: "1.5rem" }}>
                <span className="label-mono">{home.foundations.eyebrow}</span>
              </div>
              <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", marginBottom: "1.25rem", lineHeight: 1.1 }}>
                <HighlightedHeadlineText headline={home.foundations.headline} />
              </h2>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "rgba(239,239,239,0.65)", marginBottom: "1.5rem" }}>
                {home.foundations.body}
              </p>
              <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "rgba(239,239,239,0.8)", marginBottom: "2.5rem" }}>
                {home.foundations.supportingText}
              </p>
              <CmsLink cta={home.foundations.cta} className="btn-primary">
                {home.foundations.cta.label} <ArrowRight size={15} />
              </CmsLink>
            </Reveal>
            <Reveal direction="right">
              <FoundationsVideoCarousel
                videos={home.foundations.videoEmbedUrls}
                label={home.foundations.videosLabel}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ EMILY STORY ══════════════════════════════════════════ */}
      <section id="about" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6rem 0" }}>
        <div className="container">
          {/* Header row */}
          <Reveal>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1.5rem", marginBottom: "3.5rem", paddingBottom: "2rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <div className="rule" style={{ marginBottom: "1.25rem" }}>
                  <span className="label-mono">{home.whyDifferent.eyebrow}</span>
                </div>
                <div style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "clamp(1.6rem, 2.8vw, 2.25rem)", color: "#fdf6f6", lineHeight: 1.2 }}>
                  {home.whyDifferent.names}
                </div>
              </div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", maxWidth: "320px", lineHeight: 1.6, textAlign: "right", whiteSpace: "pre-line" }}>
                {home.whyDifferent.roles}
              </div>
            </div>
          </Reveal>
          {/* Content: photo left (5fr), blockquote + bio right (7fr) */}
          <div style={{ display: "grid", gap: "4rem", alignItems: "stretch" }} className="about-story-grid">
            <Reveal direction="left">
              {/* Founders photo — fills the full left column height */}
              <div style={{ position: "relative", overflow: "hidden", height: "100%", minHeight: "420px" }} className="founders-photo-wrapper">
                <img
                  src={home.whyDifferent.photoUrl || assetUrl("/founders.png")}
                  alt={home.whyDifferent.names}
                  style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", objectPosition: "center center", position: "absolute", inset: 0 }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,10,0.65) 0%, transparent 50%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontFamily: "'DM Mono'", fontSize: "0.55rem", letterSpacing: "0.14em", color: "rgba(239,239,239,0.4)", textTransform: "uppercase" }}>{home.whyDifferent.photoCaptionLeft}</span>
                  <span style={{ fontFamily: "'DM Mono'", fontSize: "0.55rem", letterSpacing: "0.1em", color: "rgba(201,169,110,0.75)", textTransform: "uppercase" }}>{home.whyDifferent.photoCaptionRight}</span>
                </div>
              </div>
            </Reveal>
            <Reveal direction="right">
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
                <div>
                  <blockquote style={{
                    fontFamily: "'Playfair Display'",
                    fontStyle: "italic",
                    fontSize: "clamp(1.05rem, 1.6vw, 1.35rem)",
                    color: "#fdf6f6",
                    lineHeight: 1.65,
                    borderLeft: "3px solid #C9A96E",
                    paddingLeft: "2rem",
                    margin: "0 0 2.5rem 0",
                  }}>
                    &ldquo;{home.whyDifferent.quote}&rdquo;
                  </blockquote>
                  <div style={{ paddingLeft: "2rem", marginTop: "1rem", marginBottom: "2.5rem" }}>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: "0.65rem", letterSpacing: "0.14em", color: "#C9A96E", textTransform: "uppercase" }}>{home.whyDifferent.quoteAttribution}</div>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: "0.55rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.35)", textTransform: "uppercase", marginTop: "0.25rem" }}>{home.whyDifferent.quoteRole}</div>
                  </div>
                  {home.whyDifferent.body.map((para, i) => (
                    <p key={i} style={{ fontSize: "1rem", lineHeight: 1.85, color: "rgba(239,239,239,0.65)", marginBottom: i === home.whyDifferent.body.length - 1 ? "2.5rem" : "1.5rem" }}>
                      {para}
                    </p>
                  ))}
                </div>
                <CmsLink
                  cta={home.whyDifferent.link}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.7rem", fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.6)", textDecoration: "none", textTransform: "uppercase", transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#C9A96E")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,239,239,0.6)")}
                >
                  {home.whyDifferent.link.label} <ArrowRight size={12} />
                </CmsLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
            {/* ═══ RESOURCE LIBRARY ═════════════════════════════════════ */}
      <section id="library" style={{ background: "#080808", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1.5rem", marginBottom: "3.5rem" }}>
              <div>
                <div className="rule" style={{ marginBottom: "1.5rem" }}>
                  <span className="label-mono">{home.resourceLibrary.eyebrow}</span>
                </div>
                <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", lineHeight: 1.1 }}>
                  <HighlightedHeadlineText headline={home.resourceLibrary.headline} />
                </h2>
                <p style={{ fontFamily: "'DM Sans'", fontSize: "0.95rem", lineHeight: 1.75, color: "rgba(239,239,239,0.5)", maxWidth: "520px", marginTop: "1rem", fontWeight: 300 }}>
                  {home.resourceLibrary.subtext}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1.5rem" }}>
                  {home.resourceLibrary.categoryTags.map(tag => (
                    <a key={tag.label} href="/library"
                      style={{ fontFamily: "'DM Mono'", fontSize: "0.6rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.5)", border: "1px solid rgba(255,255,255,0.1)", padding: "0.3rem 0.75rem", textTransform: "uppercase", textDecoration: "none", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#C9A96E"; e.currentTarget.style.borderColor = "rgba(201,169,110,0.4)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "rgba(239,239,239,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
                      {tag.label}
                    </a>
                  ))}
                </div>
              </div>
              <CmsLink cta={{ ...home.resourceLibrary.fullLibraryCta, href: "/library" }}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.7rem", fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.6)", textDecoration: "none", textTransform: "uppercase", transition: "color 0.2s", whiteSpace: "nowrap" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#C9A96E")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,239,239,0.6)")}>
                {home.resourceLibrary.fullLibraryCta.label} <ArrowRight size={12} />
              </CmsLink>
            </div>
          </Reveal>

          {/* Featured item + 3 secondary items */}
          <div className="library-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
            {/* Featured large card */}
            <Reveal direction="left">
              {(() => {
                const featured = home.resourceLibrary.featured;
                const libraryHref = "/library";
                const showMedia = featured.mediaType !== "none" && Boolean(featured.imageUrl);
                const showPlay =
                  featured.showPlayButton || featured.mediaType === "video";
                return (
              <div style={{ background: "#080808", padding: "3rem", height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <span style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase" }}>{featured.category}</span>
                  <span style={{
                    fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.1em",
                    color: featured.badge === "Free" ? "#C9A96E" : "#0A0A0A",
                    background: featured.badge === "Free" ? "transparent" : "#C9A96E",
                    border: featured.badge === "Free" ? "1px solid rgba(201,169,110,0.4)" : "none",
                    padding: "0.25rem 0.625rem", textTransform: "uppercase",
                  }}>{featured.badge}</span>
                </div>
                {showMedia ? (
                <a href={libraryHref}
                  style={{ display: "block", position: "relative", aspectRatio: "16/9", background: "#111", marginBottom: "1.5rem", overflow: "hidden", textDecoration: "none" }}>
                  <img src={featured.imageUrl} alt={featured.title} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
                  {showPlay && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "4rem", height: "4rem", background: "rgba(201,169,110,0.9)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A0A0A"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                  )}
                  {featured.tag && (
                  <div style={{ position: "absolute", bottom: "0.75rem", right: "0.75rem", fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.7)", background: "rgba(0,0,0,0.7)", padding: "0.2rem 0.5rem", textTransform: "uppercase" }}>{featured.tag}</div>
                  )}
                </a>
                ) : null}
                <a href={libraryHref} style={{ textDecoration: "none", color: "inherit" }}>
                <h3 style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "1.35rem", color: "#fdf6f6", marginBottom: "0.875rem", lineHeight: 1.35 }}>
                  {featured.title}
                </h3>
                </a>
                <p style={{ fontFamily: "'DM Sans'", fontSize: "0.9rem", lineHeight: 1.7, color: "rgba(239,239,239,0.8)", flex: 1, marginBottom: "1.25rem" }}>
                  {featured.description}
                </p>
                <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.82)", textTransform: "uppercase" }}>{featured.author}</div>
              </div>
                );
              })()}
            </Reveal>

            {/* Three secondary cards stacked */}
            <div style={{ display: "grid", gridTemplateRows: "1fr 1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
              {home.resourceLibrary.items.map((item, i) => (
                <Reveal key={`${item.title}-${i}`} delay={i * 80} direction="right">
                  <a href="/library"
                    style={{ background: "#080808", padding: "1.75rem 2rem", display: "flex", flexDirection: "column", height: "100%", textDecoration: "none", transition: "background 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,169,110,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#080808")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <span style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase" }}>{item.category}</span>
                      <div style={{ display: "flex", gap: "0.7rem", alignItems: "center" }}>
                        <span style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.25)", textTransform: "uppercase" }}>{item.tag}</span>
                        <span style={{
                          fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.1em",
                          color: item.badge === "Free" ? "#C9A96E" : "#0A0A0A",
                          background: item.badge === "Free" ? "transparent" : "#C9A96E",
                          border: item.badge === "Free" ? "1px solid rgba(201,169,110,0.4)" : "none",
                          padding: "0.2rem 0.5rem", textTransform: "uppercase",
                        }}>{item.badge}</span>
                      </div>
                    </div>
                    <h3 style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "1rem", color: "#fdf6f6", marginBottom: "0.7rem", lineHeight: 1.35, flex: 1 }}>{item.title}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginTop: "0.75rem" }}>
                      <BookOpen size={12} color="rgba(239,239,239,0.25)" />
                      <span style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.25)", textTransform: "uppercase" }}>{item.author}</span>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={200}>
            <div style={{ marginTop: "2.5rem", textAlign: "center" }}>
              <CmsLink cta={{ ...home.resourceLibrary.bottomCta, href: "/library" }} className="btn-outline">
                {home.resourceLibrary.bottomCta.label} <ArrowRight size={14} />
              </CmsLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ THE GAP ══════════════════════════════════════════════ */}
      <section style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6rem 0" }}>
        <div className="container">
          <div style={{ alignItems: "start" }} className="grid-responsive">
            <Reveal direction="left">
              <div className="rule" style={{ marginBottom: "1.5rem" }}>
                <span className="label-mono">{home.gap.eyebrow}</span>
              </div>
              <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", lineHeight: 1.1, marginBottom: "1.5rem" }}>
                <HighlightedHeadlineText headline={home.gap.headline} />
              </h2>
              <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(239,239,239,0.6)", marginBottom: "2rem" }}>
                {home.gap.body}
              </p>
              <CmsLink cta={home.gap.cta} className="btn-primary">
                {home.gap.cta.label} <ArrowRight size={15} />
              </CmsLink>
            </Reveal>
            <Reveal direction="right">
              <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "rgba(239,239,239,0.82)", textTransform: "uppercase", marginBottom: "1.5rem" }}>{home.gap.listLabel}</div>
              {home.gap.statusQuoItems.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.25rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color: "rgba(239,239,239,0.75)", fontSize: "1rem", fontWeight: 300, lineHeight: 1 }}>×</span>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: "1rem", color: "rgba(239,239,239,0.65)", lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
              <div style={{ marginTop: "1.5rem", borderLeft: "3px solid #C9A96E", paddingLeft: "1.5rem", paddingTop: "1.25rem", paddingBottom: "1.25rem" }}>
                <p style={{ fontFamily: "'Playfair Display'", fontStyle: "italic", fontSize: "1.2rem", color: "#fdf6f6", margin: 0, lineHeight: 1.5 }}>
                  {home.gap.closingQuote}
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STAT COUNTERS removed — content moved to impact section above hero */}

      {/* ═══ TESTIMONIALS ══════════════════════════════════════════ */}
      <TestimonialCarousel items={testimonials} eyebrow={home.testimonialsSection.eyebrow} />

      {/* ═══ AFFILIATE NETWORK ════════════════════════════════════ */}
      <section id="network" style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "5rem 0" }}>
        <div className="container">
          <div style={{ alignItems: "center" }} className="grid-responsive">
            <Reveal direction="left">
              <div className="rule" style={{ marginBottom: "1.5rem" }}>
                <span className="label-mono">{home.network.eyebrow}</span>
              </div>
              <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", marginBottom: "1.5rem", lineHeight: 1.1 }}>
                <HighlightedHeadlineText headline={home.network.headline} />
              </h2>
              <p style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "rgba(239,239,239,0.6)", marginBottom: "2rem" }}>
                {home.network.body}
              </p>
              <CmsLink cta={home.network.cta} className="btn-primary">
                {home.network.cta.label} <ArrowRight size={15} />
              </CmsLink>
            </Reveal>
            <Reveal direction="right">
              <div className="affiliate-pin-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
                {home.network.featuredLocations.slice(0, 8).map((pin, i) => (
                  <div key={`${pin.name}-${i}`} style={{ background: "#0A0A0A", padding: "1.5rem", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: "0.7rem", letterSpacing: "0.12em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "0.4rem" }}>{pin.city}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: "0.9rem", color: "#fdf6f6", lineHeight: 1.3 }}>{pin.name}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ NEWSLETTER ════════════════════════════════════════════ */}
      <section id="newsletter" style={{ background: "#080808", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "5rem 0" }}>
        <div className="container">
          <div style={{ alignItems: "start" }} className="grid-responsive">
            <Reveal direction="left">
              <div className="rule" style={{ marginBottom: "1.5rem" }}>
                <span className="label-mono">{home.weekly.eyebrow}</span>
              </div>
              <h2 className="display-serif" style={{ fontSize: "clamp(1.8rem, 4vw, 3.5rem)", lineHeight: 1.1, marginBottom: "1.25rem" }}>
                <HighlightedHeadlineText headline={home.weekly.headline} />
              </h2>
              <p style={{ fontSize: "1rem", lineHeight: 1.8, color: "rgba(239,239,239,0.6)", marginBottom: "2rem" }}>
                {home.weekly.body}
              </p>
              <div className="daily-fix-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {[
                  { n: "07", label: "Recipes", desc: "Metabolically optimized, every week" },
                  { n: "07", label: "Workouts", desc: "Built for metabolic output" },
                  { n: "07", label: "Readings", desc: "From the research front" },
                  { n: "01", label: "Original Article", desc: "Written for the MetFix community" },
                ].map(item => (
                  <div key={item.label} style={{ padding: "1.25rem", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: "1.5rem", color: "#C9A96E", lineHeight: 1, marginBottom: "0.25rem" }}>{item.n}</div>
                    <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "rgba(239,239,239,0.8)", textTransform: "uppercase", marginBottom: "0.4rem" }}>{item.label}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: "0.8rem", color: "rgba(239,239,239,0.6)", lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal direction="right">
              <div style={{ padding: "2.5rem", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "0.7rem" }}>Join Thousands of Coaches and Members</div>
                <p style={{ fontFamily: "'DM Sans'", fontSize: "0.875rem", color: "rgba(239,239,239,0.6)", marginBottom: "1.75rem" }}>
                  Free forever. No credit card. Unsubscribe anytime.
                </p>
                {newsletterSubmitted ? (
                  <div style={{ padding: "1.5rem", background: "rgba(201,169,110,0.08)", border: "1px solid rgba(201,169,110,0.2)", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Playfair Display'", fontStyle: "italic", fontSize: "1.1rem", color: "#C9A96E", marginBottom: "0.7rem" }}>You're in.</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: "0.875rem", color: "rgba(239,239,239,0.8)" }}>First issue arrives this week.</div>
                  </div>
                ) : (
                  <>
                    <form
                      action={MAILCHIMP_NEWSLETTER_ACTION}
                      method="post"
                      target="mailchimp-newsletter"
                      onSubmit={() => setNewsletterSubmitted(true)}
                      className="newsletter-form-row"
                      style={{ display: "flex", gap: "0" }}
                    >
                      <div style={{ position: "absolute", left: "-5000px" }} aria-hidden="true">
                        <input type="text" name="b_473a65a0067d6101d3a6277c8_abdc550935" tabIndex={-1} defaultValue="" />
                      </div>
                      <input
                        type="email"
                        name="EMAIL"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Your email address"
                        required
                        style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRight: "none", padding: "0.875rem 1rem", fontFamily: "'DM Sans'", fontSize: "0.9rem", color: "#fdf6f6", outline: "none" }}
                      />
                      <button type="submit" className="btn-primary" style={{ borderRadius: 0, whiteSpace: "nowrap" }}>
                        Subscribe <ArrowRight size={14} />
                      </button>
                    </form>
                    <iframe name="mailchimp-newsletter" title="Newsletter signup" style={{ display: "none" }} />
                  </>
                )}
                <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "0.7rem" }}>The Daily Fix</div>
                  <Link href="/the-daily-fix"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#C9A96E")}
                    onMouseLeave={e => (e.currentTarget.style.color = "inherit")}>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: "0.875rem", color: "rgba(239,239,239,0.8)" }}>
                      Want it daily instead of weekly? A workout, recipe, and reading every morning. Free.
                    </span>
                    <ArrowRight size={14} color="rgba(239,239,239,0.55)" style={{ flexShrink: 0, marginLeft: "0.75rem" }} />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ══════════════════════════════════════════════════ */}
      <section style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "6rem 0" }}>
        <div className="container">
          <Reveal>
            <div className="rule" style={{ marginBottom: "1.5rem" }}>
              <span className="label-mono">{home.faqSection.eyebrow}</span>
            </div>
            <h2 className="display-serif" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", marginBottom: "3rem", lineHeight: 1.1 }}>
              <HighlightedHeadlineText headline={home.faqSection.headline} />
            </h2>
          </Reveal>
          <div style={{ maxWidth: "720px" }}>
            <Accordion type="single" collapsible>
              {faqs.map((item, i) => (
                <AccordionItem key={item.id || i} value={`faq-${i}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <AccordionTrigger style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: "1rem", color: "#fdf6f6", padding: "1.5rem 0", textAlign: "left" }}>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent style={{ fontFamily: "'DM Sans'", fontSize: "0.95rem", lineHeight: 1.8, color: "rgba(239,239,239,0.82)", paddingBottom: "1.5rem" }}>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════ */}
      <footer style={{ background: "#050505", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "4rem 0 2rem", paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }} className="footer-mobile-pad">
        <div className="container">
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "3rem", marginBottom: "3rem" }}>
            <div>
              <div style={{ marginBottom: "1.25rem" }}>
                <img src={assetUrl("/metfix-lockup.png")} alt="MetFix" style={{ height: "2.25rem", width: "auto", display: "block" }} />
              </div>
              <p style={{ fontFamily: "'DM Sans'", fontSize: "0.85rem", lineHeight: 1.7, color: "rgba(239,239,239,0.82)", maxWidth: "280px", marginBottom: "1.25rem" }}>
                The metabolic health education platform for coaches, gym owners, and health leaders fighting chronic disease.
              </p>
              <a href="https://brokenscience.org/" target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.12em", color: "rgba(201,169,110,0.5)", textDecoration: "none", textTransform: "uppercase" }}>
                A Broken Science Initiative Project
              </a>
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "1.25rem" }}>Learn</div>
              {[
                { label: "The Daily Fix", href: "/the-daily-fix" },
                { label: "What Is MetFix?", href: "https://whatis.metfix.org/" },
                { label: "Foundations Seminar", href: "https://brokenscience.org/events/" },
              ].map(l => (
                <a key={l.label} href={basePath(l.href)} target={l.href.startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer"
                  style={{ display: "block", fontFamily: "'DM Sans'", fontSize: "0.85rem", color: "rgba(239,239,239,0.8)", textDecoration: "none", marginBottom: "0.75rem", transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#EFEFEF")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,239,239,0.5)")}>{l.label}</a>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "1.25rem" }}>Specialty</div>
              {[
                { label: "Courses", href: "/courses" },
              ].map(l => (
                <a key={l.label} href={basePath(l.href)} target={l.href.startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer"
                  style={{ display: "block", fontFamily: "'DM Sans'", fontSize: "0.85rem", color: "rgba(239,239,239,0.8)", textDecoration: "none", marginBottom: "0.75rem", transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#EFEFEF")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,239,239,0.5)")}>{l.label}</a>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.15em", color: "#C9A96E", textTransform: "uppercase", marginBottom: "1.25rem" }}>Community</div>
              {[
                { label: "Find a Gym", href: METFIX_MAP_URL },
                { label: "Become an Affiliate", href: "/become-an-affiliate" },
                { label: "Broken Science Initiative", href: "https://brokenscience.org/" },
                { label: "Login", href: "https://brokenscience.org/login/" },
              ].map(l => (
                <a key={l.label} href={basePath(l.href)}
                  target={l.href.startsWith("http") ? "_blank" : "_self"} rel="noopener noreferrer"
                  style={{ display: "block", fontFamily: "'DM Sans'", fontSize: "0.85rem", color: "rgba(239,239,239,0.8)", textDecoration: "none", marginBottom: "0.75rem", transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#EFEFEF")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,239,239,0.5)")}>{l.label}</a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.25rem 2rem" }}>
            <CopyrightText variant="home" />
            <div style={{ fontFamily: "'DM Mono'", fontSize: "0.75rem", letterSpacing: "0.1em", color: "rgba(239,239,239,0.75)", textTransform: "uppercase", flexShrink: 0 }}>
              <a href="https://brokenscience.org/privacy-policy/" target="_blank" rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#EFEFEF")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,239,239,0.75)")}>Privacy</a>
              {' · '}
              <a href="https://brokenscience.org/terms-and-conditions/" target="_blank" rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#EFEFEF")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(239,239,239,0.75)")}>Terms</a>
            </div>
          </div>
        </div>
      </footer>

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
        <a href="https://whatis.metfix.org/" target="_blank" rel="noopener noreferrer"
          className="btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: "0.85rem" }}>
          Start Here <ArrowRight size={14} />
        </a>
        <Link href="/become-an-affiliate"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.625rem 1rem", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(239,239,239,0.7)", textDecoration: "none", fontFamily: "'DM Mono'", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", transition: "border-color 0.2s" }}>
          Affiliate
        </Link>
      </div>

    </div>
  );
}
