import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  audienceLinks,
  type AudienceHref,
} from "@/data/home/audience";

type AudienceTabsProps = {
  audience: AudienceHref;
  onAudienceChange: (href: AudienceHref) => void;
};

export function AudienceTabs({ audience, onAudienceChange }: AudienceTabsProps) {
  const reduceMotion = useReducedMotion();
  const audienceNavRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null);

  const measureAudience = useCallback(() => {
    const nav = audienceNavRef.current;
    const tab = tabRefs.current.get(audience);
    if (!nav || !tab) return;
    setIndicator({ x: tab.offsetLeft, width: tab.offsetWidth });
  }, [audience]);

  useLayoutEffect(() => {
    measureAudience();
  }, [measureAudience]);

  useEffect(() => {
    const nav = audienceNavRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => measureAudience());
    observer.observe(nav);
    return () => observer.disconnect();
  }, [measureAudience]);

  useEffect(() => {
    const tab = tabRefs.current.get(audience);
    tab?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [audience, reduceMotion]);

  const focusTab = (href: AudienceHref) => {
    tabRefs.current.get(href)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      next = (index + 1) % audienceLinks.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      next = (index - 1 + audienceLinks.length) % audienceLinks.length;
    } else if (event.key === "Home") {
      event.preventDefault();
      next = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      next = audienceLinks.length - 1;
    } else {
      return;
    }
    const href = audienceLinks[next].href;
    onAudienceChange(href);
    focusTab(href);
  };

  return (
    <div className="audience-bar surface-ink sticky top-14 z-40 flex items-end bg-ink pl-2 pr-4 pt-2.5 md:top-16 md:pl-3 md:pr-5 lg:pl-4 lg:pr-6">
      <nav
        ref={audienceNavRef}
        className="relative flex min-w-0 flex-1 items-end gap-1 overflow-x-auto pl-6 scrollbar-hide md:pl-7"
        aria-label="Audiences"
        role="tablist"
      >
        {indicator ? (
          <motion.span
            aria-hidden="true"
            className="audience-tab-indicator"
            initial={false}
            animate={{ x: indicator.x, width: indicator.width }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 36, mass: 0.75 }
            }
          />
        ) : null}
        {audienceLinks.map((link, index) => {
          const isActive = link.href === audience;
          return (
            <button
              key={link.href}
              type="button"
              ref={(node) => {
                if (node) tabRefs.current.set(link.href, node);
                else tabRefs.current.delete(link.href);
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onAudienceChange(link.href)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={`audience-tab relative z-10 shrink-0 whitespace-nowrap px-3.5 py-2 text-[12px] transition-colors duration-200 ease-out md:px-4 md:py-2.5 md:text-[13px] ${
                isActive
                  ? "audience-tab-active font-semibold text-ink delay-150"
                  : "font-medium text-cream/70 delay-75 hover:text-cream"
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>
      <div className="mb-2 ml-3 flex shrink-0 items-center gap-3 pl-4 md:mb-2.5 md:pl-5">
        <span className="h-4 w-px bg-white/25" aria-hidden="true" />
        <a
          href="https://brokenscience.org/shop/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold leading-none text-white transition-colors duration-300 ease-out hover:text-cream md:text-[13px]"
        >
          Shop
        </a>
      </div>
    </div>
  );
}
