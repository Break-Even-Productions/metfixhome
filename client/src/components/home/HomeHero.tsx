import { motion, useReducedMotion } from "framer-motion";
import { Dumbbell, Library, Mail, UtensilsCrossed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { METFIX_MAP_URL } from "@/const";
import type { AudienceHref, LandingCopy } from "@/data/home/audience";
import { shouldSkipProRecommendation } from "@/join/membership-access";
import { loadOverview, loadSubscriptions } from "@/lib/account";
import { loadMe } from "@/lib/session";
import { AppleIcon, GoogleIcon } from "./AuthProviderIcons";
import { AsteriskFallback, useHomeHeroGlass } from "./HomeHeroGlass";
import { easeOutExpo } from "./motion";
import { SectionCard } from "./SectionCard";

type HomeHeroProps = {
  onJoin: () => void;
  copy: LandingCopy;
  audience: AudienceHref;
};

const heroPhotos: Record<AudienceHref, string> = {
  "#for-individuals": "/hero/for-individuals.jpg",
  "#for-athletes": "/hero/for-athletes.jpg",
  "#for-coaches": "/hero/for-coaches.jpg",
  "#for-gym-owners": "/hero/for-gym-owners.jpg",
  "#for-first-responders": "/hero/for-first-responders.jpg",
  "#for-clinicians": "/hero/for-clinicians.jpg",
  "#for-organizations": "/hero/for-organizations.jpg",
};

const primaryLinkClass =
  "mt-3 block w-full rounded-full bg-accent py-2.5 text-center text-sm font-semibold text-ink shadow-[0_8px_24px_color-mix(in_srgb,var(--color-accent-2)_35%,transparent)] transition-[background-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:bg-accent-2 hover:shadow-[0_14px_32px_color-mix(in_srgb,var(--color-accent-2)_48%,transparent)] active:translate-y-0";

const whiteButtonClass =
  "flex w-full items-center justify-center gap-2.5 rounded-full border border-line bg-white py-2.5 text-sm font-medium text-ink shadow-[0_1px_0_rgba(23,21,18,0.04)] transition-[background-color,box-shadow,transform,border-color] duration-300 ease-out hover:-translate-y-px hover:border-ink/15 hover:bg-cream hover:shadow-[0_8px_20px_rgba(23,21,18,0.08)] active:translate-y-0";

type HeroDestination = {
  href: string;
  label: string;
};

function HeroDestinationLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: string;
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function SignedInHeroCard({ hasMembership }: { hasMembership: boolean }) {
  const primary: HeroDestination = hasMembership
    ? { href: "/account", label: "View Dashboard" }
    : { href: "#membership-section", label: "Join MetFix Pro" };
  const secondary: HeroDestination[] = hasMembership
    ? [
        { href: "/library", label: "Explore Resource Library" },
        { href: "/classes", label: "Take Classes" },
      ]
    : [
        { href: "/account", label: "View Dashboard" },
        { href: "/library", label: "Explore Resource Library" },
        { href: "/classes", label: "Take Classes" },
      ];
  return (
    <>
      <h2 className="font-serif text-[1.45rem] leading-tight text-ink md:text-[1.55rem]">Welcome back</h2>
      <HeroDestinationLink href={primary.href} className={primaryLinkClass}>
        {primary.label}
      </HeroDestinationLink>
      <nav className="mt-2 flex flex-col gap-2" aria-label="Your MetFix">
        {secondary.map((item) => (
          <HeroDestinationLink key={item.href} href={item.href} className={whiteButtonClass}>
            {item.label}
          </HeroDestinationLink>
        ))}
      </nav>
    </>
  );
}

const overlayLinks = [
  {
    href: "#classes",
    title: "Free resources",
    subtitle: "Recipes, workouts & more",
    icon: UtensilsCrossed,
    external: false,
  },
  {
    href: METFIX_MAP_URL,
    title: "Find a Gym",
    subtitle: "Local, trusted options",
    icon: Dumbbell,
    external: true,
  },
  {
    href: "/library",
    title: "Resource Library",
    subtitle: "Articles, videos & briefs",
    icon: Library,
    external: false,
  },
] as const;

export function HomeHero({ onJoin, copy, audience }: HomeHeroProps) {
  const photoSrc = heroPhotos[audience];
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const glassReady = useHomeHeroGlass(heroRef, barRef, markRef, photoSrc);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [hasMembership, setHasMembership] = useState(false);
  const [membershipKnown, setMembershipKnown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadMe().then(async (me) => {
      if (cancelled) return;
      if (me.status !== "signed_in") {
        setSignedIn(false);
        setHasMembership(false);
        setMembershipKnown(true);
        return;
      }
      setSignedIn(true);
      const [subsResult, overviewResult] = await Promise.allSettled([
        loadSubscriptions({ force: true }),
        loadOverview({ force: true }),
      ]);
      if (cancelled) return;
      const subs = subsResult.status === "fulfilled" ? subsResult.value : null;
      const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
      setHasMembership(shouldSkipProRecommendation(subs, overview));
      setMembershipKnown(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const accountReady = signedIn === false || (signedIn === true && membershipKnown);

  return (
    <SectionCard className="hero-viewport">
      <div className="relative flex h-full min-h-0 flex-col lg:block lg:h-auto lg:min-h-[calc(100svh-10rem)]">
        {/*
          Glass root: mark + bar must be direct children (LiquidGlass skips nested).
          Photo is also a direct child; copy stays outside so mobile stacks cleanly.
        */}
        <div
          ref={heroRef}
          className={`relative min-h-[18rem] sm:min-h-[22rem] lg:absolute lg:inset-0 lg:min-h-0${glassReady ? " is-glass" : ""}`}
        >
          <motion.div
            className="absolute inset-0 overflow-hidden"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.1, ease: easeOutExpo, delay: 0.08 }}
          >
            <img
              key={photoSrc}
              src={photoSrc}
              alt=""
              width={1600}
              height={1067}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-[68%_center] lg:object-[62%_center]"
            />
            <div
              className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-paper from-[26%] via-paper/80 via-[38%] to-transparent to-[54%] lg:block"
              aria-hidden="true"
            />
          </motion.div>

          <div
            ref={markRef}
            className="masthead-mark"
            data-config='{"shape":1}'
            role="img"
            aria-label="MetFix"
          >
            {glassReady ? null : <AsteriskFallback />}
          </div>

          <nav
            ref={barRef}
            className="masthead-bar surface-ink absolute inset-x-5 bottom-10 z-20 grid grid-cols-1 divide-y divide-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
            aria-label="Quick links"
          >
            {overlayLinks.map((item) => {
              const Icon = item.icon;
              const className =
                "relative z-[2] flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-300 ease-out hover:bg-white/10 sm:justify-center sm:px-6 sm:py-4 lg:justify-start lg:px-8";
              const inner = (
                <>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-accent-3 bg-black text-accent-3">
                    <Icon className="h-5 w-5" strokeWidth={2.35} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold leading-tight text-cream">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-bold leading-snug text-cream/85">
                      {item.subtitle}
                    </span>
                  </span>
                </>
              );
              if (item.external) {
                return (
                  <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {inner}
                  </a>
                );
              }
              if (item.href.startsWith("#")) {
                return (
                  <a key={item.title} href={item.href} className={className}>
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={item.title} href={item.href} className={className}>
                  {inner}
                </Link>
              );
            })}
          </nav>
        </div>

        <motion.div
          className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-6 py-8 md:px-10 md:py-10 lg:min-h-[calc(100svh-10rem)] lg:max-w-[40rem] lg:flex-none lg:px-12 lg:pt-10 lg:pb-36"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easeOutExpo }}
        >
          <h1 className="font-serif text-[2.15rem] font-medium leading-[1.08] tracking-[-0.02em] text-ink sm:text-[2.45rem] md:text-[2.75rem] lg:text-[2.9rem]">
            {copy.heroLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted md:text-[15px]">
            {copy.heroSubtitle}
          </p>

          <motion.div
            className="join-card relative mt-5 w-full max-w-none rounded-[1.35rem] md:mt-6"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.18, ease: easeOutExpo }}
          >
            <span className="join-card-aura" aria-hidden="true" />
            <span className="join-card-sheen" aria-hidden="true" />
            <div className="relative z-[1] rounded-[1.35rem] border border-line bg-white px-5 py-4 shadow-[0_18px_40px_rgba(23,21,18,0.08)] md:px-5 md:py-5">
              {accountReady && signedIn ? (
                <SignedInHeroCard hasMembership={hasMembership} />
              ) : accountReady ? (
                <>
                  <h2 className="font-serif text-[1.45rem] leading-tight text-ink md:text-[1.55rem]">
                    Join Today — 1 Month Free
                  </h2>
                  <button
                    type="button"
                    onClick={onJoin}
                    className="mt-3 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-ink shadow-[0_8px_24px_color-mix(in_srgb,var(--color-accent-2)_35%,transparent)] transition-[background-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:bg-accent-2 hover:shadow-[0_14px_32px_color-mix(in_srgb,var(--color-accent-2)_48%,transparent)] active:translate-y-0"
                  >
                    Get Started
                  </button>
                  <button type="button" onClick={onJoin} className={`mt-2 ${whiteButtonClass}`}>
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  <button type="button" onClick={onJoin} className={`mt-2 ${whiteButtonClass}`}>
                    <AppleIcon />
                    Continue with Apple
                  </button>
                  <button type="button" onClick={onJoin} className={`mt-2 ${whiteButtonClass}`}>
                    <Mail className="h-4 w-4" strokeWidth={1.8} />
                    Continue with Email
                  </button>
                  <p className="mt-3 text-[11px] leading-relaxed text-muted">
                    By joining, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted" aria-busy="true">
                  Loading your account…
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </SectionCard>
  );
}
