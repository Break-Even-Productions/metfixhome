import { useEffect, useRef, useState } from "react";
import { storiesFor, type FeaturePlacement, type Testimonial } from "@/data/home/stories";
import type { AudienceHref, LandingCopy } from "@/data/home/audience";
import { SectionPad } from "./SectionCard";

type HomeTestimonialsProps = {
  copy: LandingCopy;
  audience: AudienceHref;
  /** Sanity testimonials reserved; audience stories win when present (GAP-4). */
  sanityTestimonials?: unknown;
};

const partners = [
  {
    id: "wodify",
    name: "wodify",
    className: "font-wodify text-[1.35rem] font-semibold tracking-tight md:text-[1.55rem]",
  },
  {
    id: "twobrain",
    name: "Two-Brain Business",
    className: "font-twobrain text-[1.05rem] font-bold tracking-tight md:text-[1.2rem]",
  },
  {
    id: "pushpress",
    name: "PushPress",
    className: "font-pushpress text-[1.15rem] font-bold tracking-tight md:text-[1.35rem]",
  },
  {
    id: "goruck",
    name: "GORUCK",
    className: "font-goruck text-[1.35rem] font-medium uppercase tracking-[0.14em] md:text-[1.55rem]",
  },
] as const;

const sponsorLoop = [...partners, ...partners];

function columnsFor(audience: AudienceHref) {
  const { featuredAt, testimonials } = storiesFor(audience);
  return featuredAt.map((feature, index) => ({
    feature,
    quote: testimonials[index % testimonials.length],
    featureFirst: index % 2 === 0,
  }));
}

function QuoteCard({ item }: { item: Testimonial }) {
  return (
    <figure className="story-card relative h-[19.5rem] overflow-hidden rounded-[1.35rem] bg-ink shadow-[0_10px_30px_rgba(23,21,18,0.08)] md:h-[22.5rem]">
      <img
        src={item.photo}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full max-w-none object-cover"
        style={{ objectPosition: item.position }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
      <figcaption className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-16 text-white">
        <blockquote>
          <p className="font-serif text-[1.05rem] leading-snug text-pretty md:text-[1.15rem]">
            &ldquo;{item.quote}&rdquo;
          </p>
        </blockquote>
        <p className="mt-3 w-fit rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {item.name}
        </p>
      </figcaption>
    </figure>
  );
}

function FeatureCard({ item }: { item: FeaturePlacement }) {
  return (
    <div className="story-card flex h-[11.25rem] flex-col items-center justify-center rounded-[1.35rem] bg-white px-5 md:h-[8.5rem]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Featured at:</p>
      <img src={item.src} alt={item.name} className={`mt-3 w-auto object-contain ${item.className}`} />
    </div>
  );
}

function Column({
  column,
  stableKey,
}: {
  column: ReturnType<typeof columnsFor>[number];
  stableKey: string;
}) {
  const feature = <FeatureCard item={column.feature} />;
  const quote = <QuoteCard item={column.quote} />;
  return (
    <div
      data-column-key={stableKey}
      className="story-column flex w-[15.25rem] shrink-0 flex-col gap-3 md:w-[17rem]"
    >
      {column.featureFirst ? feature : quote}
      {column.featureFirst ? quote : feature}
    </div>
  );
}

export function HomeTestimonials({
  copy,
  audience,
  sanityTestimonials: _sanity,
}: HomeTestimonialsProps) {
  void _sanity;
  const base = columnsFor(audience);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const root = marqueeRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [audience]);

  // P-E-20 / T-E-48: marquee motion is CSS only (animation-play-state).
  // Pause when off-screen, user-paused, or prefers-reduced-motion.
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animStyle =
    paused || !onScreen || reduceMotion
      ? ({ animationPlayState: "paused" } as const)
      : undefined;

  return (
    <section id="stories">
      <SectionPad className="!pb-8">
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-center font-serif text-3xl text-ink md:text-[2.6rem]">
            {copy.testimonialsTitle}
          </h2>
          <button
            type="button"
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
            className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-cream-2"
          >
            {paused ? "Play stories" : "Pause stories"}
          </button>
        </div>
      </SectionPad>
      <div ref={marqueeRef} className="story-marquee pb-12 md:pb-16">
        <div className="story-track" style={animStyle}>
          <div className="story-columns" style={animStyle}>
            {[0, 1].map((copyIndex) => (
              <div key={copyIndex} className="story-set" aria-hidden={copyIndex === 1}>
                {base.map((column) => (
                  <Column
                    key={`${copyIndex}-${column.feature.name}-${column.quote.name}`}
                    stableKey={`${copyIndex}-${column.feature.name}`}
                    column={column}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="story-partner-gap" aria-hidden="true" />
          <div className="story-sponsors" style={animStyle}>
            {[0, 1].map((copyIndex) => (
              <ul key={copyIndex} className="story-sponsor-set" aria-hidden={copyIndex === 1}>
                {sponsorLoop.map((partner, index) => (
                  <li
                    key={`${copyIndex}-${partner.id}-${index}`}
                    className={`whitespace-nowrap leading-none text-ink ${partner.className}`}
                  >
                    {partner.name}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
        <p className="story-partner-label">Our Partners</p>
      </div>
    </section>
  );
}
