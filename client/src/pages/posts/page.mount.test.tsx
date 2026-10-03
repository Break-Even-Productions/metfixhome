/**
 * @vitest-environment jsdom
 *
 * Mount-level checks: real Router + Posts / Daily Fix / Home / NotFound.
 * Helper-only assertions are not enough here.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { dailyFixCommentsRequestUrl } from "@/pages/the-daily-fix/comments";
import { DAILY_FIX_BFF_URL } from "@/pages/the-daily-fix/data";
import TheDailyFixPage from "@/pages/the-daily-fix/TheDailyFixPage";
import PostsPage from "./PostsPage";

const FORBIDDEN_SAMPLE_TITLES = [
  "The Metal You Taste After a Hard Workout",
  "The Expert With Connections",
  "The Cameras Went Dark Four Days Before Xi Arrives",
  "The Backdoor in the Medicaid Rule",
  "The Photo Op Executive Order",
  "How Medicine Meets the Gym",
] as const;

/** Same BSI Worker day body shape used in Daily Fix mount tests — not shipped as posts content. */
function bsiDayBodyFor(isoDate: string) {
  return {
    date: isoDate,
    belly: {
      title: "Steak bowls",
      photo_url: "https://example.com/ignore-belly.jpg",
      plate_photo: "https://example.com/ignore-plate.jpg",
      macros: { fat: 22, carb: null, protein: 34 },
      body: "<p>Legacy ingredients</p>",
      steps: "<p>Legacy steps</p>",
      has_structured_ingredients: true,
      has_structured_steps: true,
      recipe_ingredients: [
        { display: "Eggs", sort_order: 1 },
        { display: "Salt", sort_order: 2 },
      ],
      recipe_steps: [{ instruction: "Cook.", sort_order: 1 }],
    },
    body: {
      title: "Push",
      body: "<p>Work</p>",
      photo_url: "https://example.com/ignore-body.jpg",
    },
    brain: {
      title: "Read",
      body: "<p>Think</p>",
      excerpt: "<p>Fallback excerpt</p>",
      article_url: "https://example.com/article",
      button_text: "FULL ARTICLE",
      photo_url: "https://example.com/ignore-brain.jpg",
    },
  };
}

const emptyCommentsBody = {
  comments: { belly: [], body: [], brain: [] },
  meta: { date: "2025-02-10", type: "all", count: { belly: 0, body: 0, brain: 0, total: 0 } },
};

/** Mirrors App.tsx routes without GlobalNav / theme chrome. */
function MountedApp() {
  return (
    <Router>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/the-daily-fix/:yy/:mm/:dd"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date/:pillar"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix"} component={TheDailyFixPage} />
        <Route path={"/posts"} component={PostsPage} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function stubBrowserApis() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  window.scrollTo = vi.fn() as typeof window.scrollTo;
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
}

function openAddressBar(url: string) {
  window.history.replaceState(null, "", url);
}

function stubPostsPayloadFetch() {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        posts: FORBIDDEN_SAMPLE_TITLES.map((title, i) => ({
          id: i + 1,
          title,
          excerpt: "Should never render",
          body: "<p>Should never render</p>",
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockDayAndCommentsFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    expect(url).not.toContain("brokenscience.org");
    expect(url).not.toContain("/api/substack/archive");
    expect(url).not.toContain("substack.com");
    if (url.includes("/daily-fix/comments")) {
      return new Response(JSON.stringify(emptyCommentsBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(bsiDayBodyFor("2025-02-10")), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  stubBrowserApis();
  openAddressBar("/");
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Posts page mount", () => {
  it("keeps /posts, shows unavailable, is not home / Daily Fix / 404, and never fetches", async () => {
    const fetchMock = stubPostsPayloadFetch();
    openAddressBar("/posts");
    render(<MountedApp />);

    expect(await screen.findByRole("heading", { name: /Posts are unavailable/i })).toBeTruthy();
    expect(screen.getByText(/Posts are unavailable right now/i)).toBeTruthy();
    expect(screen.queryByText(/This day could not be loaded/i)).toBeNull();
    expect(screen.queryByText("Error 404")).toBeNull();
    expect(screen.queryByText("The Metabolic Fix")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Steak bowls" })).toBeNull();
    expect(screen.queryByText(/Today’s fix/i)).toBeNull();
    for (const title of FORBIDDEN_SAMPLE_TITLES) {
      expect(screen.queryByText(title)).toBeNull();
    }
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(screen.queryByText(/substack\.com/i)).toBeNull();
    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href") ?? "";
      expect(href).not.toContain("letsstartwiththetruth.substack.com");
      expect(href).not.toContain("substack.com");
    }
    expect(window.location.pathname).toBe("/posts");
    expect(fetchMock).not.toHaveBeenCalled();
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain("/api/substack/archive");
    }
  });

  it.each(["/posts/1", "/posts/some-slug"])(
    "%s stays not-found, shows Error 404, keeps pathname, and does not fetch",
    async (path) => {
      const fetchMock = stubPostsPayloadFetch();
      openAddressBar(path);
      render(<MountedApp />);

      expect(await screen.findByText("Error 404")).toBeTruthy();
      expect(screen.queryByRole("heading", { name: /Posts are unavailable/i })).toBeNull();
      expect(screen.queryByText(/Posts are unavailable right now/i)).toBeNull();
      expect(window.location.pathname).toBe(path);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("Daily Fix /250210 still fetches day + comments once and never shows posts unavailable", async () => {
    const fetchMock = mockDayAndCommentsFetch();
    openAddressBar("/the-daily-fix/250210");
    render(<MountedApp />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledWith(
      `${DAILY_FIX_BFF_URL}?date=2025-02-10`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      dailyFixCommentsRequestUrl("2025-02-10"),
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(await screen.findByRole("heading", { name: "Steak bowls" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Posts are unavailable/i })).toBeNull();
    expect(screen.queryByText(/Posts are unavailable right now/i)).toBeNull();
    expect(window.location.pathname).toBe("/the-daily-fix/250210");
  });
});
