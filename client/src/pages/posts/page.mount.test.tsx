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
import { DAILY_FIX_BFF_URL, resetDailyFixDayCache } from "@/pages/the-daily-fix/data";
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
function dayPayload(date: string) {
  return {
    date,
    belly: {
      title: `Belly ${date}`,
      photo_url: null,
      plate_photo: null,
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
      title: `Body ${date}`,
      body: `<p>Workout ${date}</p>`,
      excerpt: null,
    },
    brain: {
      title: `Brain ${date}`,
      body: `<p>Read ${date}</p>`,
      excerpt: null,
    },
  };
}

/** Keeps the lazy archive from fetching, so per-day fetch counts stay exact. */
class NeverIntersecting {
  observe() {}
  disconnect() {}
}

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
  Element.prototype.scrollTo = vi.fn() as typeof Element.prototype.scrollTo;
  vi.stubGlobal("IntersectionObserver", NeverIntersecting);
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

function mockDayFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    expect(url).not.toContain("brokenscience.org");
    expect(url).not.toContain("/api/substack/archive");
    expect(url).not.toContain("substack.com");
    expect(url).not.toContain("/api/daily-fix/comments");
    return new Response(JSON.stringify(dayPayload("2025-02-10")), {
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
  resetDailyFixDayCache();
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
    expect(screen.queryByText(/Not available/i)).toBeNull();
    expect(screen.queryByText("Error 404")).toBeNull();
    expect(screen.queryByText("The Metabolic Fix")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Belly 2025-02-10" })).toBeNull();
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

  it("Daily Fix /250210 still fetches the day once and never shows posts unavailable", async () => {
    const fetchMock = mockDayFetch();
    openAddressBar("/the-daily-fix/250210");
    render(<MountedApp />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `${DAILY_FIX_BFF_URL}?date=2025-02-10`,
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
      }),
    );
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Posts are unavailable/i })).toBeNull();
    expect(screen.queryByText(/Posts are unavailable right now/i)).toBeNull();
    expect(window.location.pathname).toBe("/the-daily-fix/250210");
  });
});
