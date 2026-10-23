/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthorAside } from "./AuthorAside";

afterEach(() => {
  cleanup();
});

describe("AuthorAside", () => {
  it("renders About the Author rail with initials from a two-word name", () => {
    const { container } = render(<AuthorAside name="Emily Kaplan" />);
    expect(screen.getByLabelText("About the author")).toBeTruthy();
    expect(screen.getByText("About the Author")).toBeTruthy();
    expect(screen.getByText("Emily Kaplan")).toBeTruthy();
    expect(container.querySelector(".post-author-avatar")?.textContent).toBe("EK");
  });

  it("uses a single initial for one-word names", () => {
    const { container } = render(<AuthorAside name="Plato" />);
    expect(container.querySelector(".post-author-avatar")?.textContent).toBe("P");
  });

  it("returns null for blank names", () => {
    const { container } = render(<AuthorAside name="   " />);
    expect(container.querySelector(".post-reader-aside")).toBeNull();
  });
});
