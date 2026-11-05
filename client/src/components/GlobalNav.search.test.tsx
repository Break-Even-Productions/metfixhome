/**
 * @vitest-environment jsdom
 * Search opens a modal; submit navigates to SEARCH_HREF?query=.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_HREF } from "@/const";

const setLocation = vi.fn();

vi.mock("@/hooks/useSiteContent", () => ({
  useSiteSettings: () => ({
    settings: { copyrightText: "© MetFix", navLinks: [] },
    loading: false,
  }),
}));

vi.mock("@/contexts/JoinFlowContext", () => ({
  useJoinFlowOptional: () => null,
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/", setLocation] as const,
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  };
});

import GlobalNav from "./GlobalNav";

beforeEach(() => {
  setLocation.mockClear();
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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GlobalNav search modal", () => {
  it("Search is an icon button that opens a dialog; submit goes to SEARCH_HREF", () => {
    render(<GlobalNav />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const buttons = screen.getAllByRole("button", { name: "Search" });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(buttons[0]!);
    expect(screen.getByRole("dialog")).toBeTruthy();
    const input = screen.getByRole("searchbox", { name: /search classes/i });
    fireEvent.change(input, { target: { value: "ketosis" } });
    fireEvent.submit(input.closest("form")!);
    expect(setLocation).toHaveBeenCalledWith(`${SEARCH_HREF}?query=ketosis`);
    expect(SEARCH_HREF).toBe("/library/search");
  });
});
