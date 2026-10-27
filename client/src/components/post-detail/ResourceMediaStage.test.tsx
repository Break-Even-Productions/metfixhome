/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DetailReaderModel } from "@shared/library";
import { ResourceMediaStage } from "./ResourceMediaStage";

function model(partial: Partial<DetailReaderModel>): DetailReaderModel {
  return {
    id: 1,
    title: "Locked video",
    date: "2026-01-01T00:00:00Z",
    author: null,
    image: "https://brokenscience.org/wp-content/uploads/x.jpg",
    video: {
      kind: "youtube",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoId: "dQw4w9WgXcQ",
    },
    categories: [],
    content_types: [],
    topics: [],
    locked: true,
    access: {
      access: "none",
      has_content_access: true,
      user_has_access: false,
      has_preview: false,
      is_exclusive: true,
      show_same: 0,
      show_video_in_preview: false,
      access_group_labels: [],
    },
    content: "",
    ...partial,
  };
}

afterEach(() => {
  cleanup();
});

describe("ResourceMediaStage locked DOM (TC9)", () => {
  it("omits iframe/video when locked without preview", () => {
    const { container } = render(<ResourceMediaStage model={model({})} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("[data-testid=resource-media-locked]")).toBeTruthy();
  });

  it("renders iframe when unlocked with embed", () => {
    const { container } = render(
      <ResourceMediaStage
        model={model({
          locked: false,
          access: {
            ...model({}).access,
            access: "full",
            user_has_access: true,
          },
        })}
      />,
    );
    expect(container.querySelector("iframe")).toBeTruthy();
  });
});
