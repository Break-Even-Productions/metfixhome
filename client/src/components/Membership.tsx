import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check, X } from "lucide-react";
import { useRef } from "react";
import { MEMBERSHIP_HERO } from "@shared/join";
import type { AudienceHref } from "@/data/home/audience";
import {
  audienceShowsAffiliateColumn,
  FALLBACK_MEMBERSHIP_COMPARISON,
  resolveMembershipComparisonRows,
  type MembershipComparisonCell,
  type MembershipComparisonContent,
} from "@/data/home/membershipComparison";
import "@/join/join.css";

const membershipPhotos: Record<AudienceHref, { src: string; position: string }> = {
  "#for-individuals": {
    src: "/Stills/group-bodyweight-stand-gym.jpg",
    position: "center 22%",
  },
  "#for-athletes": {
    src: "/Stills/group-bodyweight-stand-gym.jpg",
    position: "center 22%",
  },
  "#for-coaches": {
    src: "/Stills/group-bodyweight-stand-gym.jpg",
    position: "center 22%",
  },
  "#for-gym-owners": {
    src: "/Stills/group-bodyweight-stand-gym.jpg",
    position: "center 40%",
  },
  "#for-first-responders": {
    src: "/Stills/group-bodyweight-stand-gym.jpg",
    position: "center 22%",
  },
  "#for-clinicians": {
    src: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=70",
    position: "center center",
  },
  "#for-organizations": {
    src: "/Stills/group-bodyweight-stand-gym.jpg",
    position: "center 30%",
  },
};

export type MembershipProps = {
  onJoin: () => void;
  audience?: AudienceHref | string;
  comparison?: MembershipComparisonContent;
};

function ComparisonCellView({
  cell,
  tone,
}: {
  cell: MembershipComparisonCell;
  tone: "accent" | "muted";
}) {
  if (cell.kind === "check") {
    return (
      <span className={tone === "accent" ? "text-[var(--join-accent-2)]" : "text-[var(--join-muted)]"}>
        <Check className="h-4 w-4" strokeWidth={2.4} aria-label="Included" />
      </span>
    );
  }
  if (cell.kind === "cross") {
    return (
      <span className="text-[var(--join-muted)]/70">
        <X className="h-4 w-4" strokeWidth={2} aria-label="Not included" />
      </span>
    );
  }
  if (cell.kind === "number") {
    return (
      <span
        className={`text-sm font-medium tabular-nums ${
          tone === "accent" ? "text-[var(--join-ink)]" : "text-[var(--join-muted)]"
        }`}
      >
        {cell.value}
        {cell.suffix ?? ""}
      </span>
    );
  }
  return (
    <span
      className={`text-sm ${
        tone === "accent" ? "text-[var(--join-ink)]/90" : "text-[var(--join-muted)]"
      }`}
    >
      {cell.value}
    </span>
  );
}

function ColumnHeading({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <span className="text-center">
      <span className="block font-serif text-base font-medium normal-case tracking-normal text-[var(--join-ink)]">
        {label}
      </span>
      {sublabel ? (
        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--join-muted)]">
          {sublabel}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Membership hero + check/X/number comparison table (audience-aware Affiliate column).
 * CQ Trap 5 fixed: no direct DOM node removal; CSS liquid-glass only (no WebGL).
 * N9: framer `useScroll` (no raw scroll listener).
 */
export function Membership({
  onJoin,
  audience = "#for-individuals",
  comparison = FALLBACK_MEMBERSHIP_COMPARISON,
}: MembershipProps) {
  const reduce = useReducedMotion();
  const photo =
    membershipPhotos[audience as AudienceHref] ?? membershipPhotos["#for-individuals"];
  const showAffiliate = audienceShowsAffiliateColumn(audience);
  const rows = resolveMembershipComparisonRows(comparison, audience);
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [24, -24]);

  const headerGrid = showAffiliate
    ? "grid-cols-[minmax(0,1.4fr)_minmax(4.5rem,1fr)_minmax(3.5rem,0.7fr)_minmax(4.5rem,1fr)] md:grid-cols-[minmax(0,1.6fr)_minmax(5rem,1fr)_minmax(4rem,0.75fr)_minmax(5rem,1fr)]"
    : "grid-cols-[minmax(0,1.4fr)_minmax(4.5rem,1fr)_minmax(3.5rem,0.7fr)] md:grid-cols-[minmax(0,1.6fr)_minmax(5rem,1fr)_minmax(4rem,0.75fr)]";

  const tableLabel = showAffiliate
    ? "MetFix Pro vs Free vs Affiliate membership comparison"
    : "MetFix Pro vs Free membership comparison";

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
            className={`grid ${headerGrid} items-end border-b border-[var(--join-line)] px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--join-muted)] md:px-7 md:py-5`}
            role="row"
          >
            <span>{comparison.featuresLabel}</span>
            <ColumnHeading label={comparison.proLabel} sublabel={comparison.proSublabel} />
            <span className="text-center">{comparison.freeLabel}</span>
            {showAffiliate ? (
              <ColumnHeading
                label={comparison.affiliateLabel}
                sublabel={comparison.affiliateSublabel}
              />
            ) : null}
          </div>
          <table className="w-full border-collapse text-left" aria-label={tableLabel}>
            <thead className="sr-only">
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">{comparison.proLabel}</th>
                <th scope="col">{comparison.freeLabel}</th>
                {showAffiliate ? <th scope="col">{comparison.affiliateLabel}</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={
                    i !== rows.length - 1 ? "border-b border-[var(--join-line)]" : undefined
                  }
                >
                  <th
                    scope="row"
                    className="px-4 py-3.5 text-sm font-normal text-[var(--join-ink)] md:px-7"
                  >
                    {row.feature}
                  </th>
                  <td className="px-2 py-3.5 text-center md:px-4">
                    <span className="inline-flex justify-center">
                      <ComparisonCellView cell={row.pro} tone="accent" />
                    </span>
                  </td>
                  <td className="px-2 py-3.5 text-center md:px-4">
                    <span className="inline-flex justify-center">
                      <ComparisonCellView cell={row.free} tone="muted" />
                    </span>
                  </td>
                  {showAffiliate ? (
                    <td className="px-2 py-3.5 text-center md:px-4">
                      <span className="inline-flex justify-center">
                        <ComparisonCellView cell={row.affiliate ?? { kind: "cross" }} tone="accent" />
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
