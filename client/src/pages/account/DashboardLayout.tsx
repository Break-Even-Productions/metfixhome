import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { basePath, getMetfixLoginUrl } from "@/const";
import { usePageMeta } from "@/hooks/usePageMeta";
import { loadMe } from "@/lib/session";
import { sanitizeReturnPath } from "@shared/account/returnPath";
import {
  clearAccountCache,
  deriveMembershipStatus,
  loadOverview,
  loadSubscriptions,
  type AccountOverview,
  type AccountSubscriptions,
} from "@/lib/account";
import "./account.css";

export const ACCOUNT_NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/billing", label: "Billing & Subscriptions" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/courses", label: "My Courses & Certificates" },
  { href: "/account/favorites", label: "Saved / Favorites" },
  { href: "/account/referrals", label: "Referrals & Gifts" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/privacy", label: "Privacy & Security" },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function DashboardLayout({ title, description, children }: Props) {
  const [location] = useLocation();
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [subs, setSubs] = useState<AccountSubscriptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: `${title} — MetFix Account`,
    description: description ?? "Manage your MetFix membership, billing, and courses.",
  });

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const me = await loadMe({ signal: ac.signal });
        if (me.status !== "signed_in") {
          clearAccountCache();
          window.location.assign(
            getMetfixLoginUrl(
              sanitizeReturnPath(`${window.location.pathname}${window.location.search}`) ??
                "/account",
            ),
          );
          return;
        }
        const [ov, su] = await Promise.all([
          loadOverview({ signal: ac.signal }),
          loadSubscriptions({ signal: ac.signal }),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setSubs(su);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Unable to load account.");
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const status = useMemo(() => deriveMembershipStatus(subs), [subs]);
  const pills = useMemo(() => {
    if (!overview) return [] as string[];
    const out: string[] = ["MetFix Member"];
    // CQ B1: Coach pill only when active (expired / missing granted_at → no badge).
    if (overview.foundations_coach.active) {
      out.push("Foundations Coach");
    }
    if (overview.badges.affiliate) out.push("Affiliate");
    if (overview.badges.medical) out.push("Medical Society");
    return out;
  }, [overview]);

  const displayName = overview?.display_name ?? "Member";

  return (
    <div className="account-shell">
      <div className="account-layout">
        <aside className="account-sidebar" aria-label="Account navigation">
          <div className="account-identity">
            <div className="account-avatar" aria-hidden="true">
              {overview?.avatar_url ? (
                <img src={overview.avatar_url} alt="" />
              ) : (
                initials(displayName)
              )}
            </div>
            <h1 className="account-identity-name">{displayName}</h1>
            <div className="account-pills">
              {pills.map((p) => (
                <span
                  key={p}
                  className={
                    p === "Foundations Coach" ? "account-pill account-pill--accent" : "account-pill"
                  }
                >
                  {p}
                </span>
              ))}
            </div>
            <div className="account-status-badge" role="status">
              {status}
            </div>
          </div>
          <nav className="account-nav">
            {ACCOUNT_NAV.map((item) => {
              const current =
                item.href === "/account"
                  ? location === "/account" || location === "/account/"
                  : location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={basePath(item.href)}
                  aria-current={current ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div>
          <nav className="account-mobile-nav" aria-label="Account tabs">
            {ACCOUNT_NAV.map((item) => {
              const current =
                item.href === "/account"
                  ? location === "/account" || location === "/account/"
                  : location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={basePath(item.href)}
                  aria-current={current ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <main className="account-main">
            <h1 className="account-page-title">{title}</h1>
            {description ? <p className="account-page-lede">{description}</p> : null}
            {error ? <p className="account-error">{error}</p> : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
