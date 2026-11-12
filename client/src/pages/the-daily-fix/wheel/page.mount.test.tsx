/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router, Switch } from "wouter";
import TheDailyFixWheelPage from "./TheDailyFixWheelPage";
import TheDailyFixPage from "../TheDailyFixPage";

vi.mock("../liquidGlass", () => ({
  initLiquidGlass: vi.fn(async () => ({ destroy: vi.fn() })),
}));

vi.mock("../authHost", () => ({
  isAuthUiHost: () => true,
}));

const FROZEN = new Date("2026-03-10T23:30:00.000Z");

function dayPayload(date: string) {
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
    body: { title: `Body ${date}`, body: `<p>Workout ${date}</p>`, excerpt: null },
    brain: { title: `Brain ${date}`, body: `<p>Read ${date}</p>`, excerpt: null },
  };
}

function wheelPayload() {
  return {
    recipes: [
      {
        id: 11,
        last_used: "261004",
        title: "Seared Salmon",
        excerpt: "Crisp",
        protein: { id: 4, name: "seafood" },
        macros: { fat: 18, carb: 6, protein: 35 },
        assets: {
          low: "https://cdn.example.com/salmon-low.jpg",
          high: "https://cdn.example.com/salmon.jpg",
          alt: "Salmon",
        },
      },
      {
        id: 12,
        last_used: "261003",
        title: "Chicken Thighs",
        excerpt: "Crispy",
        protein: { id: 2, name: "poultry" },
        macros: { fat: 22, carb: 4, protein: 40 },
        assets: {
          low: "https://cdn.example.com/chicken-low.jpg",
          high: "https://cdn.example.com/chicken.jpg",
          alt: "Chicken",
        },
      },
    ],
    meta: { count: 2, limit: 12, excluded: null, protein_ids: [], wheel_size: "dfix-wheel" },
  };
}

function stubBrowserApis() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes("prefers-reduced-motion"),
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
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
}

function openAddressBar(url: string) {
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function renderShell(url: string) {
  openAddressBar(url);
  return render(
    <Router>
      <Switch>
        <Route path={"/the-daily-fix/wheel"} component={TheDailyFixWheelPage} />
        <Route path={"/the-daily-fix/:date"} component={TheDailyFixPage} />
        <Route path={"/the-daily-fix"} component={TheDailyFixPage} />
      </Switch>
    </Router>,
  );
}

beforeEach(() => {
  stubBrowserApis();
  openAddressBar("/");
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FROZEN);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Daily Fix wheel page", () => {
  it("routes /the-daily-fix/wheel and loads recipes from the BFF", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/daily-fix/wheel/recipes")) {
        return new Response(JSON.stringify(wheelPayload()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderShell("/the-daily-fix/wheel");
    expect(await screen.findByRole("heading", { name: /Spin the/i })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Spin the wheel" })).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/daily-fix/wheel/recipes"))).toBe(
        true,
      );
    });
    expect(await screen.findByLabelText("Select Seared Salmon")).toBeTruthy();
  });

  it("spins and reveals a recipe with a Daily Fix link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        if (String(input).includes("/api/daily-fix/wheel/recipes")) {
          return new Response(JSON.stringify(wheelPayload()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 404 });
      }),
    );

    renderShell("/the-daily-fix/wheel");
    await screen.findByLabelText("Select Seared Salmon");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Spin the wheel" }));
    });
    expect(await screen.findByRole("heading", { name: "Seared Salmon" })).toBeTruthy();
    const view = screen.getByRole("link", { name: "View recipe" });
    expect(view.getAttribute("href")).toBe("/the-daily-fix/261004?tab=belly");
  });
});

describe("Daily Fix CTAs to the wheel", () => {
  it("exposes hero header button and Try the Wheel CTA under Subscribe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/api/daily-fix/comments") || url.includes("/api/auth/")) {
          return new Response(JSON.stringify({ comments: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/daily-fix?")) {
          return new Response(JSON.stringify(dayPayload("2026-03-11")), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/daily-fix/archive")) {
          return new Response(JSON.stringify({ days: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 404 });
      }),
    );

    renderShell("/the-daily-fix");
    const heroWheel = await screen.findByRole("link", { name: "Spin the wheel" });
    expect(heroWheel.getAttribute("href")).toBe("/the-daily-fix/wheel");
    expect(heroWheel.closest(".df-hero-actions")).toBeTruthy();

    const cta = screen.getByRole("link", { name: /Try the Wheel/i });
    expect(cta.getAttribute("href")).toBe("/the-daily-fix/wheel");
    const wheelCta = document.getElementById("daily-fix-wheel-cta");
    expect(wheelCta?.contains(cta)).toBe(true);
    const subscribe = document.getElementById("daily-fix-subscribe");
    expect(
      Boolean(
        subscribe &&
          wheelCta &&
          (subscribe.compareDocumentPosition(wheelCta) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      ),
    ).toBe(true);
  });
});
