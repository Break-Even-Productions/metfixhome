/**
 * @vitest-environment jsdom
 *
 * SS16 / TC-T9 — LibraryPage search handoff to /library/search.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import type { LibraryResource } from "@shared/library";

const { sanityFetch } = vi.hoisted(() => ({
  sanityFetch: vi.fn(),
}));

vi.mock("@/lib/sanity", () => ({
  isSanityConfigured: true,
  sanityClient: {
    fetch: (...args: unknown[]) => sanityFetch(...args),
  },
}));

class NeverIntersecting {
  observe() {}
  disconnect() {}
  unobserve() {}
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

function emptySearchBody() {
  return {
    resources: [] as LibraryResource[],
    meta: {
      total: 0,
      count: 0,
      limit: 24,
      offset: 0,
      has_more: false,
    },
  };
}

describe("librarySearchHandoff SS16 / TC-T9", () => {
  let LibraryPage: ComponentType;
  let SearchPage: ComponentType;
  let fetchLog: Array<{ path: string; params: URLSearchParams }>;

  async function loadModules() {
    vi.resetModules();
    sanityFetch.mockReset();
    sanityFetch.mockImplementation(async (query: string) => {
      if (typeof query === "string" && query.includes("siteSettings")) {
        return {
          copyrightText: "©",
          navLinks: [],
          searchTopics: [],
        };
      }
      return [];
    });
    LibraryPage = (await import("./LibraryPage")).default;
    SearchPage = (await import("../search/SearchPage")).default;
  }

  function installFetch() {
    fetchLog = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const raw = String(input);
      const u = new URL(raw, "http://local.test");
      expect(u.pathname.startsWith("/api/library/")).toBe(true);
      fetchLog.push({ path: u.pathname, params: u.searchParams });
      if (u.pathname === "/api/library/filters") {
        return new Response(
          JSON.stringify({
            topics: [],
            content_type_terms: [],
            categories: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(emptySearchBody()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function renderHub() {
    openAddressBar("/library");
    return render(
      <Router>
        <Switch>
          <Route path="/library/search" component={SearchPage} />
          <Route path="/library" component={LibraryPage} />
        </Switch>
      </Router>,
    );
  }

  beforeEach(async () => {
    stubBrowserApis();
    installFetch();
    await loadModules();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("SS16 Videos + trimmed query → /library/search?query=keto&type=videos", async () => {
    renderHub();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
        /Resource Library/,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Videos" }));
    const input = screen.getByLabelText("Search resources") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  keto  " } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/library/search");
    });
    expect(window.location.search).toBe("?query=keto&type=videos");

    await waitFor(() => {
      const searches = fetchLog.filter((l) => l.path === "/api/library/search");
      const fromSearchPage = searches.find(
        (l) =>
          l.params.get("query") === "keto" &&
          l.params.getAll("content_type_terms[]").includes("videos"),
      );
      expect(fromSearchPage).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        "Search All Resources",
      );
    });
  });

  it("SS16 journal-clubs chip → type absent; empty submit → no query", async () => {
    renderHub();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
        /Resource Library/,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Journal Clubs" }));
    const input = screen.getByLabelText("Search resources") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(window.location.pathname).toBe("/library/search"));
    expect(window.location.search).toBe("?query=abc");
    expect(window.location.search).not.toContain("type=");

    cleanup();
    installFetch();
    await loadModules();
    renderHub();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
        /Resource Library/,
      ),
    );
    const emptyInput = screen.getByLabelText("Search resources");
    fireEvent.submit(emptyInput.closest("form")!);
    await waitFor(() => expect(window.location.pathname).toBe("/library/search"));
    expect(window.location.search).toBe("");
  });
});
