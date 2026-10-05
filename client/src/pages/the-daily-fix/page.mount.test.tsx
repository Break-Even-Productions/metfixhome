/**
 * @vitest-environment jsdom
 *
 * Mount-level QA: Router + TheDailyFixPage / NotFound, mocked fetch, frozen BSI clock.
 * Helper-only assertions do not count toward these checks.
 */
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import NotFound from "@/pages/NotFound";
import TheDailyFixPage from "./TheDailyFixPage";
import { DAILY_FIX_BFF_URL, peekLoadedDailyFixDay, resetDailyFixDayCache } from "./data";
import { formatDayLabel } from "./model";

const FROZEN = new Date("2026-03-10T23:30:00.000Z");
const TODAY = "2026-03-11";
const MINUS1 = "2026-03-10";
const MINUS2 = "2026-03-09";

function dayPayload(date: string, overrides: Record<string, unknown> = {}) {
  return {
    date,
    belly: {
      title: `Belly ${date}`,
      macros: { fat: 10, carb: null, protein: 20 },
      body: "<p>Ingredients</p>",
      steps: "<p>Steps</p>",
      has_structured_ingredients: false,
      has_structured_steps: false,
      recipe_ingredients: [],
      recipe_steps: [],
      photo_url: "https://example.com/ignore.jpg",
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
    ...overrides,
  };
}

const restWorkout = {
  title: "Rest",
  body: null,
  excerpt: "<p>Rest day</p>",
};

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
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderAt(url: string) {
  openAddressBar(url);
  return render(
    <Router key={url}>
      <Switch>
        <Route path={"/the-daily-fix/:yy/:mm/:dd"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date/:pillar"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix"} component={TheDailyFixPage} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Router>,
  );
}

function requestDates(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => {
    const url = new URL(String(call[0]));
    expect(url.origin + url.pathname).toBe(DAILY_FIX_BFF_URL);
    expect(url.searchParams.has("key")).toBe(false);
    expect(call[1]).toEqual(expect.objectContaining({ headers: { Accept: "application/json" } }));
    return url.searchParams.get("date")!;
  });
}

beforeEach(() => {
  stubBrowserApis();
  openAddressBar("/");
  resetDailyFixDayCache();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FROZEN);
});

afterEach(() => {
  cleanup();
  resetDailyFixDayCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Daily Fix page mount — rest day / mapBody", () => {
  it("1. title + null body + excerpt loads; Workout shows excerpt; belly+brain render", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(dayPayload("2025-02-10", { body: restWorkout })), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    renderAt("/the-daily-fix/250210#body");
    expect(await screen.findByRole("heading", { name: "Rest" })).toBeTruthy();
    expect(screen.getByText("Rest day")).toBeTruthy();
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    cleanup();
    renderAt("/the-daily-fix/250210#brain");
    expect(await screen.findByRole("heading", { name: "Brain 2025-02-10" })).toBeTruthy();
  });

  it("2. both body and excerpt → uses body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify(
            dayPayload("2025-02-10", {
              body: { title: "Push", body: "<p>Real work</p>", excerpt: "<p>Excerpt</p>" },
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    renderAt("/the-daily-fix/250210#body");
    expect(await screen.findByText("Real work")).toBeTruthy();
    expect(screen.queryByText("Excerpt")).toBeNull();
  });

  it("3. fully null workout → whole day Not available; no belly/brain alone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify(
            dayPayload("2025-02-10", {
              body: { title: null, body: null, excerpt: null },
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    renderAt("/the-daily-fix/250210");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Belly 2025-02-10" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Brain 2025-02-10" })).toBeNull();
  });

  it("4. flat {body:{html}} rejected; photo_url not copied into content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            date: "2025-02-10",
            belly: { title: "x", fat: 1, carb: 2, protein: 3 },
            body: { title: "y", html: "<p>nope</p>" },
            brain: { title: "z", html: "<p>nope</p>" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    renderAt("/the-daily-fix/250210");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    expect(screen.queryByText("nope")).toBeNull();
  });
});

