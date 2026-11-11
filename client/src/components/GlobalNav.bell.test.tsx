/**
 * @vitest-environment jsdom
 * Signed-in users see a notifications bell. Entitled members skip Join Today.
 * Free members see Join Today with the bell to its right.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setLocation = vi.fn();
const locationRef = { current: "/classes" };

vi.mock("@/hooks/useSiteContent", () => ({
  useSiteSettings: () => ({
    settings: { copyrightText: "© MetFix", navLinks: [] },
    loading: false,
  }),
}));

vi.mock("@/contexts/JoinFlowContext", () => ({
  useJoinFlowOptional: () => null,
}));

const loadMe = vi.fn();
const loadOverview = vi.fn();
const loadSubscriptions = vi.fn();
const loadUnreadNotificationCount = vi.fn();

vi.mock("@/lib/session", () => ({
  loadMe: (...args: unknown[]) => loadMe(...args),
}));

vi.mock("@/lib/account", () => ({
  loadOverview: (...args: unknown[]) => loadOverview(...args),
  loadSubscriptions: (...args: unknown[]) => loadSubscriptions(...args),
  loadUnreadNotificationCount: (...args: unknown[]) =>
    loadUnreadNotificationCount(...args),
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => [locationRef.current, setLocation] as const,
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  };
});

import GlobalNav from "./GlobalNav";

beforeEach(() => {
  locationRef.current = "/classes";
  setLocation.mockClear();
  loadMe.mockReset();
  loadOverview.mockReset();
  loadSubscriptions.mockReset();
  loadUnreadNotificationCount.mockReset();
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GlobalNav notification bell", () => {
  it("keeps Join Today when signed out", async () => {
    loadMe.mockResolvedValue({ status: "signed_out" });
    render(<GlobalNav />);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Join Today/i }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByRole("link", { name: /Notifications/i })).toBeNull();
  });

  it("replaces Join Today with a live unread bell for entitled members", async () => {
    loadMe.mockResolvedValue({
      status: "signed_in",
      public_name: "Ada",
      moderator: false,
    });
    loadOverview.mockResolvedValue({
      display_name: "Ada",
      canonical_tier: "metfix_pro",
      badges: { medical: false, affiliate: false, foundations_coach: false },
      foundations_coach: {
        active: false,
        grant_reason: null,
        granted_at: null,
        expires_at: null,
        seminar_checked_in: false,
        metfix_essentials_completed: false,
        metfix_essentials_certificate_claimed: false,
      },
      items: [],
      tabs: [],
      links: {},
    });
    loadSubscriptions.mockResolvedValue({
      canonical_tier: "metfix_pro",
      items: [{ tier: "metfix_pro", status: "active", legacy_source: null }],
    });
    loadUnreadNotificationCount.mockResolvedValue({ unread_count: 3 });

    render(<GlobalNav />);

    await waitFor(() => {
      const bell = screen.getByRole("link", { name: /Notifications, 3 unread/i });
      expect(bell.getAttribute("href")).toBe("/account/notifications");
      expect(bell.textContent).toContain("3");
    });
    expect(screen.queryByRole("button", { name: /Join Today/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Dashboard" }).className).toContain(
      "global-nav__dashboard",
    );
  });

  it("shows Join Today and a bell to its right for signed-in free members", async () => {
    loadMe.mockResolvedValue({
      status: "signed_in",
      public_name: "Ada",
      moderator: false,
    });
    loadOverview.mockResolvedValue({
      display_name: "Ada",
      canonical_tier: "free",
      badges: { medical: false, affiliate: false, foundations_coach: false },
      foundations_coach: {
        active: false,
        grant_reason: null,
        granted_at: null,
        expires_at: null,
        seminar_checked_in: false,
        metfix_essentials_completed: false,
        metfix_essentials_certificate_claimed: false,
      },
      items: [],
      tabs: [],
      links: {},
    });
    loadSubscriptions.mockResolvedValue({ canonical_tier: "free", items: [] });
    loadUnreadNotificationCount.mockResolvedValue({ unread_count: 1 });

    render(<GlobalNav />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Notifications, 1 unread/i })).toBeTruthy();
    });
    const join = screen.getByRole("button", { name: /Join Today/i });
    const bell = screen.getByRole("link", { name: /Notifications, 1 unread/i });
    expect(
      join.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides Dashboard on account pages", async () => {
    locationRef.current = "/account";
    loadMe.mockResolvedValue({
      status: "signed_in",
      public_name: "Ada",
      moderator: false,
    });
    loadOverview.mockResolvedValue({
      display_name: "Ada",
      canonical_tier: "free",
      badges: { medical: false, affiliate: false, foundations_coach: false },
      foundations_coach: {
        active: false,
        grant_reason: null,
        granted_at: null,
        expires_at: null,
        seminar_checked_in: false,
        metfix_essentials_completed: false,
        metfix_essentials_certificate_claimed: false,
      },
      items: [],
      tabs: [],
      links: {},
    });
    loadSubscriptions.mockResolvedValue({ canonical_tier: "free", items: [] });
    loadUnreadNotificationCount.mockResolvedValue({ unread_count: 0 });

    render(<GlobalNav />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Notifications" })).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  });
});
