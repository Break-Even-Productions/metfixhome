/**
 * MetFix home — beta composition port (PR E).
 * Order: Hero → Classes → Membership → [Foundations coaches] → Experts → Resources
 * → Testimonials → kept target sections → FAQ → Footer newsletter.
 */
import { Membership } from "@/components/Membership";
import { SiteFooter } from "@/components/SiteFooter";
import { AudienceTabs } from "@/components/home/AudienceTabs";
import { HomeClasses } from "@/components/home/HomeClasses";
import { HomeExperts } from "@/components/home/HomeExperts";
import { HomeFaq } from "@/components/home/HomeFaq";
import { HomeFoundations } from "@/components/home/HomeFoundations";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeResources } from "@/components/home/HomeResources";
import { HomeTargetKept } from "@/components/home/HomeTargetKept";
import { HomeTestimonials } from "@/components/home/HomeTestimonials";
import "@/components/home/home.css";
import { useJoinFlowOptional } from "@/contexts/JoinFlowContext";
import {
  audienceFromHash,
  audienceTheme,
  DEFAULT_AUDIENCE,
  landingCopyFor,
  LEGACY_HOME_ANCHORS,
  type AudienceHref,
} from "@/data/home/audience";
import { expertsFor } from "@/data/home/experts";
import { faqsFor } from "@/data/home/faqs";
import { HOME_CANONICAL, metaForAudience } from "@/data/home/meta";
import { basePath, HOME_SCROLL_KEY, scrollToHomeSection } from "@/const";
import { useHomeContent } from "@/hooks/useSanityContent";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useCallback, useEffect, useMemo, useState } from "react";

function readAudience(): AudienceHref {
  if (typeof window === "undefined") return DEFAULT_AUDIENCE;
  return audienceFromHash(window.location.hash) ?? DEFAULT_AUDIENCE;
}

function resolveScrollTarget(raw: string): string | null {
  const key = raw.replace(/^#/, "");
  if (LEGACY_HOME_ANCHORS[key]) return LEGACY_HOME_ANCHORS[key];
  if (document.getElementById(key)) return key;
  return null;
}

export default function Home() {
  const [audience, setAudience] = useState<AudienceHref>(() => readAudience());
  const { home, homeCourses, faqs: sanityFaqs } = useHomeContent();
  const joinFlow = useJoinFlowOptional();
  const copy = useMemo(() => landingCopyFor(audience), [audience]);
  const meta = useMemo(() => metaForAudience(audience), [audience]);
  const theme = audienceTheme[audience];
  const expertList = useMemo(() => expertsFor(audience), [audience]);
  const faqList = useMemo(() => faqsFor(audience), [audience]);
  const showFoundations = audience === "#for-coaches";

  usePageMeta({
    title: meta.title,
    description: meta.description,
    canonical: HOME_CANONICAL,
    robots: "index, follow",
    ogType: "website",
    ogUrl: HOME_CANONICAL,
  });

  useEffect(() => {
    const onHash = () => setAudience(readAudience());
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const pending = sessionStorage.getItem(HOME_SCROLL_KEY);
    if (pending) {
      sessionStorage.removeItem(HOME_SCROLL_KEY);
      const target = resolveScrollTarget(pending);
      requestAnimationFrame(() => {
        if (target) scrollToHomeSection(target);
        else window.scrollTo({ top: 0 });
      });
      return;
    }
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || hash.startsWith("for-")) return;
    const target = resolveScrollTarget(hash);
    requestAnimationFrame(() => {
      if (target) scrollToHomeSection(target);
    });
  }, []);

  const onJoin = useCallback(() => {
    if (joinFlow) joinFlow.openJoinFlow();
    else window.location.assign(basePath("/join"));
  }, [joinFlow]);

  const onAudienceChange = useCallback((href: AudienceHref) => {
    setAudience(href);
    window.history.replaceState(null, "", href === DEFAULT_AUDIENCE ? "/" : href);
  }, []);

  const membershipAudience =
    audience === "#for-coaches"
      ? "coaches"
      : audience === "#for-clinicians"
        ? "clinicians"
        : "default";

  return (
    <div className="home-root pt-14 md:pt-16" data-theme={theme}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <div className="grain" aria-hidden="true" />
      <AudienceTabs audience={audience} onAudienceChange={onAudienceChange} />
      <main id="main" className="page-stack">
        <HomeHero onJoin={onJoin} copy={copy} audience={audience} />
        <HomeClasses onJoin={onJoin} courses={homeCourses} />
        <section id="membership-section" className="section-card bg-paper">
          <div className="px-3 py-4 md:px-4 md:py-5">
            <Membership onJoin={onJoin} audience={membershipAudience} />
          </div>
        </section>
        {showFoundations ? <HomeFoundations foundations={home.foundations} /> : null}
        <HomeExperts experts={expertList} />
        <HomeResources title={copy.resourcesTitle} resourceLibrary={home.resourceLibrary} />
        <HomeTestimonials copy={copy} audience={audience} />
        <HomeTargetKept home={home} />
        <HomeFaq faqs={faqList} sanityFaqs={sanityFaqs} />
      </main>
      {/* P-E-15c' / LR-E7: footer is sibling of main, not a descendant */}
      <SiteFooter
        showNewsletter
        onJoin={onJoin}
        newsletterTitle={home.weekly.headline.text.replace(/\n/g, " ")}
      />
    </div>
  );
}
