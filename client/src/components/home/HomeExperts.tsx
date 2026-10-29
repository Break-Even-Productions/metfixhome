import { useEffect, useRef, useState } from "react";
import type { Expert } from "@/data/home/experts";
import { Reveal } from "./Reveal";
import { SectionCard, SectionPad } from "./SectionCard";

type HomeExpertsProps = {
  experts: readonly Expert[];
};

function Avatar({ initials, hue, alt }: { initials: string; hue: number; alt: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center text-2xl font-semibold text-cream"
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 42% 28%), hsl(${hue} 38% 16%))`,
      }}
      role="img"
      aria-label={alt}
    >
      {initials}
    </div>
  );
}

function ExpertCard({
  expert,
  selected,
  onSelect,
  labelled = true,
}: {
  expert: Expert;
  selected: boolean;
  onSelect: () => void;
  labelled?: boolean;
}) {
  return (
    <li className="w-[10.75rem] shrink-0 snap-start" aria-hidden={labelled ? undefined : true}>
      <button
        type="button"
        onClick={onSelect}
        tabIndex={labelled ? undefined : -1}
        aria-expanded={labelled ? selected : undefined}
        className={`group w-full rounded-[1.15rem] p-1.5 text-left transition-colors duration-300 ${
          selected ? "bg-ink-2" : ""
        }`}
      >
        <div className="aspect-square overflow-hidden rounded-[0.85rem] shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-cream/10 transition-transform duration-500 ease-out group-hover:scale-105">
          <Avatar initials={expert.initials} hue={expert.hue} alt={expert.name} />
        </div>
        <p className="mt-3 px-1 font-serif text-[1.05rem] leading-snug text-cream">{expert.name}</p>
        {expert.role ? <p className="mt-1 px-1 text-xs text-cream/55">{expert.role}</p> : null}
      </button>
    </li>
  );
}

export function HomeExperts({ experts }: HomeExpertsProps) {
  const scroller = useRef<HTMLUListElement>(null);
  const offset = useRef<number | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = experts.find((expert) => expert.name === selectedName) ?? null;
  const lineup = experts.map((expert) => expert.name).join("|");

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const widthOfSet = () => el.scrollWidth / 3;
    el.scrollLeft = widthOfSet();
    offset.current = null;
    const wrap = () => {
      const width = widthOfSet();
      if (width <= 0) return;
      if (el.scrollLeft < width * 0.15) el.scrollLeft += width;
      else if (el.scrollLeft > width * 1.85) el.scrollLeft -= width;
    };
    el.addEventListener("scroll", wrap, { passive: true });
    return () => el.removeEventListener("scroll", wrap);
  }, [lineup]);

  function scrollByCard(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector("li");
    const amount = (card?.getBoundingClientRect().width ?? 172) + 20;
    const width = el.scrollWidth / 3;
    const prev = offset.current ?? el.scrollLeft;
    let next = prev + direction * amount;
    while (next > width * 1.5) next -= width;
    while (next < width * 0.5) next += width;
    if (Math.abs(next - prev) > amount * 1.5) el.scrollLeft = next - direction * amount;
    offset.current = next;
    el.scrollTo({ left: next, behavior: "smooth" });
  }

  return (
    <SectionCard id="experts" tone="ink" className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-40 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-accent)_12%,transparent),transparent_70%)]" />
      <SectionPad className="relative">
        <Reveal className="@container text-center">
          <h2 className="whitespace-nowrap font-serif leading-none tracking-tight text-[clamp(0.78rem,4.55cqi,2.6rem)]">
            Learn from Metabolic Health Experts
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-cream/65 md:text-[15px]">
            Our classes are endorsed by our medical society, real-world practitioners and researchers
            with years of experience.
          </p>
        </Reveal>

        <div className="expert-rail relative mt-10">
          <button
            type="button"
            aria-label="Previous experts"
            onClick={() => scrollByCard(-1)}
            className="expert-nav expert-nav-prev absolute top-[4.6rem] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-cream/15 bg-ink/80 text-lg text-cream transition-colors duration-300 hover:bg-ink-2"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            aria-label="Next experts"
            onClick={() => scrollByCard(1)}
            className="expert-nav expert-nav-next absolute top-[4.6rem] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-cream/15 bg-ink/80 text-lg text-cream transition-colors duration-300 hover:bg-ink-2"
          >
            <span aria-hidden="true">→</span>
          </button>
          <div className="expert-marquee">
            <div className="expert-fade expert-fade-left" aria-hidden="true" />
            <div className="expert-fade expert-fade-right" aria-hidden="true" />
            <ul ref={scroller} className="expert-set scrollbar-hide">
              {[0, 1, 2].map((copyIndex) =>
                experts.map((expert) => (
                  <ExpertCard
                    key={`${copyIndex}-${expert.name}`}
                    expert={expert}
                    labelled={copyIndex === 1}
                    selected={selectedName === expert.name}
                    onSelect={() =>
                      setSelectedName((current) => (current === expert.name ? null : expert.name))
                    }
                  />
                )),
              )}
            </ul>
          </div>
        </div>

        {selected ? (
          <div className="mt-6 rounded-[1.25rem] border border-cream/10 bg-ink-2 px-5 py-6 md:px-8 md:py-7">
            <p className="font-serif text-2xl leading-snug text-cream">{selected.name}</p>
            {selected.role ? <p className="mt-1 text-sm text-cream/55">{selected.role}</p> : null}
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-cream/80">{selected.bio}</p>
          </div>
        ) : null}
      </SectionPad>
    </SectionCard>
  );
}
