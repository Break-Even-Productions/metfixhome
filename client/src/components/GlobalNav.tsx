/**
 * GlobalNav — cream primary bar with For-X audience strip above (home).
 * Search is an icon that opens a modal; submit → /library/search?query=.
 */
import {
  assetUrl,
  getMetfixLoginUrl,
  requestHomeScroll,
  scrollToHomeSection,
  SEARCH_HREF,
} from "@/const";
import { AudienceTabs } from "@/components/home/AudienceTabs";
import "@/components/home/home.css";
import {
  linksForMega,
  megaKindForLabel,
  NAV_HOST_SEMINAR,
  NAV_SEE_ALL_COURSES,
  NavMegaPanel,
  type NavMegaKind,
  type NavMegaLink,
} from "@/components/NavMega";
import { NavSearchModal } from "@/components/NavSearchModal";
import { useJoinFlowOptional } from "@/contexts/JoinFlowContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useSiteSettings } from "@/hooks/useSiteContent";
import {
  audienceFromHash,
  audienceTheme,
  DEFAULT_AUDIENCE,
  type AudienceHref,
} from "@/data/home/audience";
import { DEFAULT_NAV_LINKS, type NavLink } from "@/lib/contentTypes";
import { expectedSearchHrefFromApp } from "@/style-parity/searchHref";
import { loadMe } from "@/lib/session";
import { sanitizeReturnPath } from "@shared/account/returnPath";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import "./global-nav.css";

const ALLOWED_EXTERNAL_HOSTS = ["whatis.metfix.org", "brokenscience.org"] as const;

/** F1-owned search href resolver (ER-11 / ER-14). */
export const resolveSearchHref = expectedSearchHrefFromApp;
/** Re-export for callers/tests that import from GlobalNav. */
export { SEARCH_HREF };
/** Alias for tests / callers expecting GLOBAL_NAV_SEARCH_HREF. */
export const GLOBAL_NAV_SEARCH_HREF = SEARCH_HREF;

const DROPPED_NAV_LABELS = new Set([
  "find a doctor",
  "partner with us",
  "build a gym",
  "our team",
  "advisory board",
  "scholarship",
  "host a seminar",
  "team seminar",
  // Shop lives on the audience strip (home) / mobile actions.
  "shop",
]);

function homeHashSection(href: string): string | null {
  const match = href.match(/^(?:https?:\/\/[^/]+)?\/?#([\w-]+)$/);
  return match?.[1] ?? null;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href) || href.startsWith("mailto:");
}

