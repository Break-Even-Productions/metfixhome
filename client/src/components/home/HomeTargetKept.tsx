import { CmsLink } from "@/components/CmsLink";
import { HighlightedHeadlineText } from "@/lib/highlightedText";
import type { HomePageContent } from "@/lib/homeTypes";
import { Reveal } from "./Reveal";

type HomeTargetKeptProps = {
  home: HomePageContent;
};

/**
 * Kept target-only sections restyled to beta tokens (LR-14 / P-E-17).
 * Order: impact → playbook → affiliation → about → gap → network.
 * Placed after Testimonials, before FAQ.
 */
export function HomeTargetKept({ home }: HomeTargetKeptProps) {
  return (
    <>
      <section id="impact" className="kept-section">
        <div className="kept-container">
          <Reveal>
            <p className="kept-kicker">{home.problem.eyebrow}</p>
            <p className="kept-quote">{home.problem.quote}</p>
            <p className="kept-body">
              {home.problem.sourceText}
              <a
                href={home.problem.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2"
              >
                {home.problem.sourceLinkLabel}
              </a>
              )
            </p>
            <p className="kept-stat mt-8">130+</p>
            <p className="kept-body">Affiliate gyms in year one preventing and reversing chronic disease.</p>
          </Reveal>
        </div>
      </section>

      <section id="playbook" className="kept-section">
        <div className="kept-container text-center">
          <Reveal>
            <p className="kept-kicker">{home.playbook.eyebrow}</p>
            <h2 className="kept-title">
              <HighlightedHeadlineText headline={home.playbook.headline} />
            </h2>
            <CmsLink cta={home.playbook.cta} className="kept-cta" />
          </Reveal>
        </div>
      </section>

      <section id="affiliation" className="kept-section">
        <div className="kept-container">
          <div className="kept-grid">
            <Reveal>
              <p className="kept-kicker">{home.affiliation.eyebrow}</p>
              <h2 className="kept-title">
                <HighlightedHeadlineText headline={home.affiliation.headline} />
              </h2>
              <p className="kept-body">{home.affiliation.body}</p>
              <p className="kept-body">{home.affiliation.supportingText}</p>
              <div className="mb-6 inline-flex items-baseline gap-2 rounded-full border border-line-light px-4 py-2">
                <span className="font-serif text-2xl text-accent">{home.affiliation.monthlyPrice}</span>
                <span className="text-xs uppercase tracking-[0.12em] text-cream/55">
                  {home.affiliation.priceNote}
                </span>
              </div>
              <ul className="kept-list mb-8">
                {home.affiliation.benefits.map((item) => (
                  <li key={item}>
                    <span className="text-accent" aria-hidden="true">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <CmsLink cta={home.affiliation.primaryCta} className="kept-cta" />
                <CmsLink
                  cta={home.affiliation.secondaryCta}
                  className="kept-cta !bg-transparent !text-cream border border-line-light"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="about" className="kept-section">
        <div className="kept-container">
          <Reveal>
            <p className="kept-kicker">{home.whyDifferent.eyebrow}</p>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line-light pb-6">
              <h2 className="kept-title mb-0">{home.whyDifferent.names}</h2>
              <p className="max-w-xs whitespace-pre-line text-right text-xs uppercase tracking-[0.14em] text-accent">
                {home.whyDifferent.roles}
              </p>
            </div>
            <div className="kept-grid">
              <div className="relative min-h-[20rem] overflow-hidden rounded-[1.35rem]">
                <img
                  src={home.whyDifferent.photoUrl || "/founders.png"}
                  alt={home.whyDifferent.names}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div>
                <blockquote className="kept-quote">{home.whyDifferent.quote}</blockquote>
                <p className="mt-2 text-sm text-cream/55">
                  {home.whyDifferent.quoteAttribution} · {home.whyDifferent.quoteRole}
                </p>
                {home.whyDifferent.body.map((para) => (
                  <p key={para.slice(0, 24)} className="kept-body">
                    {para}
                  </p>
                ))}
                <CmsLink cta={home.whyDifferent.link} className="kept-cta" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="gap" className="kept-section">
        <div className="kept-container">
          <div className="kept-grid">
            <Reveal>
              <p className="kept-kicker">{home.gap.eyebrow}</p>
              <h2 className="kept-title">
                <HighlightedHeadlineText headline={home.gap.headline} />
              </h2>
              <p className="kept-body">{home.gap.body}</p>
              <CmsLink cta={home.gap.cta} className="kept-cta" />
            </Reveal>
            <Reveal>
              <p className="kept-kicker">{home.gap.listLabel}</p>
              <ul className="kept-list">
                {home.gap.statusQuoItems.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true">×</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="kept-quote mt-6">{home.gap.closingQuote}</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="network" className="kept-section">
        <div className="kept-container">
          <div className="kept-grid">
            <Reveal>
              <p className="kept-kicker">{home.network.eyebrow}</p>
              <h2 className="kept-title">
                <HighlightedHeadlineText headline={home.network.headline} />
              </h2>
              <p className="kept-body">{home.network.body}</p>
              <CmsLink cta={home.network.cta} className="kept-cta" />
            </Reveal>
            <Reveal>
              <div className="kept-pin-grid">
                {home.network.featuredLocations.slice(0, 8).map((pin, i) => (
                  <div key={`${pin.name}-${i}`} className="kept-pin">
                    <div className="kept-pin-city">{pin.city}</div>
                    <div className="kept-pin-name">{pin.name}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
