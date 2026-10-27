/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import LibraryTaxonomyPage from "./LibraryTaxonomyPage";

const filtersBody = {
  topics: [
    {
      id: 10,
      name: "Metabolic Health",
      slug: "metabolic-health",
      description: "Line one.\n\nLine two.",
      image: null,
    },
  ],
  categories: [],
  content_type_terms: [{ id: 1, name: "Videos", slug: "videos", description: null, image: null }],
};

const searchBody = {
  resources: [
    {
      id: 5,
      type: "post",
      title: "Sample",
      excerpt: "",
      date: "2026-01-01T00:00:00Z",
      image: null,
      permalink: null,
      author: null,
      categories: [],
      topics: [],
      content_types: [],
      access: {
        access: "full",
        has_content_access: false,
        user_has_access: true,
        has_preview: false,
        is_exclusive: false,
        show_same: 0,
        show_video_in_preview: false,
        access_group_labels: [],
      },
    },
  ],
  meta: { total: 1, count: 1, limit: 24, offset: 0, has_more: false },
};

function mountTopic() {
  window.history.replaceState({}, "", "/topic/metabolic-health");
  return render(
    <Router>
      <Route path="/topic/:slug">
        <LibraryTaxonomyPage taxonomyKind="topic" />
      </Route>
    </Router>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

describe("LibraryTaxonomyPage mount (TC12)", () => {
  it("calls filters once and search once on initial mount", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/library/filters")) {
        return new Response(JSON.stringify(filtersBody), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/library/search")) {
        return new Response(JSON.stringify(searchBody), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);

    mountTopic();
    expect(await screen.findByRole("heading", { name: "Metabolic Health" })).toBeTruthy();

    await waitFor(() => {
      const filterCalls = fetchImpl.mock.calls.filter((c) =>
        String(c[0]).includes("/api/library/filters"),
      );
      const searchCalls = fetchImpl.mock.calls.filter((c) =>
        String(c[0]).includes("/api/library/search"),
      );
      expect(filterCalls.length).toBeLessThanOrEqual(1);
      expect(searchCalls).toHaveLength(1);
    });
  });
});
