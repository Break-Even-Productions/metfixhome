import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "wouter";
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

const ORG_FILLOUT_SCRIPT_SRC = "https://server.fillout.com/embed/v1/";
const ORG_FILLOUT_SCRIPT_ATTR = "data-mfx-fillout-embed";
const ORG_FILLOUT_FORM_ID = "m7qTgWE2S6us";
const ORG_FILLOUT_DOMAIN = "forms.metfix.org";

function ensureFilloutScript(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[${ORG_FILLOUT_SCRIPT_ATTR}]`)) return;
  const script = document.createElement("script");
  script.src = ORG_FILLOUT_SCRIPT_SRC;
  script.async = true;
  script.setAttribute(ORG_FILLOUT_SCRIPT_ATTR, "1");
  document.body.appendChild(script);
}

function OrganizationsFilloutEmbed() {
  useEffect(() => {
    ensureFilloutScript();
  }, []);

  return (
    <div
      className="w-full"
      style={{ width: "100%", minHeight: 500 }}
      data-fillout-id={ORG_FILLOUT_FORM_ID}
      data-fillout-embed-type="standard"
      data-fillout-inherit-parameters=""
      data-fillout-dynamic-resize=""
      data-fillout-domain={ORG_FILLOUT_DOMAIN}
      data-testid="organizations-fillout-embed"
    />
  );
}

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
    const label = cell.note ? `Included — ${cell.note}` : "Included";
    return (
      <span
        className={`inline-flex items-start gap-0.5 ${
          tone === "accent" ? "text-[var(--join-accent-2)]" : "text-[var(--join-muted)]"
        }`}
        title={cell.note}
        aria-label={label}
      >
        <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
        {cell.note ? (
          <sup className="text-[10px] font-semibold leading-none text-[var(--join-muted)]">*</sup>
        ) : null}
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
  const showOrganizationsForm = audience === "#for-organizations";
  const showAffiliate = !showOrganizationsForm && audienceShowsAffiliateColumn(audience);
  const rows = resolveMembershipComparisonRows(comparison, audience);
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [24, -24]);

  const tableLabel = showAffiliate
    ? "MetFix Pro vs Free vs Affiliate membership comparison"
    : "MetFix Pro vs Free membership comparison";

  const colHeadClass =
    "px-2 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--join-muted)] md:px-4 md:py-5";
  const colLabelClass =
    "block font-serif text-base font-medium normal-case tracking-normal text-[var(--join-ink)]";

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
          <div className="membership-glass absolute inset-0 z-10 flex flex-col justify-center rounded-[1.75rem] md:rounded-[2.5rem]">
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
        {showOrganizationsForm ? (
          <div className="h-full overflow-hidden rounded-[1.5rem] bg-[var(--join-paper)] p-2 md:rounded-[1.85rem] md:p-3">
            <OrganizationsFilloutEmbed />
          </div>
        ) : (
          <div className="flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-[var(--join-paper)] md:rounded-[1.85rem]">
            <table className="w-full border-collapse text-left" aria-label={tableLabel}>
              <thead>
                <tr className="border-b border-[var(--join-line)]">
                  <th
                    scope="col"
                    className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--join-muted)] md:px-7 md:py-5"
                  >
                    {comparison.featuresLabel}
                  </th>
                  <th scope="col" className={colHeadClass}>
                    <span className={colLabelClass}>{comparison.proLabel}</span>
                  </th>
                  <th scope="col" className={colHeadClass}>
                    <span className={colLabelClass}>{comparison.freeLabel}</span>
                  </th>
                  {showAffiliate ? (
                    <th scope="col" className={colHeadClass}>
                      <span className={colLabelClass}>{comparison.affiliateLabel}</span>
                    </th>
                  ) : null}
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
                          <ComparisonCellView
                            cell={row.affiliate ?? { kind: "cross" }}
                            tone="accent"
                          />
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              className={`mt-auto flex flex-col gap-2 border-t border-[var(--join-line)] px-4 py-4 sm:flex-row sm:items-center md:px-7 md:py-5 ${
                showAffiliate ? "sm:justify-between" : "sm:justify-end"
              }`}
            >
              <button
                type="button"
                onClick={onJoin}
                className="inline-flex items-center justify-center rounded-full bg-[var(--join-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--join-ink)] transition-[background-color,transform] duration-300 ease-out hover:-translate-y-px hover:bg-[var(--join-accent-2)]"
              >
                {comparison.proCtaLabel}
              </button>
              {showAffiliate ? (
                <Link
                  href={comparison.affiliateCtaHref}
                  className="inline-flex items-center justify-center rounded-full border border-[var(--join-ink)]/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-[var(--join-ink)] transition-[background-color,transform] duration-300 ease-out hover:-translate-y-px hover:bg-[var(--join-cream)]"
                >
                  {comparison.affiliateCtaLabel}
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
