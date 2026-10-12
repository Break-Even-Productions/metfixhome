/**
 * @vitest-environment jsdom
 *
 * Spec C tests: legacy hash→tab, df-initial seeding, API error statuses.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import TheDailyFixPage from "./TheDailyFixPage";
import {
  DAILY_FIX_BFF_URL,
  resetDailyFixDayCache,
  seedFromDfInitial,
} from "./data";

const FROZEN = new Date("2026-03-10T23:30:00.000Z");
const TODAY = "2026-03-11";

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
      photo_url: null,
      yt_url: null,
    },
    body: {
      title: date === "2026-10-05" ? "Rest" : `Body ${date}`,
      body: date === "2026-10-05" ? null : `<p>Workout ${date}</p>`,
      excerpt: date === "2026-10-05" ? "<p>Rest day</p>" : null,
    },
    brain: {
      title: `Brain ${date}`,
      body: `<p>Read ${date}</p>`,
      excerpt: null,
    },
    ...overrides,
  };
}

function renderAt(url: string) {
  window.history.pushState(null, "", url);
  return render(
    <Router key={url}>
      <Switch>
        <Route path={"/the-daily-fix/:date/:pillar"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix"} component={TheDailyFixPage} />
      </Switch>
    </Router>,
  );
}

beforeEach(() => {
  resetDailyFixDayCache();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FROZEN);
  window.scrollTo = vi.fn() as typeof window.scrollTo;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  resetDailyFixDayCache();
  document.getElementById("df-initial")?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("C2 legacy hash", () => {
  it("C2: #brain shows Brain on first commit, rewrites to ?tab=brain, 1 GET", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(dayPayload("2025-02-10")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState(null, "", "/the-daily-fix/250210#brain");
    const histLen = window.history.length;
    render(
      <Router key="c2">
        <Switch>
          <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
        </Switch>
      </Router>,
    );
    expect(await screen.findByRole("heading", { name: "Brain 2025-02-10" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Belly 2025-02-10" })).toBeNull();
    expect(window.location.search).toBe("?tab=brain");
    expect(window.location.hash).toBe("");
    expect(window.history.length).toBe(histLen);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("C3: #belly and bad tab fall back to Belly", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(dayPayload("2025-02-10")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/the-daily-fix/250210#belly");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");

    cleanup();
    resetDailyFixDayCache();
    renderAt("/the-daily-fix/250210?tab=xyz");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
  });
});

describe("C5/C6 df-initial", () => {
  it("C5: dated df-initial → 0 /api for shown day", async () => {
    const el = document.createElement("script");
    el.id = "df-initial";
    el.type = "application/json";
    el.textContent = JSON.stringify(dayPayload("2025-02-10"));
    document.body.appendChild(el);

    const getElementById = document.getElementById.bind(document);
    const spy = vi.spyOn(document, "getElementById").mockImplementation((id) => {
      return getElementById(id);
    });

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(dayPayload(TODAY)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/the-daily-fix/250210");
    expect(await screen.findByRole("heading", { name: "Belly 2025-02-10" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(spy).toHaveBeenCalledWith("df-initial");
    // Only one read of the tag across seed
    expect(spy.mock.calls.filter((c) => c[0] === "df-initial").length).toBe(1);
  });

  it("C6: bare df-initial → 0 today calls + 2 prefetch", async () => {
    const el = document.createElement("script");
    el.id = "df-initial";
    el.type = "application/json";
    el.textContent = JSON.stringify(dayPayload(TODAY));
    document.body.appendChild(el);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const date = new URL(String(input), "https://metfix.org").searchParams.get("date")!;
      return new Response(JSON.stringify(dayPayload(date)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/the-daily-fix");
    expect(await screen.findByRole("heading", { name: `Belly ${TODAY}` })).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const dates = fetchMock.mock.calls.map(
      (c) => new URL(String(c[0]), "https://metfix.org").searchParams.get("date"),
    );
    expect(dates).toEqual(["2026-03-10", "2026-03-09"]);
    expect(dates).not.toContain(TODAY);
  });
});

describe("C8/C9 API statuses", () => {
  for (const status of [400, 404, 405, 503] as const) {
    it(`C8: /api ${status} → Not available`, async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status })),
      );
      renderAt("/the-daily-fix/250210");
      expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
    });
  }

  it("C9: unmappable 200 → Not available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ date: "nope" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    renderAt("/the-daily-fix/250210");
    expect(await screen.findByRole("heading", { name: "Not available" })).toBeTruthy();
  });
});

describe("C10 rest day tab=body", () => {
  it("shows Rest day with hasContent false state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(dayPayload("2026-10-05")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    renderAt("/the-daily-fix/261005?tab=body");
    expect(await screen.findByRole("heading", { name: "Rest" })).toBeTruthy();
    expect(screen.getByText("Rest day")).toBeTruthy();
  });
});

describe("seedFromDfInitial helper", () => {
  it("maps raw JSON through shared mapper", () => {
    const el = document.createElement("script");
    el.id = "df-initial";
    el.type = "application/json";
    el.textContent = JSON.stringify(dayPayload("2025-02-10"));
    document.body.appendChild(el);
    const day = seedFromDfInitial("2025-02-10", false);
    expect(day?.belly.title).toBe("Belly 2025-02-10");
    expect(day?.body.hasContent).toBe(true);
  });
});

void DAILY_FIX_BFF_URL;
