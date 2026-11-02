/**
 * @vitest-environment jsdom
 * Gate coverage for /library/search (QA r1.3) — chai-safe asserts (no jest-dom).
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import type { LibraryResource } from "@shared/library";
import SearchPage from "./SearchPage";

const { sanityFetch } = vi.hoisted(() => ({ sanityFetch: vi.fn() }));

vi.mock("@/lib/sanity", () => ({
  isSanityConfigured: true,
  sanityClient: { fetch: (...args: unknown[]) => sanityFetch(...args) },
}));

/** Avoid cross-test pollution of the module-level filters promise. */
vi.mock("@/pages/library/filtersCache", () => ({
  getLibraryFilters: (signal?: AbortSignal) =>
    fetch("/api/library/filters", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`filters_${res.status}`);
      return res.json();
    }),
}));

class NeverIntersecting {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const fetchMock = vi.fn();

function access(
  partial: Partial<LibraryResource["access"]> & {
    access: LibraryResource["access"]["access"];
  },
): LibraryResource["access"] {
  return {
    has_content_access: false,
    user_has_access: true,
    has_preview: false,
    is_exclusive: false,
    show_same: 0,
    show_video_in_preview: false,
    access_group_labels: [],
    ...partial,
  };
}

function card(id: number, title: string, a: LibraryResource["access"]): LibraryResource {
  return {
    id,
    type: "post",
    title,
    excerpt: `Excerpt ${id}`,
    date: "2026-01-15T00:00:00Z",
    image: null,
    permalink: null,
    author: null,
    categories: [],
    topics: [],
    content_types: [{ id: 1, name: "Articles", slug: "articles" }],
    access: a,
  };
}

function searchBody(resources: LibraryResource[], total = resources.length, hasMore = false) {
  return {
    resources,
    meta: { total, count: resources.length, limit: 24, offset: 0, has_more: hasMore },
  };
}

const OPEN = card(1, "Open A", access({ access: "full" }));
const OPEN2 = card(2, "Open B", access({ access: "full" }));
const OPEN3 = card(3, "Open C", access({ access: "full" }));
const EXCL = card(
  4,
  "EXCL-A",
  access({ access: "none", is_exclusive: true, user_has_access: false }),
);
const GATE = card(
  5,
  "GATE-B",
  access({ access: "none", has_content_access: true, user_has_access: false }),
);

function Mounted() {
  return (
    <Router>
      <Switch>
        <Route path="/library/search" component={SearchPage} />
      </Switch>
    </Router>
  );
}

function searchUrls(): string[] {
  return fetchMock.mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes("/api/library/search"));
}

