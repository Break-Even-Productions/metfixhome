import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { MEMBERSHIP_COMPARISON_ROWS, MEMBERSHIP_HERO } from "@shared/join";
import "@/join/join.css";

const membershipPhotos: Record<string, { src: string; position: string }> = {
  default: {
    src: "/Stills/group-bodyweight-stand-gym.jpg",
    position: "center 22%",
  },
  coaches: {
    src: "/Stills/group-bodyweight-stand-gym.jpg",
    position: "center 22%",
  },
  clinicians: {
    src: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=70",
    position: "center center",
  },
};

export type MembershipProps = {
  onJoin: () => void;
  audience?: keyof typeof membershipPhotos | string;
};

/**
 * WJ16–WJ17 Membership hero + 7-row comparison table.
 * CQ Trap 5 fixed: no direct DOM node removal; CSS liquid-glass only (no WebGL).
 * N9: framer `useScroll` (no raw scroll listener).
 */
export function Membership({ onJoin, audience = "default" }: MembershipProps) {
  const reduce = useReducedMotion();
  const photo = membershipPhotos[audience] ?? membershipPhotos.default;
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [24, -24]);

  return (
    <div
      id="membership"
      className="membership-theme grid gap-2 md:gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
    >
      <section className="membership-card h-full overflow-hidden rounded-[1.75rem] bg-[var(--join-paper)] md:rounded-[2.5rem]">
        <div
          ref={rootRef}
          className="relative h-full min-h-[26rem] overflow-hidden rounded-[1.75rem] bg-[var(--join-ink)] md:rounded-[2.5rem]"
        >
          <motion.img
            src={photo.src}
            alt=""
            crossOrigin={photo.src.startsWith("http") ? "anonymous" : undefined}
            className="membership-photo pointer-events-none absolute inset-x-0 -top-12 h-[calc(100%+6rem)] w-full max-w-none object-cover"
            style={{
              objectPosition: photo.position,
              y,
            }}
          />
          <div className="membership-glass absolute inset-0 z-10 flex flex-col justify-center">
            <div className="relative z-[2] px-5 py-8 md:px-8 md:py-10 lg:px-10 lg:py-12">
              <h2 className="max-w-md font-serif text-4xl leading-[1.12] text-[var(--join-cream)] md:text-[3.1rem]">
                {MEMBERSHIP_HERO.headline}
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--join-cream)]/85">
                {MEMBERSHIP_HERO.subcopy}
              </p>
              <button
                type="button"
                onClick={onJoin}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--join-accent)] px-6 py-3 text-sm font-semibold text-[var(--join-ink)] transition-[background-color,transform] duration-300 ease-out hover:-translate-y-px hover:bg-[var(--join-accent-2)]"
              >
                {MEMBERSHIP_HERO.cta}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="h-full rounded-[1.75rem] bg-[var(--join-cream)] p-3 md:rounded-[2.5rem] md:p-4">
        <div className="h-full overflow-hidden rounded-[1.5rem] bg-[var(--join-paper)] md:rounded-[1.85rem]">
          <div
            className="grid grid-cols-[1.4fr_1fr_1fr] items-end border-b border-[var(--join-line)] px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--join-muted)] md:grid-cols-[1.6fr_1fr_1fr] md:px-7 md:py-5"
            role="row"
          >
            <span>Membership Features</span>
            <span className="text-center font-serif text-base font-medium normal-case tracking-normal text-[var(--join-ink)]">
              MetFix ($30/mo · 1st month free)
            </span>
            <span className="text-center">Free</span>
          </div>
          <table className="w-full border-collapse text-left" aria-label="MetFix vs Free membership comparison">
            <thead className="sr-only">
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">MetFix</th>
                <th scope="col">Free</th>
              </tr>
            </thead>
            <tbody>
              {MEMBERSHIP_COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={
                    i !== MEMBERSHIP_COMPARISON_ROWS.length - 1
                      ? "border-b border-[var(--join-line)]"
                      : undefined
                  }
                >
                  <th
                    scope="row"
                    className="px-4 py-3.5 text-sm font-normal text-[var(--join-ink)] md:px-7"
                  >
                    {row.feature}
                  </th>
                  <td className="px-2 py-3.5 text-center text-sm text-[var(--join-ink)]/90 md:px-4">
                    {row.metfix}
                  </td>
                  <td className="px-2 py-3.5 text-center text-sm text-[var(--join-muted)] md:px-4">
                    {row.free}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
