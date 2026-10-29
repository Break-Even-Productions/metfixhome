import { LazyMotion, AnimatePresence, domAnimation, m } from "framer-motion";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Faq } from "@/data/home/faqs";
import type { HomeFaq as SanityFaq } from "@/lib/homeTypes";
import { easeOutExpo } from "./motion";
import { Reveal } from "./Reveal";
import { SectionCard, SectionPad } from "./SectionCard";

type HomeFaqProps = {
  faqs: readonly Faq[];
  sanityFaqs?: SanityFaq[];
};

export function HomeFaq({ faqs, sanityFaqs }: HomeFaqProps) {
  const [open, setOpen] = useState<number | null>(0);

  const items: Faq[] = useMemo(() => {
    if (faqs.length > 0) return [...faqs];
    return (sanityFaqs ?? []).map((f) => ({ q: f.question, a: f.answer }));
  }, [faqs, sanityFaqs]);

  const jsonLd = useMemo(() => {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    };
  }, [items]);

  return (
    <LazyMotion features={domAnimation} strict>
      <SectionCard id="faq" tone="ink">
        <SectionPad>
          <Reveal className="flex items-end justify-between gap-4">
            <h2 className="font-serif text-3xl md:text-[2.6rem]">Frequently Asked Questions</h2>
            <a
              href="#faq"
              className="hidden items-center gap-1 text-sm text-cream/75 transition-colors duration-300 ease-out hover:text-cream sm:inline-flex"
            >
              View All FAQs
              <span aria-hidden="true">↓</span>
            </a>
          </Reveal>

          <div className="mt-10 divide-y divide-line-light border-t border-line-light">
            {items.map((item, i) => {
              const isOpen = open === i;
              const panelId = `faq-panel-${i}`;
              const buttonId = `faq-button-${i}`;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left transition-colors duration-300 ease-out"
                  >
                    <span className="font-serif text-xl text-cream md:text-[1.45rem]">{item.q}</span>
                    <m.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cream/80"
                    >
                      <Plus className="h-5 w-5" />
                    </m.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <m.div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: easeOutExpo }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-3xl pb-6 text-sm leading-relaxed text-cream/65 md:text-[15px]">
                          {item.a}
                        </p>
                      </m.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </SectionPad>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </SectionCard>
    </LazyMotion>
  );
}
