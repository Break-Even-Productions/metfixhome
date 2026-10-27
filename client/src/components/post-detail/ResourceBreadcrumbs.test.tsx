/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DetailReaderModel } from "@shared/library";
import { ResourceBreadcrumbs } from "./ResourceBreadcrumbs";

const model: DetailReaderModel = {
  id: 1,
  title: "T",
  date: "2026-01-01T00:00:00Z",
  author: "A",
  image: null,
  video: null,
  categories: [{ id: 2, name: "BSI", slug: "bsi" }],
  content_types: [{ id: 3, name: "Articles", slug: "articles" }],
  topics: [{ id: 4, name: "Metabolic Health", slug: "metabolic-health" }],
  locked: false,
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
  content: "",
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("ResourceBreadcrumbs (PL9)", () => {
  it("renders Home > Resource Library > category default", () => {
    render(<ResourceBreadcrumbs model={model} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Resource Library")).toBeTruthy();
    expect(screen.getByText("BSI")).toBeTruthy();
  });

  it("uses ?from=topic slug label from model topics", () => {
    window.history.replaceState({}, "", "/library/post/1?from=topic:metabolic-health");
    render(<ResourceBreadcrumbs model={model} />);
    expect(screen.getByText("Metabolic Health")).toBeTruthy();
  });
});
