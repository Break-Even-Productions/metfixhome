/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { AuthorAside } from "./AuthorAside";

afterEach(() => {
  cleanup();
});

function mount(ui: React.ReactNode) {
  return render(<Router>{ui}</Router>);
}

describe("AuthorAside", () => {
  it("renders About the Author rail with initials from a two-word name", () => {
    const { container } = mount(<AuthorAside name="Emily Kaplan" />);
    expect(screen.getByLabelText("About the author")).toBeTruthy();
    expect(screen.getByText("About the Author")).toBeTruthy();
    expect(screen.getByText("Emily Kaplan")).toBeTruthy();
    expect(screen.getByText("Broken Science Initiative contributor.")).toBeTruthy();
    expect(container.querySelector(".post-author-avatar")?.textContent).toBe("EK");
    const more = screen.getByRole("link", { name: /More from this author/i });
    expect(more.getAttribute("href")).toBe(
      `/library?query=${encodeURIComponent("Emily Kaplan")}`,
    );
  });

  it("uses a single initial for one-word names", () => {
    const { container } = mount(<AuthorAside name="Plato" />);
    expect(container.querySelector(".post-author-avatar")?.textContent).toBe("P");
  });

  it("returns null for blank names", () => {
    const { container } = mount(<AuthorAside name="   " />);
    expect(container.querySelector(".post-reader-aside")).toBeNull();
  });
});
