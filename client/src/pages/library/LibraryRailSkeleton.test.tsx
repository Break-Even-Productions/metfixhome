/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LibraryRailSkeleton } from "./LibraryRailSkeleton";

afterEach(() => {
  cleanup();
});

describe("LibraryRailSkeleton", () => {
  it("announces the section load and sketches a rail of cards", () => {
    render(<LibraryRailSkeleton />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.textContent).toContain("Loading resources");
    expect(status.querySelectorAll(".library-card-skeleton")).toHaveLength(6);
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("can sketch a shorter follow-on page", () => {
    render(<LibraryRailSkeleton count={3} label="Loading more resources" />);
    expect(document.querySelectorAll(".library-card-skeleton")).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toContain("Loading more resources");
  });
});
