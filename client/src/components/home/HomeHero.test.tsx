/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import type { LandingCopy } from "@/data/home/audience";
import type { AccountOverview, AccountSubscriptions } from "@/lib/account";
import { loadOverview, loadSubscriptions } from "@/lib/account";
import { loadMe } from "@/lib/session";
import { HomeHero } from "./HomeHero";

vi.mock("@/lib/session", () => ({
  loadMe: vi.fn(),
}));

vi.mock("@/lib/account", () => ({
  loadOverview: vi.fn(),
  loadSubscriptions: vi.fn(),
}));

const copy: LandingCopy = {
  heroLines: ["Metabolic Health", "Classes for Real Life"],
  heroSubtitle: "Evidence-informed education.",
  testimonialsTitle: "Why Learners Choose MetFix",
  resourcesTitle: "Let's Start with the Truth",
};

const freeSubs = {
  canonical_tier: "free",
  items: [],
} as AccountSubscriptions;

const freeOverview = {
  canonical_tier: "free",
  badges: { medical: false, affiliate: false, subscription: false },
} as AccountOverview;

function renderHero() {
  return render(
    <Router>
      <HomeHero onJoin={vi.fn()} copy={copy} audience="#for-individuals" />
    </Router>,
  );
}

afterEach(() => {
  cleanup();
  vi.mocked(loadMe).mockReset();
  vi.mocked(loadOverview).mockReset();
  vi.mocked(loadSubscriptions).mockReset();
});

describe("HomeHero join card", () => {
  it("asks signed-out visitors to join", async () => {
    vi.mocked(loadMe).mockResolvedValue({ status: "signed_out" });
    renderHero();
    expect(await screen.findByRole("button", { name: /Continue with Google/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Join Today/i })).toBeTruthy();
  });

  it("links a signed-in visitor without a membership to the individual plan and account destinations", async () => {
    vi.mocked(loadMe).mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    vi.mocked(loadSubscriptions).mockResolvedValue(freeSubs);
    vi.mocked(loadOverview).mockResolvedValue(freeOverview);
    renderHero();

    const membership = await screen.findByRole("link", { name: "Join MetFix Pro" });
    const dashboard = screen.getByRole("link", { name: "View Dashboard" });
    const library = screen.getByRole("link", { name: "Explore Resource Library" });
    const classes = screen.getByRole("link", { name: "Take Classes" });
    expect(membership.getAttribute("href")).toBe("#membership-section");
    expect(membership.className).toContain("bg-accent");
    expect(dashboard.getAttribute("href")).toBe("/account");
    expect(library.getAttribute("href")).toBe("/library");
    expect(classes.getAttribute("href")).toBe("/classes");
    for (const link of [dashboard, library, classes]) {
      expect(link.className).toContain("bg-white");
      expect(link.className).toContain("rounded-full");
      expect(link.className).not.toContain("underline");
    }
    expect(screen.queryByRole("button", { name: /Continue with Google/i })).toBeNull();
    expect(screen.queryByText(/Terms of Service/i)).toBeNull();
  });

  it("drops the membership link and makes Dashboard the tan primary when access already exists", async () => {
    vi.mocked(loadMe).mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    vi.mocked(loadSubscriptions).mockResolvedValue({
      canonical_tier: "metfix_pro",
      items: [],
    } as AccountSubscriptions);
    vi.mocked(loadOverview).mockResolvedValue({
      canonical_tier: "metfix_pro",
      badges: { medical: false, affiliate: false, subscription: true },
    } as AccountOverview);
    renderHero();

    const dashboard = await screen.findByRole("link", { name: "View Dashboard" });
    const library = screen.getByRole("link", { name: "Explore Resource Library" });
    const classes = screen.getByRole("link", { name: "Take Classes" });
    expect(dashboard.className).toContain("bg-accent");
    expect(dashboard.getAttribute("href")).toBe("/account");
    expect(screen.queryByRole("link", { name: "Join MetFix Pro" })).toBeNull();
    for (const link of [library, classes]) {
      expect(link.className).toContain("bg-white");
      expect(link.className).toContain("rounded-full");
      expect(link.className).not.toContain("underline");
    }
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Continue with Google/i })).toBeNull();
    });
  });
});
