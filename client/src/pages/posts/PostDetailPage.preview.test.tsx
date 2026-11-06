/**
 * @vitest-environment jsdom
 * First-paragraph previews fade into one CTA. Same-body preview video does not.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import PostDetailPage from "./PostDetailPage";

const access = {
  access: "preview" as const,
  has_content_access: true,
  user_has_access: false,
  has_preview: true,
  is_exclusive: true,
  show_same: 3,
  show_video_in_preview: true,
  access_group_labels: ["Logged In"],
};

function detail(showSame: number) {
  return {
    post: {
      id: 42,
      title: "Exclusive essay",
      excerpt: "Opening",
      date: "2026-01-15T00:00:00Z",
      image: null,
      author: "Author",
      category: { name: "Science", slug: "science" },
      exclusive: true,
      preview_available: true,
      content: "<p>Opening paragraph</p><p>Rest of the essay</p>",
      permalink: "https://brokenscience.org/exclusive-essay/",
      video: {
        kind: "youtube",
        embedUrl: "https://www.youtube.com/embed/ssx-qq29IYo",
        url: "https://www.youtube.com/watch?v=ssx-qq29IYo",
        videoId: "ssx-qq29IYo",
      },
      categories: [{ id: 1, name: "Science", slug: "science" }],
      content_types: [],
      topics: [],
      locked: false,
      access: { ...access, show_same: showSame },
    },
  };
}

function mount(showSame: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/posts/42")) {
        return new Response(JSON.stringify(detail(showSame)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ comments: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  window.history.replaceState({}, "", "/posts/42");
  return render(
    <Router>
      <Route path="/posts/:id">
        <PostDetailPage />
      </Route>
    </Router>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PostDetailPage preview types", () => {
  it("fades a first-paragraph preview into one CTA and still plays the preview video", async () => {
    mount(3);
    expect(await screen.findByRole("heading", { name: "Exclusive essay" })).toBeTruthy();
    expect(document.querySelector(".posts-preview-fade")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Continue with MetFix" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Get the full MetFix library" })).toBeNull();
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(screen.getByText("Opening paragraph")).toBeTruthy();
  });

  it("does not fade a same-body preview", async () => {
    mount(2);
    expect(await screen.findByRole("heading", { name: "Exclusive essay" })).toBeTruthy();
    expect(document.querySelector(".posts-preview-fade")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Continue with MetFix" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Get the full MetFix library" })).toBeTruthy();
    expect(document.querySelector("iframe")).toBeTruthy();
    expect(screen.getByText("Rest of the essay")).toBeTruthy();
  });
});