function defaultMocks() {
  sanityFetch.mockResolvedValue({
    copyrightText: "© test",
    navLinks: [],
    searchTopics: [
      { topic_id: 13, label: "Women's Health & Hormones" },
      { topic_id: 99, label: "Professional Library" },
    ],
  });
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/library/filters")) {
      return {
        ok: true,
        json: async () => ({
          topics: [
            { id: 11, name: "Metabolic Health", slug: "metabolic-health" },
            { id: 12, name: "Coaches", slug: "coaches" },
            { id: 13, name: "Women's Health", slug: "womens-health" },
          ],
          content_type_terms: [],
          categories: [],
        }),
      };
    }
    if (url.includes("/api/library/search")) {
      return { ok: true, json: async () => searchBody([OPEN, OPEN2, OPEN3], 3) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

describe("/library/search mount", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    sanityFetch.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.stubGlobal("IntersectionObserver", NeverIntersecting);
    window.history.replaceState(null, "", "/library/search");
    defaultMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("SS1–SS3 breadcrumb, h1, input", async () => {
    render(<Mounted />);
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Search All Resources");
    const crumb = screen.getByLabelText("Breadcrumb");
    expect(crumb.textContent?.replace(/\s+/g, " ")).toMatch(
      /HOME\s*\/\s*RESOURCE LIBRARY\s*\/\s*SEARCH/,
    );
    expect(screen.getByRole("link", { name: "HOME" }).getAttribute("href")).toBe("/");
    expect(
      screen.getByRole("link", { name: "RESOURCE LIBRARY" }).getAttribute("href"),
    ).toBe("/library");
    expect(screen.getByText("SEARCH").getAttribute("aria-current")).toBe("page");
    const input = screen.getByPlaceholderText("What are you looking for?");
    expect(input.getAttribute("maxLength")).toBe("120");
    expect(input.getAttribute("aria-label")).toBeTruthy();
  });

  it("SS5 pills + SS7 Sanity-first tabs", async () => {
    render(<Mounted />);
    await screen.findByRole("heading", { level: 1 });
    const pills = screen.getByRole("group", { name: "Content types" });
    expect([...pills.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "All Types",
      "Videos",
      "Articles",
      "Live Streams",
      "Infographics",
    ]);
    await waitFor(() => {
      const tabs = screen.getByRole("tablist");
      expect([...tabs.querySelectorAll('[role="tab"]')].map((b) => b.textContent)).toEqual([
        "All",
        "Women's Health & Hormones",
        "Professional Library",
        "Metabolic Health",
        "Coaches",
      ]);
    });
  });

  it("SS4 submit-only", async () => {
    render(<Mounted />);
    await screen.findByRole("heading", { level: 1 });
    const before = searchUrls().length;
    const input = screen.getByPlaceholderText("What are you looking for?");
    fireEvent.change(input, { target: { value: "abcdefghij" } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(searchUrls().length).toBe(before);
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => {
      expect(searchUrls().some((u) => u.includes("query=abcdefghij"))).toBe(true);
    });
  });

  it("SS8 pill kept when tab changes; All clears topic only", async () => {
    render(<Mounted />);
    await screen.findByRole("tab", { name: "Metabolic Health" });
    fireEvent.click(screen.getByRole("button", { name: "Videos" }));
    fireEvent.click(screen.getByRole("tab", { name: "Metabolic Health" }));
    await waitFor(() => {
      const last = searchUrls().at(-1)!;
      expect(last).toContain("videos");
      expect(last).toContain("11");
    });
    expect(screen.getByRole("button", { name: "Videos" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    await waitFor(() => {
      const last = searchUrls().at(-1)!;
      expect(last).toContain("videos");
      expect(last.includes("topics")).toBe(false);
    });
  });

  it("SS9 count uses meta.total", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/library/filters")) {
        return {
          ok: true,
          json: async () => ({
            topics: [{ id: 11, name: "Metabolic Health", slug: "m" }],
            content_type_terms: [],
            categories: [],
          }),
        };
      }
      if (url.includes("/api/library/search")) {
        return { ok: true, json: async () => searchBody([OPEN, OPEN2, OPEN3], 40) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    render(<Mounted />);
    await waitFor(() => {
      expect(screen.getByTestId("search-count").textContent).toContain("40 resources");
    });
  });

  it("SS12 error then retry → empty", async () => {
    let allow = false;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/library/filters")) {
        return {
          ok: true,
          json: async () => ({ topics: [], content_type_terms: [], categories: [] }),
        };
      }
      if (url.includes("/api/library/search")) {
        if (!allow) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, json: async () => searchBody([], 0) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    render(<Mounted />);
    expect(await screen.findByText(/Something went wrong/i)).toBeTruthy();
    allow = true;
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(await screen.findByText("No results found")).toBeTruthy();
  });

  it("SS13 topic=555 sent; All not selected", async () => {
    window.history.replaceState(null, "", "/library/search?topic=555");
    render(<Mounted />);
    await waitFor(() => {
      expect(searchUrls().some((u) => u.includes("555"))).toBe(true);
    });
    expect(screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected")).toBe(
      "false",
    );
  });

  it("SC-T3 lock-not-hide + JoinModal", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/library/filters")) {
        return {
          ok: true,
          json: async () => ({ topics: [], content_type_terms: [], categories: [] }),
        };
      }
      if (url.includes("/api/library/search")) {
        return {
          ok: true,
          json: async () => searchBody([OPEN, OPEN2, OPEN3, EXCL, GATE], 40, true),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    render(<Mounted />);
    await waitFor(() => expect(screen.getByText("EXCL-A")).toBeTruthy());
    expect(screen.getByText("GATE-B")).toBeTruthy();
    expect(screen.getByTestId("search-count").textContent).toContain("40 resources");
    expect(document.querySelectorAll(".library-card-lock").length).toBe(2);
    fireEvent.click(screen.getByLabelText(/Locked: EXCL-A/i));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(window.location.pathname).toBe("/library/search");
  });

  it("SC-T7 gated body/video absent from DOM", async () => {
    const gated = {
      ...EXCL,
      content: "GATED-BODY-91",
      video: "https://media.example/GATED-VID-91.m3u8",
    } as LibraryResource & { content?: string; video?: string };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/library/filters")) {
        return {
          ok: true,
          json: async () => ({ topics: [], content_type_terms: [], categories: [] }),
        };
      }
      if (url.includes("/api/library/search")) {
        return { ok: true, json: async () => searchBody([gated], 1) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    const { container } = render(<Mounted />);
    await screen.findByText("EXCL-A");
    expect(container.innerHTML.includes("GATED-BODY-91")).toBe(false);
    expect(container.innerHTML.includes("GATED-VID-91")).toBe(false);
  });

  it("SN-T4 both sources fail → only All", async () => {
    sanityFetch.mockRejectedValue(new Error("down"));
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/library/filters")) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (url.includes("/api/library/search")) {
        return { ok: true, json: async () => searchBody([], 0) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    render(<Mounted />);
    await waitFor(() => {
      const tabs = screen.getByRole("tablist").querySelectorAll('[role="tab"]');
      expect([...tabs].map((t) => t.textContent)).toEqual(["All"]);
    });
  });

  it("SS10 clear filters resets query/pill/tab and refetches bare search", async () => {
    render(<Mounted />);
    await screen.findByRole("tab", { name: "Metabolic Health" });
    expect(screen.queryByText(/Clear filters/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Videos" }));
    await waitFor(() => expect(screen.getByText(/Clear filters/i)).toBeTruthy());
    const before = searchUrls().length;
    fireEvent.click(screen.getByText(/Clear filters/i));
    await waitFor(() => expect(searchUrls().length).toBe(before + 1));
    const last = searchUrls().at(-1)!;
    expect(last.includes("query=")).toBe(false);
    expect(last.includes("content_type_terms")).toBe(false);
    expect(last.includes("topics")).toBe(false);
    expect(screen.queryByText(/Clear filters/i)).toBeNull();
    expect(screen.getByRole("button", { name: "All Types" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected")).toBe("true");
  });

  it("SS13 full URL + SS18 pill keeps topic", async () => {
    window.history.replaceState(
      null,
      "",
      "/library/search?query=fat&type=videos&topic=11",
    );
    render(<Mounted />);
    await waitFor(() => {
      expect(searchUrls().some((u) => u.includes("query=fat") && u.includes("videos") && u.includes("11"))).toBe(
        true,
      );
    });
    expect(
      (screen.getByPlaceholderText("What are you looking for?") as HTMLInputElement).value,
    ).toBe("fat");
    expect(screen.getByRole("button", { name: "Videos" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("tab", { name: "Metabolic Health" }).getAttribute("aria-selected"),
      ).toBe("true"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Articles" }));
    await waitFor(() => {
      const last = searchUrls().at(-1)!;
      expect(last).toContain("articles");
      expect(last).toContain("11");
    });
    expect(
      screen.getByRole("tab", { name: "Metabolic Health" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("SS17(c) re-click selected tab → 0 new searches; CQ-T1 tab adds 1 search 0 Sanity", async () => {
    render(<Mounted />);
    await screen.findByRole("tab", { name: "Metabolic Health" });
    const sanityBefore = sanityFetch.mock.calls.length;
    const before = searchUrls().length;
    fireEvent.click(screen.getByRole("tab", { name: "Metabolic Health" }));
    await waitFor(() => expect(searchUrls().length).toBe(before + 1));
    expect(sanityFetch.mock.calls.length).toBe(sanityBefore);
    const mid = searchUrls().length;
    fireEvent.click(screen.getByRole("tab", { name: "Metabolic Health" }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(searchUrls().length).toBe(mid);
  });

  it("SS17(b) rapid tab A→B aborts A", async () => {
    const controllers: AbortSignal[] = [];
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/library/filters")) {
        return {
          ok: true,
          json: async () => ({
            topics: [
              { id: 11, name: "Metabolic Health", slug: "m" },
              { id: 12, name: "Coaches", slug: "c" },
            ],
            content_type_terms: [],
            categories: [],
          }),
        };
      }
      if (url.includes("/api/library/search")) {
        if (init?.signal) controllers.push(init.signal);
        await new Promise((r) => setTimeout(r, 40));
        if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const topics = new URL(url, "http://x").searchParams.getAll("topics[]");
        const id = topics[0] === "12" ? 12 : 11;
        return {
          ok: true,
          json: async () =>
            searchBody([card(id, id === 12 ? "Only Coaches Card" : "Stale Metabolic", access({ access: "full" }))], 1),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    render(<Mounted />);
    await screen.findByRole("tab", { name: "Metabolic Health" });
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Metabolic Health" }));
      fireEvent.click(screen.getByRole("tab", { name: "Coaches" }));
    });
    await waitFor(() => expect(screen.getByText("Only Coaches Card")).toBeTruthy());
    expect(screen.queryByText("Stale Metabolic")).toBeNull();
    expect(controllers.some((s) => s.aborted)).toBe(true);
  });
});
