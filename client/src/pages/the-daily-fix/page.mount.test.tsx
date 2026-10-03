/**
 * @vitest-environment jsdom
 *
 * Mount-level checks: real Router + TheDailyFixPage / NotFound, mocked fetch.
 * Helper-only assertions (parseDailyFixRoute / fetchIsoForRoute) are not enough here.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import NotFound from "@/pages/NotFound";
import { dailyFixCommentsRequestUrl } from "./comments";
import TheDailyFixPage from "./TheDailyFixPage";
import { DAILY_FIX_BFF_URL } from "./data";
import { bsiTodayIso } from "./model";

/** Same BSI Worker day body shape used in data.test.ts — not shipped as page content. */
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

const FORBIDDEN_STORAGE_KEYS = [
  "metfix-daily-fix-comments",
  "metfix-daily-fix-author",
  "metfix-daily-fix-author-id",
  "metfix-join-demo",
] as const;

/** Mirrors App.tsx Daily Fix + NotFound routes without GlobalNav / theme chrome. */
function MountedDailyFixApp() {
  return (
    <Router>
      <Switch>
        <Route path={"/the-daily-fix/:yy/:mm/:dd"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date/:pillar"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix"} component={TheDailyFixPage} />
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
}

function openAddressBar(url: string) {
  window.history.replaceState(null, "", url);
}

function assertNoBrokenscience(fetchMock: ReturnType<typeof vi.fn>) {
  for (const call of fetchMock.mock.calls) {
    expect(String(call[0])).not.toContain("brokenscience.org");
  }
}

function mockDayAndCommentsFetch(options?: {
  commentsStatus?: number;
  commentsBody?: unknown;
  dayIso?: string;
}) {
  const commentsStatus = options?.commentsStatus ?? 200;
  const commentsBody = options?.commentsBody ?? emptyCommentsBody;
  const dayIso = options?.dayIso ?? "2025-02-10";
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    expect(url).not.toContain("brokenscience.org");
    if (url.includes("/daily-fix/comments")) {
      return new Response(JSON.stringify(commentsBody), {
        status: commentsStatus,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(bsiDayBodyFor(dayIso)), {
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

describe("Daily Fix page mount", () => {
  it("fetches day + comments once for /250210#brain; hash-only pillar changes do not fetch again", async () => {
    const fetchMock = mockDayAndCommentsFetch();
    openAddressBar("/the-daily-fix/250210#brain");
    render(<MountedDailyFixApp />);

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

    await act(async () => {
      window.location.hash = "#body";
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      window.location.hash = "#belly";
    });
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(window.location.hash).toBe("#belly");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    assertNoBrokenscience(fetchMock);
  });

  it("bare /the-daily-fix fetches day + comments once for the Etc/GMT-2 today ISO", async () => {
    const todayIso = bsiTodayIso();
    const fetchMock = mockDayAndCommentsFetch({ dayIso: todayIso });
    openAddressBar("/the-daily-fix");
    render(<MountedDailyFixApp />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledWith(
      `${DAILY_FIX_BFF_URL}?date=${todayIso}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      dailyFixCommentsRequestUrl(todayIso),
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(window.location.pathname).toBe("/the-daily-fix");
    assertNoBrokenscience(fetchMock);
  });

  it("keeps the day loaded when comments return 404", async () => {
    const fetchMock = mockDayAndCommentsFetch({
      commentsStatus: 404,
      commentsBody: { error: "not_found" },
    });
    openAddressBar("/the-daily-fix/250210");
    render(<MountedDailyFixApp />);

    expect(await screen.findByRole("heading", { name: "Steak bowls" })).toBeTruthy();
    expect(await screen.findByText(/Comments are unavailable right now/i)).toBeTruthy();
    expect(screen.queryByText(/This day could not be loaded/i)).toBeNull();
    expect(screen.queryByText(/No comments yet/i)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("thrown comments fetch keeps the day and unavailable copy; loading never shows No comments yet", async () => {
    let rejectComments!: (reason?: unknown) => void;
    const pendingComments = new Promise<Response>((_resolve, reject) => {
      rejectComments = reject;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).not.toContain("brokenscience.org");
      if (url.includes("/daily-fix/comments")) {
        return pendingComments;
      }
      return new Response(JSON.stringify(bsiDayBodyFor("2025-02-10")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    openAddressBar("/the-daily-fix/250210");
    render(<MountedDailyFixApp />);

    expect(await screen.findByRole("heading", { name: "Steak bowls" })).toBeTruthy();
    expect(screen.getByText(/Loading comments/i)).toBeTruthy();
    expect(screen.queryByText(/No comments yet/i)).toBeNull();
    expect(screen.queryByText(/Comments are unavailable right now/i)).toBeNull();

    await act(async () => {
      rejectComments(new TypeError("network"));
      await Promise.resolve();
    });

    expect(await screen.findByText(/Comments are unavailable right now/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Steak bowls" })).toBeTruthy();
    expect(screen.queryByText(/This day could not be loaded/i)).toBeNull();
    expect(screen.queryByText(/No comments yet/i)).toBeNull();
    assertNoBrokenscience(fetchMock);
  });

  it("shows No comments yet only after a real empty list", async () => {
    mockDayAndCommentsFetch({ commentsStatus: 200, commentsBody: emptyCommentsBody });
    openAddressBar("/the-daily-fix/250210");
    render(<MountedDailyFixApp />);

    expect(await screen.findByText("No comments yet.")).toBeTruthy();
    expect(screen.queryByText(/Comments are unavailable/i)).toBeNull();
  });

  it("logged-out submit opens join modal without storage, OAuth, email, GET, or brokenscience", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const fetchMock = mockDayAndCommentsFetch();
    openAddressBar("/the-daily-fix/250210#belly");
    render(<MountedDailyFixApp />);

    expect(await screen.findByRole("heading", { name: "Steak bowls" })).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const callsAfterLoad = fetchMock.mock.calls.length;
    assertNoBrokenscience(fetchMock);

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Pat" } });
    fireEvent.change(screen.getByPlaceholderText(/Share a thought/i), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Post comment/i }));

    expect(await screen.findByRole("dialog", { name: /Join MetFix Today/i })).toBeTruthy();
    expect(window.location.pathname).toBe("/the-daily-fix/250210");
    expect(window.location.hash).toBe("#belly");

    const joinDialog = screen.getByRole("dialog", { name: /Join MetFix Today/i });
    fireEvent.change(within(joinDialog).getByPlaceholderText("you@email.com"), {
      target: { value: "pat@example.com" },
    });
    fireEvent.click(within(joinDialog).getByRole("button", { name: /Join with Email/i }));
    fireEvent.click(within(joinDialog).getByRole("button", { name: /Continue with Google/i }));

    // Submit / join must not fire any further request — including GET.
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterLoad);
    expect(fetchMock.mock.calls.slice(callsAfterLoad)).toEqual([]);
    assertNoBrokenscience(fetchMock);

    for (const key of FORBIDDEN_STORAGE_KEYS) {
      expect(setItemSpy).not.toHaveBeenCalledWith(key, expect.anything());
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(localStorage.length).toBe(0);
    expect(window.location.pathname).toBe("/the-daily-fix/250210");
    expect(window.location.hash).toBe("#belly");
    expect(window.location.href).not.toContain("brokenscience.org");
    expect(window.location.href).not.toMatch(/accounts\.google|oauth|openid/i);
  });

  it.each([
    "/the-daily-fix/250231",
    "/the-daily-fix/20250231",
    "/the-daily-fix/2025-02-31",
    "/the-daily-fix/25/02/31",
    "/the-daily-fix/25/2/10",
    "/the-daily-fix/19990210",
  ])("invalid date %s does not fetch day or comments", async (path) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openAddressBar(path);
    render(<MountedDailyFixApp />);

    expect(await screen.findByText(/That day isn’t a Daily Fix date/i)).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(path);
  });

  it("path pillar /250210/brain rewrites to /the-daily-fix/250210#brain", async () => {
    mockDayAndCommentsFetch();
    openAddressBar("/the-daily-fix/250210/brain");
    render(<MountedDailyFixApp />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/the-daily-fix/250210");
      expect(window.location.hash).toBe("#brain");
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(window.location.pathname).toBe("/the-daily-fix/250210");
    expect(window.location.hash).toBe("#brain");
  });

  it("bare /the-daily-fix#brain keeps path and hash", async () => {
    const todayIso = bsiTodayIso();
    const fetchMock = mockDayAndCommentsFetch({ dayIso: todayIso });
    openAddressBar("/the-daily-fix#brain");
    render(<MountedDailyFixApp />);

    // #brain selects the brain pillar, so the day content heading is the reading title.
    expect(await screen.findByRole("heading", { name: "Read" })).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(window.location.pathname).toBe("/the-daily-fix");
    expect(window.location.hash).toBe("#brain");
    await act(async () => {
      await Promise.resolve();
    });
    expect(window.location.pathname).toBe("/the-daily-fix");
    expect(window.location.hash).toBe("#brain");
  });

  it.each([
    "/the-daily-fix/2025-02-10",
    "/the-daily-fix/20250210",
    "/the-daily-fix/25/02/10",
  ])("after mount, address bar for %s ends on /the-daily-fix/250210", async (path) => {
    mockDayAndCommentsFetch();
    openAddressBar(path);
    render(<MountedDailyFixApp />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/the-daily-fix/250210");
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(window.location.pathname).toBe("/the-daily-fix/250210");
    expect(window.location.hash).toBe("");
  });

  it("four-segment /25/02/10/belly stays the site NotFound route and does not fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openAddressBar("/the-daily-fix/25/02/10/belly");
    render(<MountedDailyFixApp />);

    expect(await screen.findByText(/Error 404/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/the-daily-fix/25/02/10/belly");
  });
});
