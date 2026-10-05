/**
 * @vitest-environment jsdom
 *
 * Mount-level QA: Router + TheDailyFixPage / NotFound, mocked fetch, frozen BSI clock.
 * Helper-only assertions do not count toward these checks.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import NotFound from "@/pages/NotFound";
import TheDailyFixPage from "./TheDailyFixPage";
import { MealPhoto } from "./MealPhoto";
import { DAILY_FIX_BFF_URL, peekLoadedDailyFixDay, resetDailyFixDayCache } from "./data";
import { formatDayLabel } from "./model";

const { liquidDestroy, liquidInit } = vi.hoisted(() => {
  const liquidDestroy = vi.fn();
  const liquidInit = vi.fn(async () => ({ destroy: liquidDestroy }));
  return { liquidDestroy, liquidInit };
});

/** Keep wrapper mock for mounts; package call path covered in liquidGlass.test.ts (C6). */
vi.mock("./liquidGlass", () => ({
  initLiquidGlass: liquidInit,
}));

const FROZEN = new Date("2026-03-10T23:30:00.000Z");
const TODAY = "2026-03-11";
const MINUS1 = "2026-03-10";
const MINUS2 = "2026-03-09";
const PHOTO = "https://cdn.example.com/meal.jpg";
const YT = "https://www.youtube.com/watch?v=jHXO-qIk28A";
const YT_BE = "https://youtu.be/jHXO-qIk28A";
const YT_EMBED = "https://www.youtube.com/embed/jHXO-qIk28A";
const EMBED = "https://www.youtube.com/embed/jHXO-qIk28A?autoplay=1&rel=0&playsinline=1";

function fireImgLoad(img: HTMLImageElement) {
  Object.defineProperty(img, "complete", { configurable: true, value: true });
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: 1024 });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: 576 });
  fireEvent.load(img);
}

