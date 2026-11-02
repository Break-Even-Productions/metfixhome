/**
 * @vitest-environment jsdom
 * T-E-2 Foundations coaches-only; T-E-26 keep/drop; section order smoke.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class IntersectionObserverStub {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {
    this.cb(
      [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds = [];
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
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
  Element.prototype.scrollIntoView = () => {};
  window.history.replaceState(null, "", "/");
});

vi.mock("@/hooks/useSanityContent", () => ({
  useHomeContent: () => ({
    home: {
      foundations: {
        eyebrow: "Live",
        headline: { text: "MetFix Foundations\nSeminar" },
        body: "Body",
        supportingText: "Support",
        cta: { label: "View Upcoming Seminars", href: "/affiliate-seminars" },
        videosLabel: "Hear From Coaches Who Attended",
        videoEmbedUrls: [],
      },
      problem: {
        eyebrow: "The Problem",
        quote: "Quote",
        sourceText: "Source (",
        sourceUrl: "https://example.com",
        sourceLinkLabel: "cdc",
      },
      playbook: {
        eyebrow: "Playbook",
        headline: { text: "Playbook headline" },
        cta: { label: "CTA", href: "/become-an-affiliate" },
      },
      affiliation: {
        eyebrow: "Affiliation",
        headline: { text: "Join" },
        body: "Body",
        supportingText: "Support",
        monthlyPrice: "$167",
        priceNote: "/ month",
        benefits: ["A"],
        primaryCta: { label: "Primary", href: "/become-an-affiliate" },
        secondaryCta: { label: "Secondary", href: "https://brokenscience.org/metfix/metfix-map/" },
      },
      whyDifferent: {
        eyebrow: "Why",
        names: "Names",
        roles: "Roles",
        photoCaptionLeft: "L",
        photoCaptionRight: "R",
        quote: "Q",
        quoteAttribution: "A",
        quoteRole: "Role",
        body: ["Para"],
        link: { label: "BSI", href: "https://brokenscience.org/" },
      },
      gap: {
        eyebrow: "Gap",
        headline: { text: "Gap" },
        body: "Body",
        cta: { label: "CTA", href: "https://whatis.metfix.org/" },
        listLabel: "Status quo",
        statusQuoItems: ["One"],
        closingQuote: "Close",
      },
      network: {
        eyebrow: "Network",
        headline: { text: "Network" },
        body: "Body",
        cta: { label: "CTA", href: "/become-an-affiliate" },
        featuredLocations: [{ name: "Gym", city: "City" }],
      },
      resourceLibrary: {
        eyebrow: "Lib",
        headline: { text: "Resources" },
        subtext: "Sub",
        categoryTags: [],
        fullLibraryCta: { label: "Full", href: "/library" },
        featured: {
          category: "C",
          title: "T",
          description: "D",
          author: "A",
          tag: "T",
          badge: "Free",
          href: "/library",
          mediaType: "none",
          showPlayButton: false,
        },
        items: [],
        bottomCta: { label: "More", href: "/library" },
      },
      weekly: {
        eyebrow: "Weekly",
        headline: { text: "Weekly title" },
        body: "Body",
      },
      testimonialsSection: { eyebrow: "Stories" },
      faqSection: { eyebrow: "FAQ", headline: { text: "FAQ" } },
      specialtyTracks: { eyebrow: "S", headline: { text: "S" }, subtext: "" },
      hero: {
        eyebrow: "H",
        headline: { text: "H" },
        subtext: "",
        statText: "",
        primaryCta: { label: "P", href: "/" },
        secondaryCta: { label: "S", href: "/" },
      },
    },
    homeCourses: [
      {
        id: "c1",
        label: "Core",
        name: "What Is MetFix",
        desc: "Intro",
        href: "https://whatis.metfix.org/",
        tag: "Free",
        live: true,
        notify: false,
      },
    ],
    testimonials: [],
    faqs: [],
    loading: false,
  }),
  useSiteSettings: () => ({
    settings: { copyrightText: "© MetFix", navLinks: [] },
    loading: false,
  }),
}));

vi.mock("@/contexts/JoinFlowContext", () => ({
  useJoinFlowOptional: () => ({ openJoinFlow: vi.fn(), closeJoinFlow: vi.fn(), isOpen: false }),
}));

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/lib/fetchPostsPage", () => ({
  fetchPostsPage: async () => ({
    posts: [
      {
        id: 1,
        title: "Sample post",
        excerpt: "Excerpt",
        date: "2026-01-01",
        image: null,
        author: "MetFix",
        category: null,
      },
    ],
    page: 1,
    per_page: 10,
    has_more: false,
  }),
}));

import Home from "./Home";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("T-E-2 Foundations coaches-only", () => {
  it("does not render Foundations for default audience", () => {
    render(<Home />);
    expect(document.getElementById("foundations")).toBeNull();
  });

  it("renders Foundations for #for-coaches", () => {
    window.history.replaceState(null, "", "/#for-coaches");
    render(<Home />);
    // hashchange listener runs on mount via onHash
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(document.getElementById("foundations")).toBeTruthy();
  });
});

describe("T-E-26 section keep/drop", () => {
  it("keeps impact, playbook, affiliation, about, gap, network, membership-section", async () => {
    render(<Home />);
    await waitFor(() => expect(document.getElementById("resources")).toBeTruthy());
    for (const id of [
      "impact",
      "playbook",
      "affiliation",
      "about",
      "gap",
      "network",
      "membership-section",
      "classes",
      "experts",
      "resources",
      "stories",
      "faq",
      "newsletter",
    ]) {
      expect(document.getElementById(id), id).toBeTruthy();
    }
  });

  it("drops SideRail / OutcomesCarousel / specialty courses section ids", () => {
    render(<Home />);
    expect(document.getElementById("courses")).toBeNull();
    expect(screen.queryByLabelText(/Next outcome/i)).toBeNull();
  });

  it("renders beta section order landmarks", async () => {
    render(<Home />);
    await waitFor(() => expect(document.getElementById("resources")).toBeTruthy());
    const ids = [
      "classes",
      "membership-section",
      "experts",
      "resources",
      "stories",
      "impact",
      "faq",
      "newsletter",
    ];
    for (let i = 0; i < ids.length - 1; i++) {
      const a = document.getElementById(ids[i])!;
      const b = document.getElementById(ids[i + 1])!;
      expect(a, ids[i]).toBeTruthy();
      expect(b, ids[i + 1]).toBeTruthy();
      expect(Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    }
  });
});