function isAllowedNavHref(href: string): boolean {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    const url = new URL(href);
    return ALLOWED_EXTERNAL_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

function loginHrefForLocation(pathname: string, search: string): string {
  const candidate = `${pathname}${search}`;
  const safe = sanitizeReturnPath(candidate) ?? "/";
  return getMetfixLoginUrl(safe);
}

function isActiveRoute(location: string, href: string): boolean {
  if (isExternalHref(href) || href.startsWith("/#") || href.startsWith("#")) return false;
  const path = href.split("?")[0];
  if (path === "/") return location === "/" || location === "";
  return location === path || location.startsWith(`${path}/`);
}

function audienceFromNavHref(href: string): AudienceHref | null {
  const match = href.match(/^(?:https?:\/\/[^/]+)?\/?(#for-[\w-]+)$/);
  return match?.[1] ? audienceFromHash(match[1]) : null;
}

type NavItemOptions = {
  children?: ReactNode;
  chevron?: boolean;
  expanded?: boolean;
  controls?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
};

function readAudience(): AudienceHref {
  if (typeof window === "undefined") return DEFAULT_AUDIENCE;
  return audienceFromHash(window.location.hash) ?? DEFAULT_AUDIENCE;
}

/** §3a nav list — dropped beta items removed. */
export function navLinksFromSettings(links: readonly NavLink[] | undefined): NavLink[] {
  const source = links && links.length > 0 ? links : DEFAULT_NAV_LINKS;
  return [...source].filter(
    (link) =>
      isAllowedNavHref(link.href) && !DROPPED_NAV_LABELS.has(link.label.toLowerCase()),
  );
}

/** Exported for T-E-NAV-1 route checks. */
export const GLOBAL_NAV_ITEMS: NavLink[] = navLinksFromSettings([...DEFAULT_NAV_LINKS]);

export default function GlobalNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState<NavMegaKind | null>(null);
  const [mobileMega, setMobileMega] = useState<NavMegaKind | null>(null);
  const megaTimer = useRef<number | null>(null);
  const [audience, setAudience] = useState<AudienceHref>(() => readAudience());
  const [location, setLocation] = useLocation();
  const { settings } = useSiteSettings();
  const navLinks = navLinksFromSettings(settings.navLinks);
  const joinFlow = useJoinFlowOptional();
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const onHome = location === "/" || location === "";
  const [accountName, setAccountName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadMe().then((me) => {
      if (cancelled) return;
      setAccountName(me.status === "signed_in" ? me.public_name : null);
    });
    return () => {
      cancelled = true;
    };
  }, [location]);

  useBodyScrollLock(mobileOpen);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      setMega(null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMobileMega(null);
    setMega(null);
    setSearchOpen(false);
  }, [location]);

  useEffect(
    () => () => {
      if (megaTimer.current !== null) window.clearTimeout(megaTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!mega) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMega(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mega]);

  useEffect(() => {
    const onHash = () => setAudience(readAudience());
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const panel = mobilePanelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const onAudienceChange = useCallback((href: AudienceHref) => {
    setAudience(href);
    const next = href === DEFAULT_AUDIENCE ? "/" : href;
    window.history.replaceState(null, "", next);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  const goToHomeSection = (sectionId: string, closeMenu?: () => void) => {
    closeMenu?.();
    if (onHome) {
      scrollToHomeSection(sectionId);
    } else {
      requestHomeScroll(sectionId);
      setLocation("/");
    }
  };

  const openJoin = () => {
    setMobileOpen(false);
    if (joinFlow) joinFlow.openJoinFlow();
    else window.location.assign("/join");
  };

  const openSearch = () => {
    setMobileOpen(false);
    setMega(null);
    setSearchOpen(true);
  };

  const clearMegaTimer = () => {
    if (megaTimer.current !== null) {
      window.clearTimeout(megaTimer.current);
      megaTimer.current = null;
    }
  };

  const openMega = (kind: NavMegaKind) => {
    clearMegaTimer();
    setMega(kind);
  };

  const scheduleCloseMega = () => {
    clearMegaTimer();
    megaTimer.current = window.setTimeout(() => setMega(null), 140);
  };

  const closeMenus = () => {
    clearMegaTimer();
    setMega(null);
    setMobileMega(null);
    setMobileOpen(false);
  };

  const renderNavItem = (
    item: NavLink,
    className: string,
    onNavigate?: () => void,
    options?: NavItemOptions,
  ) => {
    const audienceHref = audienceFromNavHref(item.href);
    const sectionId = audienceHref ? null : homeHashSection(item.href);
    const current = isActiveRoute(location, item.href);
    const content = options?.children ?? (
      <>
        {item.label}
        {options?.chevron ? <ChevronDown className="global-nav__chevron" aria-hidden="true" /> : null}
      </>
    );
    const popupProps = {
      className,
      onFocus: options?.onFocus,
      "aria-expanded": options?.chevron ? Boolean(options.expanded) : undefined,
      "aria-haspopup": options?.chevron ? ("true" as const) : undefined,
      "aria-controls": options?.controls,
    };

    let node: ReactNode;
    if (audienceHref) {
      node = (
        <a
          href={`/${audienceHref}`}
          {...popupProps}
          onClick={(event) => {
            event.preventDefault();
            onNavigate?.();
            if (onHome) onAudienceChange(audienceHref);
            else window.location.assign(`/${audienceHref}`);
          }}
        >
          {content}
        </a>
      );
    } else if (sectionId) {
      node = (
        <a
          href={`/#${sectionId}`}
          {...popupProps}
          aria-current={current ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            goToHomeSection(sectionId, onNavigate);
          }}
        >
          {content}
        </a>
      );
    } else if (isExternalHref(item.href) || item.openInNewTab) {
      node = (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          {...popupProps}
          onClick={onNavigate}
        >
          {content}
        </a>
      );
    } else {
      node = (
        <Link href={item.href} {...popupProps} aria-current={current ? "page" : undefined} onClick={onNavigate}>
          {content}
        </Link>
      );
    }

    return (
      <span
        key={`${className}-${item.label}-${item.href}`}
        className="global-nav__item"
        onMouseEnter={options?.onMouseEnter}
        onMouseLeave={options?.onMouseLeave}
      >
        {node}
      </span>
    );
  };

  const renderMegaLink = (link: NavMegaLink, className: string) =>
    renderNavItem(
      { label: link.title, href: link.href, openInNewTab: isExternalHref(link.href) },
      className,
      closeMenus,
      link.headline
        ? {
            children: (
              <>
                <p className="global-nav__mega-title">{link.title}</p>
                <p className="global-nav__mega-headline">{link.headline}</p>
              </>
            ),
          }
        : undefined,
    );

  const loginHref =
    typeof window !== "undefined"
      ? loginHrefForLocation(window.location.pathname, window.location.search)
      : getMetfixLoginUrl("/");

  return (
    <header
      className={`global-nav${onHome ? " global-nav--home" : ""}`}
      data-theme={onHome ? audienceTheme[audience] : undefined}
    >
      <a href="#main" className="global-nav__skip">
        Skip to content
      </a>

      {onHome ? (
        <AudienceTabs
          audience={audience}
          onAudienceChange={onAudienceChange}
          loginHref={loginHref}
          accountName={accountName}
        />
      ) : null}

      <div className={`global-nav__primary${scrolled || mobileOpen ? " is-solid" : ""}`}>
        <div className="global-nav__row">
          <Link href="/" className="global-nav__logo" aria-label="MetFix">
            <img
              src={assetUrl("/MetFixLogoBlack.png")}
              alt="MetFix"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = assetUrl("/metfix-lockup.png");
              }}
            />
          </Link>

          <nav className="global-nav__links" aria-label="Primary">
            {navLinks.map((item) => {
              const kind = megaKindForLabel(item.label);
              if (!kind) {
                return renderNavItem(item, "global-nav__link", undefined, {
                  onMouseEnter: scheduleCloseMega,
                });
              }
              const open = mega === kind;
              return renderNavItem(item, `global-nav__link${open ? " is-open" : ""}`, closeMenus, {
                chevron: true,
                expanded: open,
                controls: `nav-mega-${kind}`,
                onMouseEnter: () => openMega(kind),
                onMouseLeave: scheduleCloseMega,
                onFocus: () => openMega(kind),
              });
            })}
          </nav>

          <div className="global-nav__actions" onMouseEnter={scheduleCloseMega}>
            <button
              ref={searchBtnRef}
              type="button"
              className="global-nav__icon-btn"
              aria-label="Search"
              onClick={openSearch}
            >
              <Search size={18} aria-hidden="true" />
            </button>
            {!onHome ? (
              accountName ? (
                <Link href="/account" className="global-nav__login" data-nav-auth="account">
                  {accountName}
                </Link>
              ) : (
                <Link href={loginHref} className="global-nav__login" data-nav-auth="login">
                  Sign in
                </Link>
              )
            ) : null}
            <button type="button" className="global-nav__join" onClick={openJoin}>
              Join Today — 1 Month Free
            </button>
            <button
              ref={toggleRef}
              type="button"
              className="global-nav__menu-toggle"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls={menuId}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav
            ref={mobilePanelRef}
            id={menuId}
            className="global-nav__mobile"
            aria-label="Mobile"
          >
            <div className="global-nav__mobile-list">
              {navLinks.map((item) => {
                const kind = megaKindForLabel(item.label);
                if (!kind) {
                  return renderNavItem(item, "global-nav__mobile-link", () => {
                    setMobileOpen(false);
                    toggleRef.current?.focus();
                  });
                }
                const open = mobileMega === kind;
                return (
                  <div key={item.label} className="global-nav__mobile-group">
                    <button
                      type="button"
                      className="global-nav__mobile-toggle"
                      aria-expanded={open}
                      onClick={() => setMobileMega(open ? null : kind)}
                    >
                      {item.label}
                      <ChevronDown className="global-nav__chevron" aria-hidden="true" />
                    </button>
                    {open ? (
                      <div className="global-nav__mobile-sub">
                        {linksForMega(kind).map((link) =>
                          renderNavItem(
                            {
                              label: link.title,
                              href: link.href,
                              openInNewTab: isExternalHref(link.href),
                            },
                            "global-nav__mobile-sublink",
                            () => {
                              setMobileOpen(false);
                              toggleRef.current?.focus();
                            },
                          ),
                        )}
                        {kind === "courses"
                          ? renderNavItem(
                              {
                                label: "See all",
                                href: NAV_SEE_ALL_COURSES.href,
                                openInNewTab: false,
                              },
                              "global-nav__mobile-sublink",
                              () => setMobileOpen(false),
                            )
                          : null}
                        {kind === "courses" || kind === "programs"
                          ? renderNavItem(
                              {
                                label: NAV_HOST_SEMINAR.title,
                                href: NAV_HOST_SEMINAR.href,
                                openInNewTab: false,
                              },
                              "global-nav__mobile-sublink",
                              () => setMobileOpen(false),
                            )
                          : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className="global-nav__mobile-actions">
                <Link
                  href={accountName ? "/account" : loginHref}
                  className="global-nav__join"
                  style={{ display: "inline-flex" }}
                  data-nav-auth={accountName ? "account" : "login"}
                  onClick={() => setMobileOpen(false)}
                >
                  {accountName ?? "Sign in"}
                </Link>
                <button type="button" className="global-nav__join" onClick={openJoin}>
                  Join Today — 1 Month Free
                </button>
                <button
                  type="button"
                  className="global-nav__icon-btn"
                  aria-label="Search"
                  onClick={openSearch}
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </nav>
        ) : null}
      </div>

      {mega ? (
        <div
          id={`nav-mega-${mega}`}
          className="global-nav__mega"
          onMouseEnter={() => openMega(mega)}
          onMouseLeave={scheduleCloseMega}
        >
          <NavMegaPanel kind={mega} renderLink={renderMegaLink} />
        </div>
      ) : null}

      <NavSearchModal
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          searchBtnRef.current?.focus();
        }}
      />
    </header>
  );
}