function dayPayload(date: string, overrides: Record<string, unknown> = {}) {
  const base = {
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
      // Default: no MealPhoto so regression tests keep plain .df-macros behavior.
      photo_url: null as string | null,
      yt_url: null as string | null,
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
  const { belly: bellyOverride, ...rest } = overrides;
  return {
    ...base,
    ...rest,
    belly: {
      ...base.belly,
      ...(bellyOverride && typeof bellyOverride === "object" ? bellyOverride : {}),
    },
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

/** Same Router instance for in-app pillar/date navigation (no remount via key=url). */
function renderShell(url: string) {
  openAddressBar(url);
  return render(
    <Router>
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
  liquidInit.mockClear();
  liquidDestroy.mockClear();
  liquidInit.mockImplementation(async () => ({ destroy: liquidDestroy }));
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

  it("4. flat {body:{html}} rejected; Worker media fields do not invent content", async () => {
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

describe("Daily Fix page mount — MealPhoto belly media", () => {
  beforeEach(() => {
    // Dynamic import + LiquidGlass.init need real timers.
    vi.useRealTimers();
    vi.setSystemTime(FROZEN);
  });

  function stubDay(belly: Record<string, unknown>, date = "2025-02-10") {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(dayPayload(date, { belly })), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function stubPayload(payload: Record<string, unknown>) {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("09-15 style: photo+play; no Per serving when macros are 0", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 0, carb: 0, protein: 0 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    const img = screen.getByRole("img", { name: "Belly 2025-02-10" }) as HTMLImageElement;
    expect(img.getAttribute("crossorigin")).toBe("anonymous");
    expect(img.getAttribute("width")).toBe("1024");
    expect(img.getAttribute("height")).toBe("576");
    expect(screen.getByRole("button", { name: "Play the short" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Watch video/i })).toBeTruthy();
    expect(screen.queryByText("Per serving")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeNull();
    fireImgLoad(img);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
  });

  it("B1: dated photo day — img src, Ingredients HTML, exactly one GET for ISO", async () => {
    const fetchMock = stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 22, carb: 3, protein: 34 },
      body: "<p>Marinate the steak</p>",
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const img = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    expect(img.getAttribute("src")).toBe(PHOTO);
    expect(screen.getByRole("heading", { name: "Ingredients", level: 4 })).toBeTruthy();
    expect(screen.getByText("Marinate the steak")).toBeTruthy();
    expect(requestDates(fetchMock)).toEqual(["2025-02-10"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("B1b: photo + all-null macros → no Per serving and no .df-macros", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: null,
      macros: { fat: null, carb: null, protein: null },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("img", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(screen.queryByText("Per serving")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeNull();
  });

  it("B2: all three macros > 0 appear Protein → Fat → Carbs inside .df-meal-macros", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: null,
      macros: { fat: 22, carb: 3, protein: 34 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByText("Per serving")).toBeTruthy();
    const glass = document.querySelector(".df-meal-macros") as HTMLElement;
    const labels = within(glass)
      .getAllByRole("term")
      .map((node) => node.textContent);
    expect(labels).toEqual(["Protein", "Fat", "Carbs"]);
    expect(within(glass).getByText("34g")).toBeTruthy();
    expect(within(glass).getByText("22g")).toBeTruthy();
    expect(within(glass).getByText("3g")).toBeTruthy();
  });

  it("B2b: photo + {0,5,0} → only Carbs 5g; no Fat/Protein; no 0g", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: null,
      macros: { fat: 0, carb: 5, protein: 0 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const glass = (await screen.findByText("Per serving")).closest(".df-meal-macros") as HTMLElement;
    expect(within(glass).getByText("Carbs")).toBeTruthy();
    expect(within(glass).getByText("5g")).toBeTruthy();
    expect(within(glass).queryByText("Fat")).toBeNull();
    expect(within(glass).queryByText("Protein")).toBeNull();
    expect(within(glass).queryByText("0g")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeNull();
  });

  it("B3: photo_url omitted → no MealPhoto/play/Watch/Per serving/iframe", async () => {
    const payload = dayPayload("2025-02-10", {
      belly: { yt_url: YT, macros: { fat: 10, carb: null, protein: 20 } },
    });
    delete (payload.belly as { photo_url?: string | null }).photo_url;
    stubPayload(payload);
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(document.querySelector(".df-meal-photo")).toBeNull();
    expect(screen.queryByText("Per serving")).toBeNull();
    expect(screen.queryByRole("button", { name: "Play the short" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Watch video/i })).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeTruthy();
  });

  it('B3: photo_url "" → no MealPhoto/play/Watch/Per serving/iframe', async () => {
    stubDay({
      photo_url: "",
      yt_url: YT,
      macros: { fat: 10, carb: null, protein: 20 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(document.querySelector(".df-meal-photo")).toBeNull();
    expect(screen.queryByText("Per serving")).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeTruthy();
  });

  it("B3c: no photo + all-0 keeps plain 0g df-macros; all-null omits df-macros; neither shows Per serving", async () => {
    stubDay({
      photo_url: null,
      yt_url: null,
      macros: { fat: 0, carb: 0, protein: 0 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    const plain = document.querySelector(".df-macros") as HTMLElement;
    expect(plain).toBeTruthy();
    expect(within(plain).getAllByText("0g").length).toBe(3);
    expect(screen.queryByText("Per serving")).toBeNull();

    cleanup();
    resetDailyFixDayCache();
    stubDay({
      photo_url: null,
      yt_url: null,
      macros: { fat: null, carb: null, protein: null },
    });
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(document.querySelector(".df-macros")).toBeNull();
    expect(screen.queryByText("Per serving")).toBeNull();
  });

  it("B4: youtu.be and embed yt_url both yield exact autoplay embed src; never raw URL", async () => {
    for (const yt of [YT_BE, YT_EMBED]) {
      cleanup();
      resetDailyFixDayCache();
      liquidInit.mockClear();
      liquidDestroy.mockClear();
      stubDay({
        photo_url: PHOTO,
        yt_url: yt,
        macros: { fat: 1, carb: 1, protein: 1 },
      });
      renderAt("/the-daily-fix/250210#belly");
      await screen.findByRole("img", { name: "Belly 2025-02-10" });
      fireEvent.click(screen.getByRole("button", { name: /Watch video/i }));
      const iframe = await screen.findByTitle("Belly 2025-02-10 short");
      expect(iframe.getAttribute("src")).toBe(EMBED);
      expect(iframe.getAttribute("src")).not.toBe(yt);
    }
  });

  it("B5a: photo + yt null → img only, no play, no Watch video", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: null,
      macros: { fat: 5, carb: null, protein: 10 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("img", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play the short" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Watch video/i })).toBeNull();
  });

  it("B5b: photo + unparseable yt → click img does not mount iframe", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: "https://www.youtube.com/watch?v=nope",
      macros: { fat: 5, carb: null, protein: 10 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const img = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    fireEvent.click(img);
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByRole("button", { name: "Play the short" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Watch video/i })).toBeNull();
  });

  it("B6: default dayPayload (no photo, fat/protein set) → .df-macros present, Per serving null", async () => {
    stubDay({});
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(document.querySelector(".df-meal-photo")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeTruthy();
    expect(screen.getByText("10g")).toBeTruthy();
    expect(screen.getByText("20g")).toBeTruthy();
    expect(screen.queryByText("Per serving")).toBeNull();
  });

  it("C4 CORS: img error retries without crossOrigin; second error keeps same plain img; no glass / Per serving / df-macros", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 22, carb: 3, protein: 34 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const img = (await screen.findByRole("img", { name: "Belly 2025-02-10" })) as HTMLImageElement;
    expect(img.getAttribute("crossorigin")).toBe("anonymous");
    fireEvent.error(img);
    await waitFor(() => {
      const retried = screen.getByRole("img", { name: "Belly 2025-02-10" });
      expect(retried.getAttribute("crossorigin")).toBeNull();
    });
    const plain = screen.getByRole("img", { name: "Belly 2025-02-10" }) as HTMLImageElement;
    expect(plain.getAttribute("src")).toBe(PHOTO);
    expect(plain.getAttribute("crossorigin")).toBeNull();
    fireEvent.error(plain);
    const afterSecond = screen.getByRole("img", { name: "Belly 2025-02-10" });
    expect(afterSecond).toBe(plain);
    expect(afterSecond.getAttribute("crossorigin")).toBeNull();
    fireImgLoad(plain);
    await act(async () => {
      await Promise.resolve();
    });
    expect(liquidInit).not.toHaveBeenCalled();
    expect(screen.queryByText("Per serving")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeNull();
  });

  it("C5: photo + macros > 0 + no yt → glass macros, init once, no play", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: null,
      macros: { fat: 22, carb: 3, protein: 34 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const img = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    expect(screen.getByText("Per serving")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play the short" })).toBeNull();
    fireImgLoad(img as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
  });

  it("C5: photo + yt + macros > 0 → init exactly once", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 22, carb: 3, protein: 34 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const img = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    fireImgLoad(img as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Play the short" })).toBeTruthy();
    expect(liquidInit).toHaveBeenCalledTimes(1);
  });

  it("0/0/0 with video → glassElements length 1 (play only)", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 0, carb: 0, protein: 0 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const img = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    expect(screen.queryByText("Per serving")).toBeNull();
    fireImgLoad(img as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
    const args = liquidInit.mock.calls[0]![0] as { glassElements: HTMLElement[] };
    expect(args.glassElements).toHaveLength(1);
    expect(args.glassElements[0]!.classList.contains("df-meal-play")).toBe(true);
  });

  it("init rejects → glassFailed: no unhandled rejection; no Per serving; no plain df-macros", async () => {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    liquidInit.mockImplementationOnce(async () => {
      throw new Error("WebGL unavailable");
    });
    stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 22, carb: 3, protein: 34 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const img = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    fireImgLoad(img as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("Per serving")).toBeNull());
    expect(document.querySelector(".df-macros")).toBeNull();
    expect(screen.getByRole("button", { name: "Play the short" })).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    process.off("unhandledRejection", onUnhandled);
    expect(rejections).toEqual([]);
  });

  it("C6: MealPhoto parent re-render (pillar switch without remount) → init stays exactly 1", async () => {
    const onPlay = vi.fn();
    const onClose = vi.fn();
    const props = {
      dayKey: "2025-02-10",
      title: "Steak",
      photoUrl: PHOTO,
      videoId: "jHXO-qIk28A" as string | null,
      macros: { fat: 10, carb: 2, protein: 20 },
      playing: false,
      onPlay,
      onClose,
    };
    const view = render(<MealPhoto {...props} />);
    fireImgLoad(screen.getByRole("img", { name: "Steak" }) as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
    view.rerender(<MealPhoto {...props} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(liquidInit).toHaveBeenCalledTimes(1);
    expect(liquidDestroy).toHaveBeenCalledTimes(0);
  });

  it("C6: in-app navigate two cached days → init exactly 2, destroy exactly 1", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      return new Response(
        JSON.stringify(
          dayPayload(date, {
            belly: {
              photo_url: PHOTO,
              yt_url: YT,
              macros: { fat: 10, carb: 2, protein: 20 },
            },
          }),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderShell("/the-daily-fix/250210#belly");
    const imgA = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    fireImgLoad(imgA as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("link", { name: /Next/i }));
    const imgB = await screen.findByRole("img", { name: "Belly 2025-02-11" });
    await waitFor(() => expect(liquidDestroy).toHaveBeenCalledTimes(1));
    fireImgLoad(imgB as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(liquidDestroy).toHaveBeenCalledTimes(1);
    expect(liquidInit).toHaveBeenCalledTimes(2);
  });

  it("stale-playing / date key: play on 250210 then Next → 250211 has no iframe, has play", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      return new Response(
        JSON.stringify(
          dayPayload(date, {
            belly: {
              photo_url: PHOTO,
              yt_url: YT,
              macros: { fat: 10, carb: 2, protein: 20 },
            },
          }),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderShell("/the-daily-fix/250210#belly");
    await screen.findByRole("img", { name: "Belly 2025-02-10" });
    fireEvent.click(screen.getByRole("button", { name: "Play the short" }));
    expect(await screen.findByTitle("Belly 2025-02-10 short")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: /Next/i }));
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-11" })).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByTitle("Belly 2025-02-11 short")).toBeNull();
    expect(screen.getByRole("button", { name: "Play the short" })).toBeTruthy();
  });

  it("C6: unmount → destroy exactly 1", async () => {
    const view = render(
      <MealPhoto
        dayKey="2025-02-10"
        title="Steak"
        photoUrl={PHOTO}
        videoId="jHXO-qIk28A"
        macros={{ fat: 10, carb: 2, protein: 20 }}
        playing={false}
        onPlay={() => {}}
        onClose={() => {}}
      />,
    );
    fireImgLoad(screen.getByRole("img", { name: "Steak" }) as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => {});
    expect(liquidDestroy).toHaveBeenCalledTimes(1);
  });

  it("C6: play-start → destroy exactly 1; no iframe before click", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 12, carb: 3, protein: 30 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    const img = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    fireImgLoad(img as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play the short" }));
    const iframe = await screen.findByTitle("Belly 2025-02-10 short");
    expect(iframe.getAttribute("src")).toBe(EMBED);
    await waitFor(() => expect(liquidDestroy).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(liquidDestroy).toHaveBeenCalledTimes(1);
  });

  it("C6: bare mount with photo → init exactly 1 (not once per prefetched day)", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input)).searchParams.get("date")!;
      return new Response(
        JSON.stringify(
          dayPayload(date, {
            belly: {
              photo_url: PHOTO,
              yt_url: YT,
              macros: { fat: 10, carb: 2, protein: 20 },
            },
          }),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    cleanup();
    renderShell("/the-daily-fix");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(requestDates(fetchMock)).toEqual([TODAY, MINUS1, MINUS2]);
    const img = await screen.findByRole("img", { name: `Belly ${TODAY}` });
    fireImgLoad(img as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(liquidInit).toHaveBeenCalledTimes(1);
  });

  it("C6: same-pillar hash re-render on belly → init exactly 1, destroy 0", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 10, carb: 2, protein: 20 },
    });
    cleanup();
    renderShell("/the-daily-fix/250210#belly");
    const img = await screen.findByRole("img", { name: "Belly 2025-02-10" });
    fireImgLoad(img as HTMLImageElement);
    await waitFor(() => expect(liquidInit).toHaveBeenCalledTimes(1));
    // Re-click Belly tab (same pillar hash) — MealPhoto stays mounted.
    fireEvent.click(screen.getByRole("tab", { name: /Belly/i }));
    await act(async () => {});
    expect(liquidInit).toHaveBeenCalledTimes(1);
    expect(liquidDestroy).toHaveBeenCalledTimes(0);
    expect(screen.getByRole("img", { name: "Belly 2025-02-10" })).toBeTruthy();
  });

  it('bare 11-char yt_url "not-a-video" → no play button', async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: "not-a-video",
      macros: { fat: 10, carb: 2, protein: 20 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("img", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play the short" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Watch video/i })).toBeNull();
  });
  it("non-zero glass macros with photo; partial zeros omit 0 rows", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: YT,
      macros: { fat: 39, carb: 0, protein: 42 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByText("Per serving")).toBeTruthy();
    const glass = document.querySelector(".df-meal-macros")!;
    expect(within(glass as HTMLElement).getByText("Protein")).toBeTruthy();
    expect(within(glass as HTMLElement).getByText("42g")).toBeTruthy();
    expect(within(glass as HTMLElement).getByText("Fat")).toBeTruthy();
    expect(within(glass as HTMLElement).getByText("39g")).toBeTruthy();
    expect(within(glass as HTMLElement).queryByText("Carbs")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeNull();
  });

  it("no photo → no MealPhoto/play/Watch; keep plain df-macros when macros non-zero", async () => {
    stubDay({
      photo_url: null,
      yt_url: YT,
      macros: { fat: 10, carb: null, protein: 20 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(document.querySelector(".df-meal-photo")).toBeNull();
    expect(screen.queryByRole("button", { name: "Play the short" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Watch video/i })).toBeNull();
    expect(document.querySelector(".df-macros")).toBeTruthy();
    expect(screen.getByText("10g")).toBeTruthy();
    expect(screen.getByText("20g")).toBeTruthy();
    expect(liquidInit).not.toHaveBeenCalled();
  });

  it("photo+all-0 → no glass card and no plain df-macros (B2c)", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: null,
      macros: { fat: 0, carb: 0, protein: 0 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("img", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(screen.queryByText("Per serving")).toBeNull();
    expect(document.querySelector(".df-macros")).toBeNull();
    expect(screen.queryByRole("button", { name: "Play the short" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Watch video/i })).toBeNull();
  });

  it("Watch video shares the play handler; no iframe before click", async () => {
    stubDay({
      photo_url: PHOTO,
      yt_url: YT_BE,
      macros: { fat: 1, carb: 1, protein: 1 },
    });
    cleanup();
    renderAt("/the-daily-fix/250210#belly");
    await screen.findByRole("img", { name: "Belly 2025-02-10" });
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Watch video/i }));
    const iframe = await screen.findByTitle("Belly 2025-02-10 short");
    expect(iframe.getAttribute("src")).toBe(EMBED);
  });
});
