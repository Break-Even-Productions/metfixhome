import { motion, useReducedMotion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  audienceLinks,
  type AudienceHref,
} from "@/data/home/audience";

type AudienceTabsProps = {
  audience: AudienceHref;
  onAudienceChange: (href: AudienceHref) => void;
  /** Sign-in href for the strip (design: right of Shop). */
  loginHref?: string;
};

export function AudienceTabs({ audience, onAudienceChange, loginHref }: AudienceTabsProps) {
  const reduceMotion = useReducedMotion();
  const audienceNavRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });

  const measureAudience = useCallback(() => {
    const nav = audienceNavRef.current;
    const tab = tabRefs.current.get(audience);
    if (!nav || !tab) return;
    setIndicator({ x: tab.offsetLeft, width: tab.offsetWidth });
  }, [audience]);

  const updateScrollEdges = useCallback(() => {
    const nav = audienceNavRef.current;
    if (!nav) return;
    const maxScroll = nav.scrollWidth - nav.clientWidth;
    if (maxScroll <= 1) {
      setScrollEdges({ left: false, right: false });
      return;
    }
    setScrollEdges({
      left: nav.scrollLeft > 1,
      right: nav.scrollLeft < maxScroll - 1,
    });
  }, []);

  useLayoutEffect(() => {
    measureAudience();
    updateScrollEdges();
  }, [measureAudience, updateScrollEdges]);

  useEffect(() => {
    const nav = audienceNavRef.current;
    if (!nav) return;
    const refresh = () => {
      measureAudience();
      updateScrollEdges();
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(nav);
    for (const child of nav.children) observer.observe(child);
    nav.addEventListener("scroll", updateScrollEdges, { passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      observer.disconnect();
      nav.removeEventListener("scroll", updateScrollEdges);
      window.removeEventListener("resize", refresh);
    };
  }, [measureAudience, updateScrollEdges]);

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
    <div className="audience-bar surface-ink flex items-end bg-ink pl-2 pr-4 pt-2.5 md:pl-3 md:pr-5 lg:pl-4 lg:pr-6">
      <div
        className="audience-scroll relative min-w-0 flex-1"
        data-fade-left={scrollEdges.left ? "true" : undefined}
        data-fade-right={scrollEdges.right ? "true" : undefined}
      >
        <nav
          ref={audienceNavRef}
          className="relative flex items-end gap-1 overflow-x-auto pl-6 scrollbar-hide md:pl-7"
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
        <span className="audience-scroll-mist audience-scroll-mist--left" aria-hidden="true" />
        <span className="audience-scroll-mist audience-scroll-mist--right" aria-hidden="true" />
      </div>
      <div className="mb-2 ml-3 flex shrink-0 items-center gap-3 pl-4 md:mb-2.5 md:pl-5">
        <span className="h-4 w-px bg-white/25" aria-hidden="true" />
        <a
          href="https://brokenscience.org/shop/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold leading-none text-white transition-colors duration-300 ease-out hover:text-cream md:text-[13px]"
        >
          <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.2} />
          Shop
        </a>
        {loginHref ? (
          <Link
            href={loginHref}
            className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-[12px] font-semibold leading-none text-ink transition-colors duration-300 ease-out hover:bg-cream md:px-5 md:text-[13px]"
            data-nav-auth="login"
          >
            Sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
