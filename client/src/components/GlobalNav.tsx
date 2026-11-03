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
import { NavSearchModal } from "@/components/NavSearchModal";
import { useJoinFlowOptional } from "@/contexts/JoinFlowContext";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useSiteSettings } from "@/hooks/useSanityContent";
import {
  audienceFromHash,
  audienceTheme,
  DEFAULT_AUDIENCE,
  type AudienceHref,
} from "@/data/home/audience";
import { DEFAULT_NAV_LINKS, type NavLink } from "@/lib/contentTypes";
import { expectedSearchHrefFromApp } from "@/style-parity/searchHref";
import { sanitizeReturnPath } from "@shared/account/returnPath";
import { loadMe, peekMe, type MeState } from "@/lib/session";
import { Menu, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
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

function readAudience(): AudienceHref {
  if (typeof window === "undefined") return DEFAULT_AUDIENCE;
  return audienceFromHash(window.location.hash) ?? DEFAULT_AUDIENCE;
}

/** §3a nav list — Sanity links filtered; dropped beta items removed. */
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
  const [audience, setAudience] = useState<AudienceHref>(() => readAudience());
  const [me, setMe] = useState<MeState | null>(() => peekMe());
  const [location, setLocation] = useLocation();
  const { settings } = useSiteSettings();
  const navLinks = navLinksFromSettings(settings.navLinks);
  const joinFlow = useJoinFlowOptional();
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const onHome = location === "/" || location === "";
  const signedIn = me?.status === "signed_in";

  useBodyScrollLock(mobileOpen);

  // Remount after /login or route change — pick up session cache / cookie.
  useEffect(() => {
    let active = true;
    void loadMe().then((next) => {
      if (active) setMe(next);
    });
    return () => {
      active = false;
    };
  }, [location]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location]);

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
    setSearchOpen(true);
  };

  const renderNavItem = (item: NavLink, className: string, onNavigate?: () => void) => {
    const sectionId = homeHashSection(item.href);
    const current = isActiveRoute(location, item.href);
    if (sectionId) {
      return (
        <a
          key={`${item.label}-${item.href}`}
          href={`/#${sectionId}`}
          className={className}
          aria-current={current ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            goToHomeSection(sectionId, onNavigate);
          }}
        >
          {item.label}
        </a>
      );
    }

    if (isExternalHref(item.href) || item.openInNewTab) {
      return (
        <a
          key={`${item.label}-${item.href}`}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          onClick={onNavigate}
        >
          {item.label}
        </a>
      );
    }

    return (
      <Link
        key={`${item.label}-${item.href}`}
        href={item.href}
        className={className}
        aria-current={current ? "page" : undefined}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    );
  };

  const loginHref =
    typeof window !== "undefined"
      ? loginHrefForLocation(window.location.pathname, window.location.search)
      : getMetfixLoginUrl("/");
  const accountHref = "/account";

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
          accountHref={signedIn ? accountHref : undefined}
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
            {navLinks.map((item) => renderNavItem(item, "global-nav__link"))}
          </nav>

          <div className="global-nav__actions">
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
              signedIn ? (
                <Link href={accountHref} className="global-nav__login" data-nav-auth="account">
                  Account
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
              {navLinks.map((item) =>
                renderNavItem(item, "global-nav__mobile-link", () => {
                  setMobileOpen(false);
                  toggleRef.current?.focus();
                }),
              )}
              <div className="global-nav__mobile-actions">
                <Link
                  href={signedIn ? accountHref : loginHref}
                  className="global-nav__join"
                  style={{ display: "inline-flex" }}
                  data-nav-auth={signedIn ? "account" : "login"}
                  onClick={() => setMobileOpen(false)}
                >
                  {signedIn ? "Account" : "Sign in"}
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
