/**
 * @vitest-environment jsdom
 * WJ18: signed-in locked library → /account/billing (not JoinFlow).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as session from "@/lib/session";
import { JoinFlowProvider } from "@/contexts/JoinFlowContext";
import * as api from "./api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LibraryDetailPage WJ18 locked CTA", () => {
  it("signed-in locked resource → Manage membership → /account/billing (no JoinFlow open)", async () => {
    vi.spyOn(session, "peekMe").mockReturnValue({
      status: "signed_in",
      public_name: "Pat",
      moderator: false,
    });
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat",
      moderator: false,
    });
    vi.spyOn(api, "fetchLibraryItem").mockResolvedValue({
      resource: {
        id: 1,
        type: "post",
        title: "Locked piece",
        date: "2026-01-01",
        author: null,
        excerpt: "",
        permalink: "/library/post/1",
        image: null,
        content: "",
        video: null,
        locked: true,
        categories: [],
        topics: [],
        content_types: [],
        access: {
          access: "none",
          has_content_access: false,
          user_has_access: false,
          has_preview: false,
          is_exclusive: true,
          show_same: 0,
          show_video_in_preview: false,
          access_group_labels: [],
        },
      },
    } as never);

    const { default: LibraryDetailPage } = await import("./LibraryDetailPage");
    render(
      <JoinFlowProvider>
        <LibraryDetailPage params={{ type: "post", id: "1" }} />
      </JoinFlowProvider>,
    );

    const link = await screen.findByTestId("library-locked-billing");
    expect(link.getAttribute("href")).toBe("/account/billing");
    expect(screen.queryByRole("dialog", { name: /Join MetFix/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Start my free month/i })).toBeNull();
    await waitFor(() => {
      expect(screen.getByText(/Members-only/i)).toBeTruthy();
    });
  });
});
