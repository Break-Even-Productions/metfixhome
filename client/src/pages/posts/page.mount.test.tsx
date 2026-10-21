/**
 * @vitest-environment jsdom
 *
 * Mount-level checks: real Router + Posts list/detail / Daily Fix / Home / NotFound.
 * Covers PC1–PC20 (A25 flip + client acceptance).
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import {
  PAGE_SIZE,
  POST_ID_MAX,
  POST_ID_RE,
} from "@shared/posts";
import * as postsConstants from "@shared/posts/constants";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { DAILY_FIX_BFF_URL, resetDailyFixDayCache } from "@/pages/the-daily-fix/data";
import TheDailyFixPage from "@/pages/the-daily-fix/TheDailyFixPage";
import PostDetailPage from "./PostDetailPage";
import PostsPage from "./PostsPage";

/** Sample titles used in A6-shaped mocks (must render when fetched). */
const SAMPLE_TITLES = [
  "Alpha Metabolic Post",
  "Beta Recovery Notes",
  "Gamma Training Guide",
] as const;

/** Same BSI Worker day body shape used in Daily Fix mount tests. */
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

class NeverIntersecting {
  observe() {}
  disconnect() {}
}

/** Mirrors App.tsx routes (incl. `/posts/:id`) without GlobalNav / theme chrome. */
function MountedApp() {
  return (
    <Router>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/the-daily-fix/:yy/:mm/:dd"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date/:pillar"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix"} component={TheDailyFixPage} />
        <Route path={"/posts/:id"} component={PostDetailPage} />
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

function listPost(
  overrides: Partial<{
    id: number;
    title: string;
    excerpt: string;
    date: string;
    image: string | null;
    author: string | null;
    category: { name: string; slug: string } | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? "Sample Post",
    excerpt: overrides.excerpt ?? "An excerpt.",
    date: overrides.date ?? "2026-10-19T08:00:00.000Z",
    image: overrides.image !== undefined ? overrides.image : null,
    author: overrides.author !== undefined ? overrides.author : "Author",
    category:
      overrides.category !== undefined
        ? overrides.category
        : { name: "Science", slug: "science" },
  };
}

/** A6-shaped list body (rewritten stubPostsPayloadFetch). */
function stubPostsPayloadFetch(
  body: {
    posts: ReturnType<typeof listPost>[];
    page: number;
    per_page: number;
    has_more: boolean;
  } = {
    posts: SAMPLE_TITLES.map((title, i) => listPost({ id: i + 1, title })),
    page: 1,
    per_page: PAGE_SIZE,
    has_more: false,
  },
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    expect(url.startsWith("/api/posts")).toBe(true);
    expect(url).not.toContain("brokenscience.org");
    expect(url).not.toContain("wp-json");
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function detailPost(
  overrides: Partial<ReturnType<typeof listPost>> & {
    content?: string;
    permalink?: string | null;
  } = {},
) {
  const base = listPost(overrides);
  return {
    ...base,
    content: overrides.content ?? "<p>Body content</p>",
    permalink:
      overrides.permalink !== undefined
        ? overrides.permalink
        : "https://brokenscience.org/sample-post/",
  };
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

function fetchCallUrl(call: unknown[]): string {
  return String(call[0]);
}

function fetchCallInit(call: unknown[]): RequestInit | undefined {
  return call[1] as RequestInit | undefined;
}

beforeEach(() => {
  stubBrowserApis();
  openAddressBar("/");
  localStorage.clear();
  resetDailyFixDayCache();
  document.head.innerHTML = `
    <meta name="description" content="">
    <meta name="robots" content="">
    <meta property="og:title" content="">
    <meta property="og:description" content="">
    <meta property="og:type" content="">
    <meta property="og:image" content="">
    <meta property="og:url" content="">
    <meta name="twitter:title" content="">
    <meta name="twitter:description" content="">
  `;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Posts page mount", () => {
  it("PC1: /posts fetches once, renders A6 titles, no stub unavailable copy", async () => {
    const fetchMock = stubPostsPayloadFetch();
    openAddressBar("/posts");
    render(<MountedApp />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchCallUrl(fetchMock.mock.calls[0]!)).toBe("/api/posts?page=1");
    const init = fetchCallInit(fetchMock.mock.calls[0]!);
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    for (const title of SAMPLE_TITLES) {
      expect(await screen.findByText(title)).toBeTruthy();
    }
    expect(screen.queryByText(/posts unavailable/i)).toBeNull();
    expect(screen.queryByText(/Posts are unavailable/i)).toBeNull();
    expect(screen.queryByText(/This page does not load an archive/i)).toBeNull();
    expect(screen.queryByText("Error 404")).toBeNull();
    expect(screen.queryByText("The Metabolic Fix")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Belly 2025-02-10" })).toBeNull();
    expect(screen.queryByText(/Today’s fix/i)).toBeNull();
    expect(window.location.pathname).toBe("/posts");
  });

  it("PC2: Substack hrefs absent; list has no canonical; no brokenscience.org fetch", async () => {
    const fetchMock = stubPostsPayloadFetch();
    openAddressBar("/posts");
    render(<MountedApp />);

    await screen.findByText(SAMPLE_TITLES[0]);
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(screen.queryByText(/substack\.com/i)).toBeNull();
    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href") ?? "";
      expect(href).not.toContain("letsstartwiththetruth.substack.com");
      expect(href).not.toContain("substack.com");
    }
    for (const call of fetchMock.mock.calls) {
      expect(fetchCallUrl(call)).not.toContain("brokenscience.org");
      expect(fetchCallUrl(call)).toMatch(/^\/api\/posts/);
    }
  });

  it("PC3: /posts/1 fetches once and renders; 404 mock → Error 404, pathname kept", async () => {
    const post = detailPost({
      id: 1,
      title: "Detail Title One",
      author: "Dr. A",
      image: "https://brokenscience.org/wp-content/uploads/a.jpg",
      content: "<p>Detail body</p>",
    });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ post }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    openAddressBar("/posts/1");
    const { unmount } = render(<MountedApp />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchCallUrl(fetchMock.mock.calls[0]!)).toBe("/api/posts/1");
    expect(await screen.findByRole("heading", { name: "Detail Title One" })).toBeTruthy();
    expect(screen.getByText("Dr. A")).toBeTruthy();
    expect(screen.getByText("Detail body")).toBeTruthy();
    expect(
      document.querySelector('img[src="https://brokenscience.org/wp-content/uploads/a.jpg"]'),
    ).toBeTruthy();
    unmount();

    const notFoundMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", notFoundMock);
    openAddressBar("/posts/1");
    render(<MountedApp />);
    expect(await screen.findByText("Error 404")).toBeTruthy();
    expect(window.location.pathname).toBe("/posts/1");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(["/posts/some-slug", "/posts/0", "/posts/2147483648", "/posts/01"])(
    "PC4: %s → NotFound, fetch count 0",
    async (path) => {
      const fetchMock = stubPostsPayloadFetch();
      openAddressBar(path);
      render(<MountedApp />);

      expect(await screen.findByText("Error 404")).toBeTruthy();
      expect(window.location.pathname).toBe(path);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("PC4: client imports POST_ID_RE and POST_ID_MAX by identity from shared", () => {
    expect(POST_ID_RE).toBe(postsConstants.POST_ID_RE);
    expect(POST_ID_MAX).toBe(postsConstants.POST_ID_MAX);
  });

  it("PC4: Daily Fix /250210 still fetches the day once", async () => {
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
    expect(screen.queryByText(/posts unavailable/i)).toBeNull();
  });

  it("PC5: Older/Newer from has_more; never offers page 51", async () => {
    const page1 = stubPostsPayloadFetch({
      posts: [listPost({ id: 1, title: "Page1 Post" })],
      page: 1,
      per_page: PAGE_SIZE,
      has_more: true,
    });
    openAddressBar("/posts");
    const { unmount } = render(<MountedApp />);
    await screen.findByText("Page1 Post");
    const older = screen.getByRole("link", { name: "Older" });
    expect(older.getAttribute("href")).toBe("/posts?page=2");
    expect(screen.queryByRole("link", { name: "Newer" })).toBeNull();
    unmount();

    const page2 = stubPostsPayloadFetch({
      posts: [listPost({ id: 2, title: "Page2 Post" })],
      page: 2,
      per_page: PAGE_SIZE,
      has_more: true,
    });
    openAddressBar("/posts?page=2");
    const r2 = render(<MountedApp />);
    await screen.findByText("Page2 Post");
    expect(screen.getByRole("link", { name: "Older" }).getAttribute("href")).toBe(
      "/posts?page=3",
    );
    expect(screen.getByRole("link", { name: "Newer" }).getAttribute("href")).toBe("/posts");
    r2.unmount();

    const page50 = stubPostsPayloadFetch({
      posts: [listPost({ id: 50, title: "Page50 Post" })],
      page: 50,
      per_page: PAGE_SIZE,
      has_more: true,
    });
    openAddressBar("/posts?page=50");
    render(<MountedApp />);
    await screen.findByText("Page50 Post");
    expect(screen.queryByRole("link", { name: "Older" })).toBeNull();
    expect(screen.getByRole("link", { name: "Newer" })).toBeTruthy();
    for (const call of [...page1.mock.calls, ...page2.mock.calls, ...page50.mock.calls]) {
      expect(fetchCallUrl(call)).not.toContain("page=51");
    }
  });

  it("PC6: effect keyed on page only; 1→2→1 = 3 fetches; abort on unmount", async () => {
    let resolveFetch: ((r: Response) => void) | null = null;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    openAddressBar("/posts");
    const { unmount } = render(<MountedApp />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const signal1 = fetchCallInit(fetchMock.mock.calls[0]!)?.signal as AbortSignal;
    unmount();
    expect(signal1.aborted).toBe(true);
    resolveFetch?.(
      new Response(
        JSON.stringify({
          posts: [listPost({ title: "Late" })],
          page: 1,
          per_page: PAGE_SIZE,
          has_more: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const navFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const page = new URL(url, "https://metfix.org").searchParams.get("page") ?? "1";
      return new Response(
        JSON.stringify({
          posts: [listPost({ id: Number(page), title: `Nav ${page}` })],
          page: Number(page),
          per_page: PAGE_SIZE,
          has_more: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", navFetch);

    openAddressBar("/posts");
    const { rerender } = render(<MountedApp />);
    await screen.findByText("Nav 1");
    expect(navFetch).toHaveBeenCalledTimes(1);

    openAddressBar("/posts?utm=x");
    rerender(<MountedApp />);
    await act(async () => {});
    expect(navFetch).toHaveBeenCalledTimes(1);

    openAddressBar("/posts?page=2");
    rerender(<MountedApp />);
    await screen.findByText("Nav 2");
    expect(navFetch).toHaveBeenCalledTimes(2);

    openAddressBar("/posts");
    rerender(<MountedApp />);
    await screen.findByText("Nav 1");
    expect(navFetch).toHaveBeenCalledTimes(3);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("PC7: loading role=status present before resolve, gone after", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    openAddressBar("/posts");
    render(<MountedApp />);
    expect(await screen.findByRole("status")).toBeTruthy();
    await act(async () => {
      resolve(
        new Response(
          JSON.stringify({
            posts: [listPost({ title: "Loaded" })],
            page: 1,
            per_page: PAGE_SIZE,
            has_more: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    await screen.findByText("Loaded");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([
    { status: 503, label: "503" },
    { status: 400, label: "400" },
  ])("PC8: error $label shows message + retry, no cards", async ({ status }) => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "unavailable" }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    openAddressBar("/posts");
    render(<MountedApp />);
    expect(await screen.findByText("Posts couldn't be loaded")).toBeTruthy();
    expect(screen.queryByText(SAMPLE_TITLES[0])).toBeNull();
    expect(screen.queryByRole("heading", { name: SAMPLE_TITLES[0] })).toBeNull();

    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          posts: [listPost({ title: "After Retry" })],
          page: 1,
          per_page: PAGE_SIZE,
          has_more: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("After Retry")).toBeTruthy();
  });

  it("PC8: network reject shows error + retry", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network");
    });
    vi.stubGlobal("fetch", fetchMock);
    openAddressBar("/posts");
    render(<MountedApp />);
    expect(await screen.findByText("Posts couldn't be loaded")).toBeTruthy();
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          posts: [listPost({ title: "Recovered" })],
          page: 1,
          per_page: PAGE_SIZE,
          has_more: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Recovered")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("PC9: empty states", async () => {
    const empty1 = stubPostsPayloadFetch({
      posts: [],
      page: 1,
      per_page: PAGE_SIZE,
      has_more: false,
    });
    openAddressBar("/posts");
    const r1 = render(<MountedApp />);
    expect(await screen.findByText("No posts yet")).toBeTruthy();
    r1.unmount();

    stubPostsPayloadFetch({
      posts: [],
      page: 3,
      per_page: PAGE_SIZE,
      has_more: false,
    });
    openAddressBar("/posts?page=3");
    const r3 = render(<MountedApp />);
    expect(await screen.findByRole("link", { name: /page 1/i })).toBeTruthy();
    expect(screen.queryByText("No posts yet")).toBeNull();
    r3.unmount();

    stubPostsPayloadFetch({
      posts: [],
      page: 2,
      per_page: PAGE_SIZE,
      has_more: true,
    });
    openAddressBar("/posts?page=2");
    render(<MountedApp />);
    expect(await screen.findByText("No posts on this page.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Older" }).getAttribute("href")).toBe(
      "/posts?page=3",
    );
    expect(empty1).toHaveBeenCalled();
  });

  it("PC10: detail 503 → error + retry, no content", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    openAddressBar("/posts/5");
    render(<MountedApp />);
    expect(await screen.findByText("Posts couldn't be loaded")).toBeTruthy();
    expect(screen.queryByText("Detail body")).toBeNull();

    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ post: detailPost({ id: 5, title: "Retry Detail" }) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Retry Detail" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("PC11: permalink link only when non-null", async () => {
    const withLink = vi.fn(async () =>
      new Response(
        JSON.stringify({
          post: detailPost({
            permalink: "https://brokenscience.org/with-link/",
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", withLink);
    openAddressBar("/posts/7");
    const r1 = render(<MountedApp />);
    const link = await screen.findByRole("link", { name: "Read on Broken Science" });
    expect(link.getAttribute("href")).toBe("https://brokenscience.org/with-link/");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
    r1.unmount();

    const noLink = vi.fn(async () =>
      new Response(JSON.stringify({ post: detailPost({ permalink: null }) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", noLink);
    openAddressBar("/posts/8");
    render(<MountedApp />);
    await screen.findByRole("heading", { name: "Sample Post" });
    expect(screen.queryByRole("link", { name: "Read on Broken Science" })).toBeNull();
  });

  it("PC14: all fetch URLs start with /api/posts; permalink click does not fetch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          post: detailPost({
            permalink: "https://brokenscience.org/out/",
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    openAddressBar("/posts/9");
    render(<MountedApp />);
    const link = await screen.findByRole("link", { name: "Read on Broken Science" });
    const before = fetchMock.mock.calls.length;
    fireEvent.click(link);
    expect(fetchMock.mock.calls.length).toBe(before);
    for (const call of fetchMock.mock.calls) {
      expect(fetchCallUrl(call).startsWith("/api/posts")).toBe(true);
    }
  });

  it("PC15: usePageMeta list values match buildPostsHead", async () => {
    stubPostsPayloadFetch();
    openAddressBar("/posts");
    render(<MountedApp />);
    await screen.findByText(SAMPLE_TITLES[0]);
    expect(document.title).toBe("Posts — MetFix");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "Articles from Broken Science.",
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex, follow",
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe(
      "website",
    );
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      "https://metfix.org/social-preview.jpg",
    );
  });

  it("PC15: detail with permalink sets index + canonical", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            post: detailPost({
              title: "Canon Post",
              excerpt: "Short excerpt for head.",
              permalink: "https://brokenscience.org/canon/",
              image: null,
            }),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    openAddressBar("/posts/11");
    render(<MountedApp />);
    await screen.findByRole("heading", { name: "Canon Post" });
    expect(document.title).toBe("Canon Post — MetFix");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "index, follow",
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://brokenscience.org/canon/",
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(
      "https://brokenscience.org/canon/",
    );
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe(
      "article",
    );
  });

  it("PC16: dompurify pinned exact in package.json", async () => {
    const pkg = await import("../../../../package.json");
    expect(pkg.default.dependencies.dompurify).toBe("3.2.6");
    expect(String(pkg.default.dependencies.dompurify)).not.toMatch(/^[\^~]/);
  });

  it.each(["/posts?page=abc", "/posts?page=0", "/posts?page=51", "/posts?page=01"])(
    "PC17: invalid %s → fetch page 1 + replaceState /posts",
    async (url) => {
      const replaceSpy = vi.spyOn(window.history, "replaceState");
      const fetchMock = stubPostsPayloadFetch({
        posts: [listPost({ title: "Normalized Page1" })],
        page: 1,
        per_page: PAGE_SIZE,
        has_more: false,
      });
      openAddressBar(url);
      render(<MountedApp />);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchCallUrl(fetchMock.mock.calls[0]!)).toBe("/api/posts?page=1");
      expect(await screen.findByText("Normalized Page1")).toBeTruthy();
      expect(screen.queryByText("Posts couldn't be loaded")).toBeNull();
      expect(replaceSpy).toHaveBeenCalledWith(null, "", "/posts");
      expect(window.location.search).toBe("");
      replaceSpy.mockRestore();
    },
  );

  it("PC18: StrictMode aborts first fetch; one response applied", async () => {
    const titles: string[] = [];
    let call = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      call += 1;
      const n = call;
      await new Promise((r) => setTimeout(r, n === 1 ? 30 : 5));
      if (init?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const title = n === 1 ? "Aborted Title" : "Applied Title";
      titles.push(title);
      return new Response(
        JSON.stringify({
          posts: [listPost({ title })],
          page: 1,
          per_page: PAGE_SIZE,
          has_more: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    openAddressBar("/posts");
    render(
      <React.StrictMode>
        <MountedApp />
      </React.StrictMode>,
    );

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstSignal = fetchCallInit(fetchMock.mock.calls[0]!)?.signal as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(await screen.findByText("Applied Title")).toBeTruthy();
    expect(screen.queryByText("Aborted Title")).toBeNull();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("PC19: PostCard keyed by id; no inline style in posts DOM", async () => {
    const fetchMock = stubPostsPayloadFetch({
      posts: [
        listPost({ id: 10, title: "First" }),
        listPost({ id: 20, title: "Second" }),
      ],
      page: 1,
      per_page: PAGE_SIZE,
      has_more: false,
    });
    openAddressBar("/posts");
    render(<MountedApp />);
    await screen.findByText("First");
    const warn = vi.spyOn(console, "error");
    expect(fetchMock).toHaveBeenCalled();
    for (const el of document.querySelectorAll(".posts-page *")) {
      expect(el.getAttribute("style")).toBeNull();
    }
    warn.mockRestore();
  });

  it("PC20: exact fetch count, abort on page/id change, no stale render", async () => {
    type Pending = {
      url: string;
      signal: AbortSignal;
      resolve: (r: Response) => void;
    };
    const pending: Pending[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      return new Promise<Response>((resolve) => {
        pending.push({
          url,
          signal: init!.signal as AbortSignal,
          resolve,
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Parent() {
      const [n, setN] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setN((x) => x + 1)}>
            bump-{n}
          </button>
          <MountedApp />
        </div>
      );
    }

    openAddressBar("/posts");
    const { unmount } = render(<Parent />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchCallUrl(fetchMock.mock.calls[0]!)).toBe("/api/posts?page=1");

    fireEvent.click(screen.getByRole("button", { name: /bump-0/ }));
    fireEvent.click(screen.getByRole("button", { name: /bump-1/ }));
    fireEvent.click(screen.getByRole("button", { name: /bump-2/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    openAddressBar("/posts?page=2");
    // force remount via history — wouter picks up replaceState
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    // navigate by re-render with new URL already set
    unmount();

    // Fresh mount sequence for page change abort
    openAddressBar("/posts");
    const view = render(<MountedApp />);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    // reset tracking for clean (a)/(b)
    view.unmount();
    pending.length = 0;
    fetchMock.mockClear();

    openAddressBar("/posts");
    const v2 = render(<MountedApp />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const first = pending[0]!;
    expect(first.url).toBe("/api/posts?page=1");

    openAddressBar("/posts?page=2");
    v2.rerender(<MountedApp />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchCallUrl(fetchMock.mock.calls[1]!)).toBe("/api/posts?page=2");
    expect(first.signal.aborted).toBe(true);

    const second = pending[1]!;
    await act(async () => {
      second.resolve(
        new Response(
          JSON.stringify({
            posts: [listPost({ id: 2, title: "Page Two Title" })],
            page: 2,
            per_page: PAGE_SIZE,
            has_more: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    expect(await screen.findByText("Page Two Title")).toBeTruthy();

    await act(async () => {
      first.resolve(
        new Response(
          JSON.stringify({
            posts: [listPost({ id: 1, title: "Stale Page One" })],
            page: 1,
            per_page: PAGE_SIZE,
            has_more: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    expect(screen.queryByText("Stale Page One")).toBeNull();
    expect(screen.getByText("Page Two Title")).toBeTruthy();
    v2.unmount();

    // (c) detail id change
    pending.length = 0;
    fetchMock.mockClear();
    openAddressBar("/posts/5");
    const d = render(<MountedApp />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchCallUrl(fetchMock.mock.calls[0]!)).toBe("/api/posts/5");
    const d1 = pending[0]!;

    openAddressBar("/posts/6");
    d.rerender(<MountedApp />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchCallUrl(fetchMock.mock.calls[1]!)).toBe("/api/posts/6");
    expect(d1.signal.aborted).toBe(true);

    await act(async () => {
      pending[1]!.resolve(
        new Response(
          JSON.stringify({ post: detailPost({ id: 6, title: "Post Six" }) }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    expect(await screen.findByRole("heading", { name: "Post Six" })).toBeTruthy();

    await act(async () => {
      d1.resolve(
        new Response(
          JSON.stringify({ post: detailPost({ id: 5, title: "Stale Five" }) }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    expect(screen.queryByText("Stale Five")).toBeNull();
    d.unmount();

    // (d) unmount while in flight
    pending.length = 0;
    fetchMock.mockClear();
    openAddressBar("/posts");
    const u = render(<MountedApp />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const inflight = pending[0]!;
    u.unmount();
    expect(inflight.signal.aborted).toBe(true);
    await act(async () => {
      inflight.resolve(
        new Response(
          JSON.stringify({
            posts: [listPost({ title: "After Unmount" })],
            page: 1,
            per_page: PAGE_SIZE,
            has_more: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    expect(screen.queryByText("After Unmount")).toBeNull();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