describe("Daily Fix page mount — bare /the-daily-fix", () => {
  it("5. bare mount: exactly 3 worker GETs once each, today first, then −1 −2; no key", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(3));
    expect(requestDates(fetchMock)).toEqual([TODAY, MINUS1, MINUS2]);
    expect(await screen.findByRole("heading", { name: formatDayLabel(TODAY) })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("6. today GET returning different date shows closer day + disclaimer; path stays bare; hash kept; calendar uses response date", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const requested = new URL(String(input)).searchParams.get("date")!;
      const date = requested === TODAY ? MINUS2 : requested;
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix#brain");
    expect(await screen.findByText(/Showing .* the closest scheduled Daily Fix/i)).toBeTruthy();
    expect(screen.getByText(formatDayLabel(MINUS2), { selector: ".df-heading" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: `Brain ${MINUS2}` })).toBeTruthy();
    expect(window.location.pathname).toBe("/the-daily-fix");
    expect(window.location.hash).toBe("#brain");
    const strip = screen.getByLabelText("Recent days");
    const active = within(strip).getByRole("link", { current: "date" });
    expect(active.textContent).toContain("9");
    // Note for PR #2 rebase only: comments GET must key on response date 2026-03-09, not today.
  });

  it.each([
    {
      label: "503",
      todayResponse: async () =>
        new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }),
    },
    {
      label: "404",
      todayResponse: async () => new Response("", { status: 404 }),
    },
    {
      label: "thrown fetch",
      todayResponse: async () => {
        throw new TypeError("Failed to fetch");
      },
    },
    {
      label: "unmappable body",
      todayResponse: async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
    {
      label: "fully null workout",
      todayResponse: async () =>
        new Response(
          JSON.stringify(
            dayPayload(TODAY, {
              body: { title: null, body: null, excerpt: null },
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    },
    {
      label: "200 different date that does not map",
      todayResponse: async () =>
        new Response(
          JSON.stringify(
            dayPayload(MINUS2, {
              body: { title: null, body: null, excerpt: null },
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    },
  ])(
    "7/19. bare today $label → Not available; never shows −1/−2; exactly three GETs",
    async ({ todayResponse }) => {
      resetDailyFixDayCache();
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const date = new URL(String(input)).searchParams.get("date")!;
        if (date === TODAY) return todayResponse();
        return new Response(JSON.stringify(dayPayload(date)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      cleanup();
      renderAt("/the-daily-fix");
      expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
      expect(window.location.pathname).toBe("/the-daily-fix");
      await waitFor(() => expect(fetchMock.mock.calls.length).toBe(3));
      expect(requestDates(fetchMock)).toEqual([TODAY, MINUS1, MINUS2]);
      expect(screen.queryByRole("heading", { name: `Belly ${MINUS1}` })).toBeNull();
      expect(screen.queryByRole("heading", { name: `Belly ${MINUS2}` })).toBeNull();
      expect(screen.queryByText(/invent/i)).toBeNull();
    },
  );

  it("17. bare: 200 with invalid top-level date → Not available, not cached", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      if (date === TODAY) {
        return new Response(JSON.stringify(dayPayload(TODAY, { date: "not-iso" })), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(3));
  });

  it("17. bare: 200 with no date key → Not available, not cached", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      if (date === TODAY) {
        const body = dayPayload(TODAY);
        delete (body as { date?: string }).date;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(3));
    expect(screen.queryByRole("heading", { name: `Belly ${MINUS1}` })).toBeNull();
    expect(screen.queryByRole("heading", { name: `Belly ${MINUS2}` })).toBeNull();
    expect(peekLoadedDailyFixDay(TODAY)).toBeNull();

    // Failed bare response must not be cached — dated today refetches once.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    cleanup();
    renderAt("/the-daily-fix/260311");
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(4);
    expect(requestDates(fetchMock).slice(-1)).toEqual([TODAY]);
  });

  it("warm bare remount stays at exactly three GETs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(requestDates(fetchMock)).toEqual([TODAY, MINUS1, MINUS2]);

    cleanup();
    renderAt("/the-daily-fix");
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();
    expect(screen.queryByText("Loading")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("18. bare mount stays exactly three GETs even when today returns a different date", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const requested = new URL(String(input)).searchParams.get("date")!;
      const date = requested === TODAY ? MINUS2 : requested;
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    await screen.findByText(/closest scheduled Daily Fix/i);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(3));
    expect(requestDates(fetchMock)).toEqual([TODAY, MINUS1, MINUS2]);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes(MINUS2)).length).toBe(1);
  });
});

describe("Daily Fix page mount — prefetch cache", () => {
  it("8. after bare mount, in-app to /260310 and /260309 → no new fetch, no skeleton", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();

    cleanup();
    renderAt("/the-daily-fix/260310");
    expect(await screen.findByRole("heading", { name: `Belly ${MINUS1}` })).toBeTruthy();
    expect(screen.queryByText("Loading")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    cleanup();
    renderAt("/the-daily-fix/260309");
    expect(await screen.findByRole("heading", { name: `Belly ${MINUS2}` })).toBeTruthy();
    expect(screen.queryByText("Loading")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("9. prefetch closer for −1 caches under returned date; /260309 hits; /260310 Not available without second fetch", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const requested = new URL(String(input)).searchParams.get("date")!;
      const date = requested === MINUS1 ? MINUS2 : requested;
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();

    cleanup();
    renderAt("/the-daily-fix/260309");
    expect(await screen.findByRole("heading", { name: `Belly ${MINUS2}` })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.queryByText(/closest scheduled Daily Fix/i)).toBeNull();

    cleanup();
    renderAt("/the-daily-fix/260310");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    expect(window.location.pathname).toBe("/the-daily-fix/260310");
    expect(screen.queryByRole("heading", { name: `Belly ${MINUS2}` })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("10. failed prefetch not cached; visit refetches once and succeeds; failed prefetch never changes visible day", async () => {
    let minus1Fails = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      if (date === MINUS1 && minus1Fails) {
        return new Response("", { status: 404 });
      }
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(3));
    expect(requestDates(fetchMock)).toEqual([TODAY, MINUS1, MINUS2]);
    expect(screen.getByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();

    minus1Fails = false;
    cleanup();
    renderAt("/the-daily-fix/260310");
    expect(await screen.findByRole("heading", { name: `Belly ${MINUS1}` })).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(4);
  });

  it("10. failed prefetch stay failed on visit → Not available; never changed visible day during prefetch", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      if (date === MINUS1) {
        return new Response("", { status: 404 });
      }
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix");
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(3));
    expect(requestDates(fetchMock)).toEqual([TODAY, MINUS1, MINUS2]);
    expect(screen.queryByRole("heading", { name: `Belly ${MINUS1}` })).toBeNull();
    expect(screen.getByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();

    cleanup();
    renderAt("/the-daily-fix/260310");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    expect(window.location.pathname).toBe("/the-daily-fix/260310");
    expect(screen.queryByRole("heading", { name: `Belly ${MINUS1}` })).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(4);
  });

  it("11. dated /250210 makes exactly one GET for 2025-02-10; no today-window prefetch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(dayPayload("2025-02-10")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix/250210");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(requestDates(fetchMock)).toEqual(["2025-02-10"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("12. pillar hash 0 extra fetches; invalid dates and four-segment path 0 fetches / no prefetch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(dayPayload("2025-02-10")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix/250210#brain");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      window.location.hash = "#body";
    });
    await act(async () => {
      window.location.hash = "#belly";
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (const path of [
      "/the-daily-fix/250231",
      "/the-daily-fix/20250231",
      "/the-daily-fix/2025-02-31",
      "/the-daily-fix/25/02/31",
      "/the-daily-fix/25/2/10",
      "/the-daily-fix/19990210",
    ]) {
      cleanup();
      resetDailyFixDayCache();
      fetchMock.mockClear();
      renderAt(path);
      expect(await screen.findByRole("heading", { name: /That day isn’t a Daily Fix date/i })).toBeTruthy();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(document.querySelector(".df-skeleton")).toBeNull();
    }

    cleanup();
    fetchMock.mockClear();
    renderAt("/the-daily-fix/25/02/10/belly");
    expect(await screen.findByText(/Error 404/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Daily Fix page mount — skeleton, copy, dated mismatch", () => {
  it("13. pending → skeleton (aria-busy/status); no day content; no Not available; gone when settled", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix/250210");
    const panel = await screen.findByRole("tabpanel");
    expect(panel.getAttribute("aria-busy")).toBe("true");
    expect(within(panel).getByText("Loading")).toBeTruthy();
    expect(panel.querySelector(".df-skeleton")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Not available" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Belly 2025-02-10" })).toBeNull();

    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify(dayPayload("2025-02-10")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(screen.getByRole("tabpanel").getAttribute("aria-busy")).toBeNull();
    expect(screen.queryByText("Loading")).toBeNull();
  });

  it("14. invalid → invalid copy, not skeleton", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderAt("/the-daily-fix/250231");
    expect(await screen.findByRole("heading", { name: /That day isn’t a Daily Fix date/i })).toBeTruthy();
    expect(screen.queryByText("Loading")).toBeNull();
    expect(document.querySelector(".df-skeleton")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("15. unavailable heading is Not available; old copy gone; invalid copy unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    cleanup();
    renderAt("/the-daily-fix/250210");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    expect(screen.queryByText(/This day could not be loaded/i)).toBeNull();
    expect(screen.queryByText(/invent a recipe/i)).toBeNull();

    cleanup();
    resetDailyFixDayCache();
    renderAt("/the-daily-fix/250231");
    expect(await screen.findByRole("heading", { name: /That day isn’t a Daily Fix date/i })).toBeTruthy();
    expect(screen.getByText(/Use/, { exact: false })).toBeTruthy();
  });

  it("16. dated URL: missing/invalid/≠ URL date → Not available; no disclaimer; path kept; no second GET", async () => {
    for (const badDate of [undefined, "not-iso", "2025-02-07"] as const) {
      cleanup();
      resetDailyFixDayCache();
      const fetchMock = vi.fn(async () => {
        const payload =
          badDate === undefined
            ? (() => {
                const body = dayPayload("2025-02-10");
                delete (body as { date?: string }).date;
                return body;
              })()
            : dayPayload(badDate === "not-iso" ? "2025-02-10" : badDate, {
                date: badDate === "not-iso" ? "not-iso" : badDate,
              });
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      cleanup();
      renderAt("/the-daily-fix/250210");
      expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
      expect(screen.queryByText(/closest scheduled Daily Fix/i)).toBeNull();
      expect(window.location.pathname).toBe("/the-daily-fix/250210");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(requestDates(fetchMock)).toEqual(["2025-02-10"]);
    }
  });

  it("keeps rewrite shapes on /the-daily-fix/250210 after mount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(dayPayload("2025-02-10")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    for (const path of ["/the-daily-fix/2025-02-10", "/the-daily-fix/20250210", "/the-daily-fix/25/02/10"]) {
      cleanup();
    resetDailyFixDayCache();
    renderAt(path);
      await waitFor(() => {
        expect(window.location.pathname).toBe("/the-daily-fix/250210");
      });
      expect(window.location.hash).toBe("");
    }
  });

  it("dated closer-day response never renders the bare-path disclaimer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(dayPayload("2025-02-07")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    cleanup();
    renderAt("/the-daily-fix/250210");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    expect(screen.queryByText(/closest scheduled Daily Fix/i)).toBeNull();
  });
});
