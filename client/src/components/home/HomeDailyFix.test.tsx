/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { HomeDailyFix } from "./HomeDailyFix";

vi.mock("@/pages/the-daily-fix/liquidGlass", () => ({
  initLiquidGlass: async () => ({ destroy: vi.fn(), markChanged: vi.fn() }),
}));

vi.mock("@/pages/the-daily-fix/data", async () => {
  const actual = await vi.importActual<typeof import("@/pages/the-daily-fix/data")>(
    "@/pages/the-daily-fix/data",
  );
  return {
    ...actual,
    loadDailyFixDay: async () => ({
      status: "loaded" as const,
      day: {
        date: "2026-11-06",
        belly: {
          title: "Seared Salmon Bowl",
          excerpt: null,
          body: null,
          steps: null,
          photo_url: "https://cdn.example.com/meal.jpg",
          yt_id: null,
          fat: 12,
          carb: 8,
          protein: 34,
          protein_name: "Salmon",
          has_structured_ingredients: false,
          has_structured_steps: false,
          recipe_ingredients: [],
          recipe_steps: [],
          hasContent: true,
        },
        body: {
          title: "20-Min AMRAP",
          excerpt: null,
          html: "",
          photo_url: null,
          legacy: false,
          hasContent: true,
          scale: null,
        },
        brain: {
          title: "Insulin Resistance 101",
          excerpt: null,
          html: "",
          photo_url: null,
          button_text: "Read",
          hasContent: true,
        },
        compare_to: null,
      },
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IO);
});

describe("HomeDailyFix", () => {
  it("renders condensed Daily Fix with live pillar titles and CTAs", async () => {
    render(
      <Router>
        <HomeDailyFix />
      </Router>,
    );

    expect(screen.getByText("The Daily Fix")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /The Daily Fix — Eat\. Move\. Think\./i })).toBeTruthy();

    const cta = screen.getByRole("link", { name: /Get today's fix/i });
    expect(cta.getAttribute("href")).toBe("/the-daily-fix");

    await waitFor(() => expect(screen.getByText("Seared Salmon Bowl")).toBeTruthy());
    expect(screen.getByText("20-Min AMRAP")).toBeTruthy();
    expect(screen.getByText("Insulin Resistance 101")).toBeTruthy();

    const belly = screen.getByRole("link", { name: /Belly/i });
    expect(belly.getAttribute("href")).toMatch(/\/the-daily-fix/);
  });
});
