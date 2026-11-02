/**
 * @vitest-environment jsdom
 * T-E-NAV-9 (gates): LR-4 search link — no overlay (rev1.0.10 §18).
 * T-E-46 PARKED.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_HREF } from "@/const";

vi.mock("@/hooks/useSanityContent", () => ({
  useSiteSettings: () => ({
    settings: { copyrightText: "© MetFix", navLinks: [] },
    loading: false,
  }),
}));

vi.mock("@/contexts/JoinFlowContext", () => ({
  useJoinFlowOptional: () => null,
}));

import GlobalNav from "./GlobalNav";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("T-E-NAV-9 LR-4 search link", () => {
  it("nav Search is an <a> named Search pointing at SEARCH_HREF; no dialog", () => {
    render(<GlobalNav />);
    const links = screen.getAllByRole("link", { name: "Search" });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]?.getAttribute("href")).toBe(SEARCH_HREF);
    expect(SEARCH_HREF).toBe("/library");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });
});
