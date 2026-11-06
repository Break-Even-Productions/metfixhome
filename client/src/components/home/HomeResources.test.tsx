/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { SUBSTACK_ARCHIVE_URL } from "@/data/newsletter";
import { HomeResources } from "./HomeResources";

vi.mock("@/lib/substack", async () => {
  const actual = await vi.importActual<typeof import("@/lib/substack")>("@/lib/substack");
  return {
    ...actual,
    loadSubstackPosts: async () => [
      {
        title: "Sample Substack post",
        excerpt: "Excerpt from the archive",
        url: "https://letsstartwiththetruth.substack.com/p/sample",
        date: "2026-01-01T00:00:00.000Z",
        image: null,
      },
    ],
  };
});

vi.mock("@/lib/fetchPostsPage", () => ({
  fetchPostsPage: async () => ({
    posts: [
      {
        id: 42,
        title: "Sample BSI post",
        excerpt: "Newest from the BSI site",
        date: "2026-10-01T00:00:00.000Z",
        image: null,
        author: "BSI",
        category: { name: "Articles", slug: "articles" },
        exclusive: true,
        preview_available: true,
      },
    ],
    page: 1,
    per_page: 10,
    has_more: false,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});

describe("HomeResources CTAs", () => {
  it("shows BSI posts above the divider with library + Pro CTAs, and Substack below", async () => {
    render(
      <Router>
        <HomeResources
          title="Let’s Start with the Truth"
          resourceLibrary={
            {
              eyebrow: "Resource Library",
              subtext: "Should not render",
              fullLibraryCta: { label: "Full Library", href: "/library" },
              bottomCta: { label: "Access the Full Library", href: "/library" },
            } as never
          }
        />
      </Router>,
    );

    await waitFor(() => expect(screen.getByText("Sample BSI post")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Sample Substack post")).toBeTruthy());
    expect(screen.queryByText("Should not render")).toBeNull();
    expect(screen.getByText("Exclusive")).toBeTruthy();
    expect(screen.getByText("Preview available")).toBeTruthy();

    const bsiCard = screen.getByRole("link", { name: /Sample BSI post/i });
    expect(bsiCard.getAttribute("href")).toBe("/posts/42");

    const library = screen.getByRole("link", { name: /Explore Resource Library/i });
    expect(library.getAttribute("href")).toBe("/library");

    const pro = screen.getByRole("link", { name: /Join MetFix Pro/i });
    expect(pro.getAttribute("href")).toBe("#membership-section");

    const substackCard = screen.getByRole("link", { name: /Sample Substack post/i });
    expect(substackCard.getAttribute("href")).toBe(
      "https://letsstartwiththetruth.substack.com/p/sample",
    );
    expect(substackCard.getAttribute("target")).toBe("_blank");

    const archive = screen.getByRole("link", { name: /Read the archive/i });
    expect(archive.getAttribute("href")).toBe(SUBSTACK_ARCHIVE_URL);

    fireEvent.click(screen.getByRole("button", { name: /Sign up for the newsletter/i }));
    expect(screen.getByRole("dialog", { name: /What should we send you/i })).toBeTruthy();
  });
});
