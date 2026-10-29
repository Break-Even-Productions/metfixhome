import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import type { HomePageContent } from "@/lib/homeTypes";
import { SectionCard } from "./SectionCard";

const slidesFallback = [
  { src: "/foundations/coach-1.png", alt: "Coach testimonial from a Foundations seminar" },
  { src: "/foundations/coach-2.png", alt: "Coach testimonial from a Foundations seminar" },
  { src: "/foundations/coach-3.png", alt: "Coach testimonial from a Foundations seminar" },
  { src: "/foundations/coach-4.png", alt: "Coach testimonial from a Foundations seminar" },
] as const;

const SLIDE = 118;
const GAP = 14;
const STRIDE = SLIDE + GAP;

type HomeFoundationsProps = {
  foundations?: HomePageContent["foundations"];
};

export function HomeFoundations({ foundations }: HomeFoundationsProps) {
  const reduce = useReducedMotion();
  const testimonials = slidesFallback;
  const count = testimonials.length;
  const slides = [...testimonials, ...testimonials, ...testimonials];
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [pos, setPos] = useState<number>(count);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setFrameWidth(frame.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || paused) return;
    const frame = frameRef.current;
    if (!frame) return;
    let id: number | null = null;
    const start = () => {
      if (id == null) id = window.setInterval(() => setPos((current) => current + 1), 4200);
    };
    const stop = () => {
      if (id != null) {
        window.clearInterval(id);
        id = null;
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) start();
        else stop();
      },
      { threshold: 0.05 },
    );
    io.observe(frame);
    return () => {
      io.disconnect();
      stop();
    };
  }, [reduce, paused]);

  useEffect(() => {
    if (pos >= count && pos < count * 2) return;
    const id = window.setTimeout(() => {
      setAnimate(false);
      setPos((current) => {
        let next = current;
        while (next >= count * 2) next -= count;
        while (next < count) next += count;
        return next;
      });
    }, 560);
    return () => window.clearTimeout(id);
  }, [pos, count]);

  useEffect(() => {
    if (animate) return;
    setAnimate(true);
  }, [animate]);

  const offset = frameWidth / 2 - (pos * STRIDE + SLIDE / 2);
  const headline =
    foundations?.headline?.text?.replace(/\n/g, " ") ?? "MetFix Foundations Seminar";
  const body =
    foundations?.body ??
    "Two days. In person. The hands-on practical capstone of the MetFix curriculum. You leave with the metabolic health coaching framework fully integrated, practiced, and ready to deploy with your clients on Monday.";
  const supporting =
    foundations?.supportingText ??
    "Foundations is where the community comes together. Coaches and practitioners from around the world. Shared knowledge, workouts and practical implementation.";
  const ctaHref = foundations?.cta?.href ?? "/affiliate-seminars";
  const ctaLabel = foundations?.cta?.label ?? "Host a Seminar";

  return (
    <SectionCard id="foundations" tone="paper">
      <div className="px-5 py-7 md:px-8 md:py-8 lg:px-10 lg:py-9">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(16rem,0.95fr)] lg:gap-10">
          <div>
            <h2 className="max-w-md font-serif text-[2rem] leading-[1.08] text-ink md:text-[2.35rem]">
              {headline}
            </h2>
            <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-muted">{body}</p>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">{supporting}</p>
            {ctaHref.startsWith("http") ? (
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition-[background-color,transform] duration-300 ease-out hover:-translate-y-px hover:bg-accent-2"
              >
                {ctaLabel}
                <span aria-hidden="true">→</span>
              </a>
            ) : (
              <Link
                href={ctaHref}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink transition-[background-color,transform] duration-300 ease-out hover:-translate-y-px hover:bg-accent-2"
              >
                {ctaLabel}
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div className="relative mb-3">
              <h3 className="px-16 text-center font-serif text-lg leading-tight text-ink md:text-xl">
                {foundations?.videosLabel ?? "Hear From Coaches Who Attended"}
              </h3>
              <div className="absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous testimonial"
                  onClick={() => setPos((current) => current - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink transition-colors duration-300 ease-out hover:bg-cream"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next testimonial"
                  onClick={() => setPos((current) => current + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink transition-colors duration-300 ease-out hover:bg-cream"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={frameRef} className="relative h-[13.25rem] overflow-hidden">
              <div
                className="absolute left-0 top-0 flex items-center"
                style={{
                  gap: GAP,
                  transform: `translateX(${offset}px)`,
                  transition: animate ? "transform 560ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
                }}
              >
                {slides.map((item, i) => {
                  const isCenter = i === pos;
                  const distance = Math.abs(i - pos);
                  return (
                    <button
                      key={`${item.src}-${i}`}
                      type="button"
                      aria-label={isCenter ? "Current testimonial" : "Show testimonial"}
                      aria-current={isCenter ? "true" : undefined}
                      tabIndex={distance > 1 ? -1 : 0}
                      onClick={() => {
                        if (i !== pos) setPos(i);
                      }}
                      className="shrink-0 overflow-hidden rounded-[1.05rem] bg-ink shadow-[0_10px_24px_rgba(23,21,18,0.12)]"
                      style={{
                        width: SLIDE,
                        transform: `scale(${isCenter ? 1 : 0.78})`,
                        opacity: distance > 1 ? 0 : isCenter ? 1 : 0.72,
                        zIndex: isCenter ? 2 : 1,
                        transition: animate
                          ? "transform 560ms cubic-bezier(0.16, 1, 0.3, 1), opacity 560ms ease"
                          : "none",
                      }}
                    >
                      <img
                        src={item.src}
                        alt={isCenter ? item.alt : ""}
                        className="aspect-[9/16] w-full object-cover object-top"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
