/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PostReaderSkeleton } from "./PostReaderSkeleton";

afterEach(() => {
  cleanup();
});

describe("PostReaderSkeleton", () => {
  it("announces a loading article and sketches the reader without comments", () => {
    render(<PostReaderSkeleton />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.textContent).toContain("Loading article");
    expect(document.querySelector(".post-skel-media")).toBeTruthy();
    expect(document.querySelector(".post-reader-aside")).toBeTruthy();
    expect(document.querySelector(".post-detail-discussion")).toBeNull();
    expect(document.querySelector(".keep-learning")).toBeNull();
  });
});
