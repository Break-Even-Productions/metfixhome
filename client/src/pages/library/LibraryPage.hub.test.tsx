/**
 * @vitest-environment jsdom
 *
 * Hub section order, titles, and caps.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { FALLBACK_COURSES } from "@/data/fallbackCourses";
import type { LibraryResource } from "@shared/library";

class NeverIntersecting {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const OPEN_ACCESS = {
  access: "full" as const,
  has_content_access: false,
  user_has_access: true,
  has_preview: false,
  is_exclusive: false,
  show_same: 0,
  show_video_in_preview: false,
  access_group_labels: [] as string[],
};

const GATED_ACCESS = {
  ...OPEN_ACCESS,
  access: "preview" as const,
  has_content_access: true,
  is_exclusive: true,
  user_has_access: false,
};

function resource(
  id: number,
  title: string,
  access: LibraryResource["access"],
): LibraryResource {
  return {
    id,
    type: "post",
    title,
    excerpt: "Excerpt",
    date: "2026-01-01T00:00:00Z",
    image: null,
    permalink: `https://brokenscience.org/?p=${id}`,
    author: null,
    categories: [],
    topics: [],
    content_types: [],
    access,
  };
}

function dailyFixResource(id: number, title: string): LibraryResource {
  return {
    ...resource(id, title, OPEN_ACCESS),
    type: "daily_fix",
    daily_fix_date: "2026-10-22",
  };
}

function searchBody(resources: LibraryResource[], limit: number) {
  return {
    resources,
    meta: {
      total: resources.length,
      count: resources.length,
      limit,
      offset: 0,
      has_more: false,
    },
  };
}

function section(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name: title });
  const node = heading.closest("section");
  if (!node) throw new Error(`missing section ${title}`);
  return node;
}

function cardCount(title: string): number {
  return section(title).querySelectorAll(
    ".library-card:not(.library-card-skeleton)",
  ).length;
}

describe("library hub sections", () => {
  let LibraryPage: ComponentType;
  let fetchLog: Array<{ path: string; params: URLSearchParams }>;

  function installFetch(opts?: { dailyFix?: boolean }) {
    fetchLog = [];
    const free = Array.from({ length: 6 }, (_, i) =>
      resource(100 + i, `Free resource ${i + 1}`, OPEN_ACCESS),
    );
    const gated = Array.from({ length: 6 }, (_, i) =>
      resource(200 + i, `Pro resource ${i + 1}`, GATED_ACCESS),
    );
    const popular = Array.from({ length: 6 }, (_, i) =>
      resource(300 + i, `Popular resource ${i + 1}`, OPEN_ACCESS),
    );
    const metfix = Array.from({ length: 5 }, (_, i) =>
      resource(400 + i, `MetFix resource ${i + 1}`, OPEN_ACCESS),
    );
    const bsi = Array.from({ length: 5 }, (_, i) =>
      resource(500 + i, `BSI resource ${i + 1}`, OPEN_ACCESS),
    );
    const archives = Array.from({ length: 6 }, (_, i) =>
      resource(600 + i, `Glassman note ${i + 1}`, OPEN_ACCESS),
    );
    if (opts?.dailyFix) {
      popular.unshift(
        dailyFixResource(901, "Daily Fix breakfast"),
        {
          ...resource(902, "Labeled post day", OPEN_ACCESS),
          daily_fix_date: "2026-10-23",
        },
      );
      free.unshift(dailyFixResource(903, "Daily Fix open note"));
      metfix.unshift(dailyFixResource(904, "Daily Fix metfix"));
      bsi.unshift(dailyFixResource(905, "Daily Fix bsi"));
      archives.unshift(dailyFixResource(906, "Daily Fix glassman"));
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const u = new URL(String(input), "http://local.test");
        fetchLog.push({ path: u.pathname, params: u.searchParams });
        const json = (body: unknown) =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });

        if (u.pathname === "/api/library/filters") {
          return json({
            topics: [],
            content_type_terms: [],
            categories: [
              {
                id: 11,
                name: "MetFix",
                slug: "metfix",
                description: null,
                image: null,
              },
              {
                id: 12,
                name: "BSI",
                slug: "bsi",
                description: null,
                image: null,
              },
            ],
          });
        }
        if (u.pathname === "/api/library/popular") {
          return json(
            searchBody(popular, Number(u.searchParams.get("limit") ?? 6)),
          );
        }
        if (u.pathname === "/api/library/archive") {
          return json(searchBody(archives, 9));
        }
        if (u.pathname === "/api/library/search") {
          const params = u.searchParams;
          if (params.getAll("content_types[]").includes("course")) {
            return json(searchBody([], 9));
          }
          if (params.getAll("categories[]").includes("11")) {
            return json(searchBody(metfix, 3));
          }
          if (params.getAll("categories[]").includes("12")) {
            return json(searchBody(bsi, 3));
          }
          return json(searchBody([...free, ...gated], 24));
        }
        return json(searchBody([], 0));
      }),
    );
  }

  beforeEach(async () => {
    vi.resetModules();
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
    vi.stubGlobal("IntersectionObserver", NeverIntersecting);
    window.history.replaceState(null, "", "/library");
    installFetch();
    LibraryPage = (await import("./LibraryPage")).default;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderHub() {
    return render(
      <Router>
        <Route path="/library" component={LibraryPage} />
      </Router>,
    );
  }

  it("orders capped sections and omits courses from the popular query", async () => {
    renderHub();

    // Archive is the last cascade step. CI often still has that rail loading
    // when the default 1s waitFor expires, after the earlier sections are full.
    await waitFor(
      () => {
        expect(cardCount("Top resources")).toBe(3);
        expect(cardCount("Courses")).toBe(6);
        expect(cardCount("Pro library")).toBe(3);
        expect(cardCount("MetFix")).toBe(3);
        expect(cardCount("Free / open")).toBe(3);
        expect(cardCount("BSI")).toBe(3);
        expect(cardCount("Glassman & Book Library")).toBe(3);
      },
      { timeout: 10_000 },
    );

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "Top resources",
      "Courses",
      "Pro library",
      "MetFix",
      "Free / open",
      "BSI",
      "Glassman & Book Library",
    ]);
    expect(
      screen.queryByRole("heading", { name: "Gated & exclusive" }),
    ).toBeNull();

    expect(
      within(section("Courses"))
        .getByRole("link", { name: "Browse all →" })
        .getAttribute("href"),
    ).toBe("/classes");
    expect([
      ...within(section("Courses"))
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ]).toEqual(FALLBACK_COURSES.slice(0, 6).map((course) => course.title));

    const popular = fetchLog.find(
      (entry) => entry.path === "/api/library/popular",
    );
    expect(popular).toBeTruthy();
    expect(popular?.params.get("limit")).toBe("3");
    expect(popular?.params.getAll("content_types[]").sort()).toEqual([
      "event",
      "post",
    ]);
    expect(popular?.params.getAll("content_types[]")).not.toContain("course");

    const metfix = fetchLog.find(
      (entry) =>
        entry.path === "/api/library/search" &&
        entry.params.getAll("categories[]").includes("11"),
    );
    const bsi = fetchLog.find(
      (entry) =>
        entry.path === "/api/library/search" &&
        entry.params.getAll("categories[]").includes("12"),
    );
    expect(metfix?.params.get("limit")).toBe("3");
    expect(bsi?.params.get("limit")).toBe("3");
    const archive = fetchLog.find(
      (entry) => entry.path === "/api/library/archive",
    );
    expect(archive?.params.get("limit")).toBe("3");
  }, 15_000);

  it("cascades filters, then popular, then searches, then archive", async () => {
    const order: string[] = [];
    let releaseFilters!: () => void;
    let releasePopular!: () => void;
    let releaseSearches!: () => void;
    const filtersGate = new Promise<void>((resolve) => {
      releaseFilters = resolve;
    });
    const popularGate = new Promise<void>((resolve) => {
      releasePopular = resolve;
    });
    const searchGate = new Promise<void>((resolve) => {
      releaseSearches = resolve;
    });
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const u = new URL(String(input), "http://local.test");
        if (u.pathname === "/api/library/filters") {
          order.push("filters");
          await filtersGate;
          return json({
            topics: [],
            content_type_terms: [],
            categories: [
              { id: 11, name: "MetFix", slug: "metfix", description: null, image: null },
              { id: 12, name: "BSI", slug: "bsi", description: null, image: null },
            ],
          });
        }
        if (u.pathname === "/api/library/popular") {
          order.push("popular");
          await popularGate;
          return json(searchBody([], 3));
        }
        if (u.pathname === "/api/library/search") {
          order.push("search");
          await searchGate;
          return json(searchBody([], 3));
        }
        if (u.pathname === "/api/library/archive") {
          order.push("archive");
          return json(searchBody([], 3));
        }
        return json(searchBody([], 0));
      }),
    );

    try {
      renderHub();
      await waitFor(() => expect(order).toEqual(["filters"]));
      releaseFilters();
      await waitFor(() => expect(order).toEqual(["filters", "popular"]));
      releasePopular();
      await waitFor(() =>
        expect(order.filter((step) => step === "search")).toHaveLength(4),
      );
      expect(order).not.toContain("archive");
      releaseSearches();
      await waitFor(() => expect(order).toContain("archive"));
      expect(order.indexOf("popular")).toBeLessThan(order.indexOf("search"));
      expect(order.lastIndexOf("search")).toBeLessThan(order.indexOf("archive"));
    } finally {
      releaseFilters();
      releasePopular();
      releaseSearches();
    }
  });

  it("does not show Daily Fix items in the library sections", async () => {
    installFetch({ dailyFix: true });
    renderHub();
    await waitFor(
      () => {
        expect(cardCount("Top resources")).toBe(3);
        expect(cardCount("Free / open")).toBe(3);
        expect(cardCount("MetFix")).toBe(3);
        expect(cardCount("BSI")).toBe(3);
        expect(cardCount("Glassman & Book Library")).toBe(3);
      },
      { timeout: 10_000 },
    );
    expect(screen.queryByText("Daily Fix breakfast")).toBeNull();
    expect(screen.queryByText("Labeled post day")).toBeNull();
    expect(screen.queryByText("Daily Fix open note")).toBeNull();
    expect(screen.queryByText("Daily Fix metfix")).toBeNull();
    expect(screen.queryByText("Daily Fix bsi")).toBeNull();
    expect(screen.queryByText("Daily Fix glassman")).toBeNull();
    expect(within(section("Top resources")).getByText("Popular resource 1")).toBeTruthy();
  });

  it("opens the existing filtered views for Pro library and top resources", async () => {
    renderHub();
    await waitFor(() => expect(cardCount("Pro library")).toBe(3));

    fireEvent.click(
      within(section("Pro library")).getByRole("button", {
        name: "Browse all →",
      }),
    );
    await waitFor(() => {
      expect(window.location.search).toContain("section=gated");
    });
    expect(
      screen.getByRole("heading", { level: 2, name: "Pro library" }),
    ).toBeTruthy();
    expect(screen.getByText("Archive")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(cardCount("Top resources")).toBe(3));

    fireEvent.click(
      within(section("Top resources")).getByRole("button", {
        name: "Browse all →",
      }),
    );
    await waitFor(() => {
      expect(window.location.search).toContain("section=featured");
      const page = fetchLog.find(
        (entry) =>
          entry.path === "/api/library/popular" &&
          entry.params.get("limit") === "24",
      );
      expect(page?.params.getAll("content_types[]").sort()).toEqual([
        "event",
        "post",
      ]);
    });
  });
});
